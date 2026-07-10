# TRD — EquiDoc
**Technical Requirements Document**
*Companion to `01_PRD.md`. This is the build spec.*

---

## 1. Architecture overview

```
┌─────────────┐      ┌──────────────┐      ┌───────────────┐      ┌─────────────┐
│  Next.js 16  │─────▶│  API Route   │─────▶│  Trigger.dev  │─────▶│  Gemini 2.5 │
│  PWA (client)│      │  (upload +    │      │  background   │      │  Flash /    │
│              │◀─────│   consent)   │◀─────│  job queue    │◀─────│  Flash-Lite │
└─────────────┘      └──────────────┘      └───────────────┘      └─────────────┘
      │                      │                      │                     │
      │                      ▼                      ▼                     ▼
      │              ┌──────────────┐      ┌───────────────┐      ┌─────────────┐
      │              │  Supabase    │      │  Supabase     │      │  TTS Vendor │
      └─────────────▶│  Storage     │      │  Postgres     │      │  (Cloud TTS)│
     (delete signal) │  (transient) │      │  (sessions,   │      │             │
                      └──────────────┘      │   results)    │      └─────────────┘
                                            └───────────────┘
```

**Design principle:** no heavy compute on the client device (budget Android). All AI/TTS work happens server-side via an async queue so the mobile browser never holds a long-lived request open.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (stable), React, PWA manifest | Mobile-first, installable, no app-store friction |
| Styling | Tailwind CSS | Fast iteration, small bundle, accessible utility classes |
| Backend/API | Next.js API routes (Route Handlers) | Co-located with frontend, simplest deploy path |
| DB | Supabase Postgres | Managed, generous free tier, built-in row-level security |
| Object storage | Supabase Storage | Temporary image hosting with signed URLs + TTL deletion |
| Background jobs | Trigger.dev | Async queue; avoids serverless/browser timeout on long OCR calls |
| Vision/LLM | Gemini 2.5 Flash (Flash-Lite for cost-sensitive volume) | Multimodal OCR + translation + simplification in one call, 1M-token context |
| TTS | Google Cloud TTS (Standard tier default) | Server-side, consistent on cheap phones, single contractible vendor for privacy |
| TTS fallback | Web Speech API (on-device voices only) | Free fallback where `localService` voices are confirmed available |
| Hosting | Vercel (or equivalent edge/serverless host) | Native Next.js support, PWA-friendly |
| Observability | Trigger.dev dashboard + Supabase logs + a lightweight metrics table (see schema) | Track success rate, latency, cost/doc, eval drift |

---

## 3. Core data contract (AI output schema)

Every Gemini call must return **strict JSON** matching this schema. No free text outside it.

```json
{
  "extracted_text": "string — raw OCR output, or null if unreadable",
  "summary": "string — plain-language summary in target language, ≤ grade-6 reading level",
  "attention_clauses": [
    {
      "clause_text": "string — verbatim or near-verbatim snippet from source",
      "reason": "string — why it matters (obligation | deadline | penalty | rights-impact)",
      "category": "obligation | deadline | penalty | payment | rights"
    }
  ],
  "confidence": "float 0.0–1.0 — extraction confidence",
  "unreadable_segments": ["string — description of any part that couldn't be read"],
  "language_detected": "string — ISO 639-1 code of source document language",
  "language_output": "string — ISO 639-1 code of target/output language"
}
```

**Grounding rule (hard constraint in prompt):** the model must only summarize/flag what is present in `extracted_text`. If `extracted_text` is null or empty, `summary` and `attention_clauses` must also be empty — never fabricated.

---

## 4. API surface

### `POST /api/consent`
Logs consent acceptance/decline before capture is unlocked.
```
Request:  { session_id: string, accepted: boolean, language: string }
Response: { session_id: string, consent_logged_at: timestamp }
```

### `POST /api/documents`
Uploads captured image, creates a job, returns immediately (does not block on processing).
```
Request:  multipart/form-data { image: file, session_id: string, target_language: string }
Response: { document_id: string, status: "queued" }
```

### `GET /api/documents/:id/status`
Polled by client (or via websocket/SSE upgrade later) while job runs.
```
Response: { document_id, status: "queued" | "processing" | "done" | "failed" | "low_confidence" | "no_text_found",
            progress_hint?: string }
```

### `GET /api/documents/:id/result`
Returned once status = done.
```
Response: {
  document_id, summary, attention_clauses[], confidence,
  audio_url,          // signed, short-TTL URL to TTS output
  disclaimer_text,    // in-language, always present
  extracted_text_preview  // optional, for "cross-check" UX
}
```

### `POST /api/documents/:id/feedback`
Comprehension confirmation + "this looks wrong" reports (R11).
```
Request:  { understood: boolean, reaction_emoji?: string, flagged_wrong?: boolean, note?: string }
Response: { received: true }
```

### Trigger.dev job: `process-document`
Triggered internally on upload. Steps: fetch image from Storage → call Gemini with schema-constrained prompt → validate/parse JSON → call TTS → write result to Postgres → **delete image from Storage** → mark deletion timestamp.

---

## 5. Processing pipeline (step-by-step)

1. Client captures photo → client-side compression/resize (cap to reasonable dimensions to save cost/bandwidth on budget devices).
2. Consent must be logged (`R2`) before upload is permitted — enforced server-side, not just UI-side.
3. Image uploaded to Supabase Storage (private bucket, signed upload URL, short TTL).
4. `documents` row created, status `queued`; Trigger.dev job enqueued.
5. Job worker:
   a. Pulls image, sends to Gemini 2.5 Flash with structured-output prompt.
   b. Validates JSON against schema (§3). Reject/retry once on malformed output.
   c. If `confidence < threshold` (e.g. 0.5) → status `low_confidence`, still return result with warning flag (per acceptance criteria).
   d. If `extracted_text` empty → status `no_text_found`, no summary generated.
   e. On success: call TTS with `summary` text in `language_output`. Store resulting audio in Storage (short TTL, signed URL).
   f. Write `summary`, `attention_clauses`, `confidence`, `audio_url` to `documents` row. Status → `done`.
   g. **Delete source image from Storage. Log deletion timestamp — this write is the verifiable privacy guardrail (R7).**
6. Client polls `/status`, then fetches `/result` once `done`.
7. User taps "I understand" or answers comprehension check → `/feedback` → feeds North Star metric.

---

## 6. Guardrails enforced in code (not just prompt)

| Guardrail | Enforcement point |
|---|---|
| No legal advice | Prompt system instructions + output classifier pass on `summary`/`attention_clauses` before returning to client |
| No fabricated text on illegible docs | Code check: if `extracted_text` is null/empty, hard-block non-empty `summary`/`attention_clauses` even if model returns them |
| Image deletion | Enforced as a required, logged step in the Trigger.dev job — job is not considered "done" until deletion is confirmed |
| Disclaimer always shown | Rendered client-side from a static in-language string keyed by `language_output` — never model-generated, so it can't be dropped or altered |
| Cost ceiling | Default to Flash-Lite + Standard TTS; alerting if rolling avg cost/doc exceeds $0.02 |
| Language over-promising | Hard-coded allow-list of validated `language_output` values in `/api/documents`; reject unsupported languages at request time |

---

## 7. Non-functional targets (carried from PRD §11, made testable)

| Metric | Target | How verified |
|---|---|---|
| Time-to-summary | p50 ≤ 20s, p90 ≤ 45s | Timestamp diff: job created → status `done`, tracked in `metrics_events` |
| OCR usable-extraction rate | ≥ 85% | % of jobs not landing in `no_text_found`/low-confidence-retake |
| Cost per document | ≤ $0.02 | Sum of Gemini + TTS token/char cost, logged per job |
| Image deletion | 100%, verifiable | `deleted_at` timestamp non-null for every completed/failed job, audited |
| Uptime for queue | Absorbs spikes, no browser timeout | Trigger.dev retry policy: 3 attempts, exponential backoff |

---

## 8. Third-party dependencies & config

| Service | Purpose | Key config notes |
|---|---|---|
| Gemini API | OCR + translate + simplify | Use structured output / JSON mode; set temperature low (~0.1–0.2) for consistency; enforce schema server-side regardless |
| Supabase | DB + transient storage | Row-level security on `documents` (session-scoped, not user-scoped — no accounts); Storage bucket lifecycle rule as backstop even though app deletes explicitly |
| Trigger.dev | Async job orchestration | Retry policy, dead-letter handling for failed jobs, dashboard alerts on latency/cost drift |
| TTS vendor | Audio generation | Default Google Cloud TTS Standard; env-var swappable to Neural2/Azure/ElevenLabs without code change (adapter pattern) |

---

## 9. Security notes

- No user accounts → no PII tied to identity beyond the ephemeral session; session IDs are random, not derived from device fingerprints.
- Encrypt at rest (Supabase default) and in transit (TLS everywhere).
- Least-privilege service keys: Trigger.dev job has write access only to the specific bucket/table it needs.
- Signed URLs for both image upload and audio playback, short expiry (minutes, not hours).
- No logging of raw document content in application logs — only structured metadata (confidence, latency, language, status).
