# Database Schema — EquiDoc
**Engine:** Supabase Postgres
*No user accounts. Everything is session-scoped and short-lived by design (see PRD §3 non-goals, §11 privacy).*

---

## 1. Design principles

- **No `users` table.** Sessions are anonymous, random UUIDs generated client-side on first load — not tied to device identity, email, or phone number.
- **No document content at rest longer than necessary.** Raw images are never referenced by a permanent column — only a transient `storage_path` that gets nulled on deletion.
- **Everything auditable.** Deletion, consent, and feedback all get their own timestamped rows — this is the privacy/trust proof, not just a nice-to-have.
- **Row-Level Security (RLS) on by default.** A row is only readable by the session that created it (matched via a `session_id` claim passed from the client, not a login).

---

## 2. Entity overview

```
sessions ──1:N── consents
sessions ──1:N── documents ──1:1── feedback
documents ──1:N── metrics_events
golden_set_documents (independent, used for eval regression — not linked to live user sessions)
```

---

## 3. DDL

```sql
-- ========================================
-- sessions
-- Anonymous session, no PII, no auth link.
-- ========================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  preferred_language text  -- ISO 639-1, set after first language pick
);

-- ========================================
-- consents
-- Logged every time consent is shown (R2). Immutable — never updated, only inserted.
-- ========================================
create table consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  accepted boolean not null,
  language text not null,        -- language the consent copy was shown in
  shown_at timestamptz not null default now()
);

-- ========================================
-- documents
-- One row per capture attempt (including failed/retaken ones, for funnel analysis).
-- ========================================
create type document_status as enum (
  'queued', 'processing', 'done', 'failed', 'low_confidence', 'no_text_found'
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,

  -- transient storage pointer — set on upload, NULLED on deletion (R7)
  storage_path text,
  deleted_at timestamptz,          -- non-null = image deleted; this is the audit proof

  status document_status not null default 'queued',
  target_language text not null,   -- requested output language, from validated allow-list
  language_detected text,          -- detected source-document language

  -- AI output (per TRD §3 schema)
  extracted_text_preview text,     -- short preview only, NOT full raw text retained long-term
  summary text,
  attention_clauses jsonb,         -- array of {clause_text, reason, category}
  confidence numeric(3,2),         -- 0.00–1.00
  unreadable_segments jsonb,

  audio_storage_path text,         -- transient TTS output pointer
  audio_deleted_at timestamptz,

  cost_usd numeric(8,5),           -- actual cost for this doc (Gemini + TTS)

  created_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz
);

create index idx_documents_session on documents(session_id);
create index idx_documents_status on documents(status);

-- ========================================
-- feedback
-- Comprehension confirmation + "this looks wrong" reports (R11).
-- ========================================
create table feedback (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  understood boolean,               -- one-tap "I understand this now"
  reaction_emoji text,              -- optional lightweight sentiment
  flagged_wrong boolean default false,
  note text,
  consented_to_golden_set boolean default false,  -- can this feedback+doc be added to eval set?
  created_at timestamptz not null default now()
);

create index idx_feedback_document on feedback(document_id);

-- ========================================
-- metrics_events
-- Lightweight event log for observability: latency, cost drift, funnel steps.
-- ========================================
create table metrics_events (
  id bigint generated always as identity primary key,
  document_id uuid references documents(id) on delete set null,
  event_type text not null,        -- e.g. 'capture_started','upload_complete','job_queued',
                                    -- 'job_started','job_completed','retake_prompted'
  event_payload jsonb,              -- free-form small metadata (e.g. {"reason":"blurry"})
  occurred_at timestamptz not null default now()
);

create index idx_metrics_document on metrics_events(document_id);
create index idx_metrics_type_time on metrics_events(event_type, occurred_at);

-- ========================================
-- golden_set_documents
-- Eval regression suite. NOT linked to live sessions — sourced from self-sourced
-- templates, redacted personal/builder documents, synthetic documents, and
-- opt-in beta-volunteer submissions, each with human-authored ground truth (PRD §9).
-- ========================================
create table golden_set_documents (
  id uuid primary key default gen_random_uuid(),
  source_language text not null,
  target_language text not null,
  document_type text,               -- e.g. 'employment_contract','tenancy_agreement'
  redacted_image_storage_path text not null,  -- long-lived, since these are pre-redacted/consented
  ground_truth_summary text not null,
  ground_truth_clauses jsonb not null,  -- array of expected {clause_text, category}
  added_at timestamptz not null default now(),
  notes text
);

-- ========================================
-- eval_runs
-- Records each time the golden set is run against a model/prompt version (regression gate).
-- ========================================
create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  model_version text not null,      -- e.g. 'gemini-3-1-flash-lite'
  prompt_version text not null,     -- version tag of the prompt template
  cer numeric(5,4),                 -- character error rate
  faithfulness_score numeric(5,4),
  clause_recall numeric(5,4),
  translation_score numeric(3,2),
  readability_grade numeric(4,1),
  safety_violations int not null default 0,
  passed_thresholds boolean not null,
  run_at timestamptz not null default now()
);
```

---

## 4. Row-Level Security (sketch)

```sql
alter table sessions enable row level security;
alter table documents enable row level security;
alter table feedback enable row level security;
alter table consents enable row level security;

-- Client can only touch rows matching the session_id it holds (passed as a header/claim,
-- not a login). Exact policy syntax depends on how session_id is propagated
-- (e.g. via a signed short-lived JWT minted at session creation).

create policy "session_owns_document"
  on documents for select using (session_id::text = current_setting('request.session_id', true));

-- Similar policies applied to consents, feedback (via document_id join), metrics_events.
-- golden_set_documents and eval_runs are internal-only — no client access, service-role only.
```

---

## 5. Retention / lifecycle rules

| Table | Retention | Notes |
|---|---|---|
| `sessions` | Short (e.g. 24–72h rolling), then purge | No reason to persist anonymous sessions long-term |
| `documents.storage_path` | Deleted immediately post-processing (minutes) | This is R7 — the core privacy guarantee |
| `documents` (metadata row) | Can persist longer for metrics, but strip `extracted_text_preview` after a short window too | Only aggregate metrics need to survive |
| `feedback` | Persist for product analytics | No raw document content in this table |
| `golden_set_documents` | Long-lived, intentionally | This is the eval regression asset — sourced from templates, redacted personal documents, synthetic examples, and opt-in beta-volunteer submissions; separate consent/redaction process from live users |
| `metrics_events` | Rolling window (e.g. 90 days) then aggregate-and-drop | Observability, not user data |

**Backstop:** even though the app explicitly deletes images, also set a Supabase Storage bucket lifecycle rule (e.g. auto-purge anything older than 1 hour) as a defense-in-depth measure in case the explicit delete step ever fails silently.
