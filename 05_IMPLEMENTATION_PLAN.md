# Implementation Plan — EquiDoc
**Standalone version — no institutional/NGO partner.**

Evidence-gated, not calendar-gated (PRD §14). **Do not advance a phase on schedule — advance on metrics.** Each phase below has a concrete exit criterion; do not start the next phase's build work until the current phase's criterion is met.

---

## Phase 0 — Eval First (no UI)

**Goal:** validate the riskiest assumption before writing a single line of frontend code — without relying on any partner-supplied documents.

**Tasks:**
1. **Self-source 30–50 golden-set documents** using only channels that don't require a partner:
   - Publicly available contract/lease/employment-form templates (government sites, legal-aid publishers, sample-document banks)
   - The builder's own real documents, manually redacted of personal identifiers
   - Synthetic documents covering hard-to-find clause types (penalty, arbitration, indemnity), written or LLM-assisted
   - Informally recruited beta volunteers (friends, online communities) who opt in to donate a redacted document
2. Human-author ground truth for each: known-good summary + list of clauses that should be flagged. Ideally get a second person to sanity-check a sample of these to catch builder blind spots.
3. Build the minimal harness: send each document image to Gemini 2.5 Flash / Flash-Lite with the structured-output prompt (TRD §3 schema), no app around it — a script is enough.
4. Score against thresholds (PRD §9):
   - Extraction accuracy (CER) ≤ 5%
   - Faithfulness ≥ 98%
   - Critical-clause recall ≥ 95%
   - Translation adequacy ≥ 4/5
   - Readability ≤ grade 6
   - Safety/no-advice violations = 0
5. Record results in `eval_runs` table (schema §3).

**Exit criterion:** meets §9 thresholds on the chosen languages. **If it doesn't clear this bar, stop and fix the prompt/schema before any build — do not proceed to Phase 1 on hope.**

**Owner inputs needed:** builder only — document sourcing, ground-truth authoring, prompt engineering. No external dependency.

---

## Phase 1 — Private Beta

**Goal:** small real build, tested by the builder plus a self-recruited beta group — no caseworker supervision.

**Build scope (Must-priority requirements only, R1–R9, plus R15):**

| Sprint | Deliverable |
|---|---|
| 1 | Next.js 16 PWA skeleton, deploy pipeline, Supabase project + schema (§3 core tables: sessions, consents, documents, feedback, metrics_events) |
| 2 | Onboarding explainer (R15) — replaces the trust-building role a caseworker would otherwise play |
| 3 | Consent screen (R2) + logging, language select (R12, hard-coded to validated set from Phase 0), camera capture (R1) |
| 4 | Upload → Trigger.dev job → Gemini call with schema validation → confidence branching (R3, R8) |
| 5 | TTS integration (default Google Cloud TTS Standard), audio delivery, result screen (R4, R5, R6, R9) |
| 6 | Image deletion step + verification logging (R7) — do not consider Phase 1 build complete without this working and audited |
| 7 | Error/empty/retake states (blurry photo, no text found, low confidence) — per UI/UX doc §2.7 |
| 8 | Comprehension feedback capture (R11, Should-priority but pull forward — it's the North Star instrument) |
| 9 | Low-literacy usability testing round with informally recruited testers (friends, family, relevant online communities); fix critical issues found |

**Recruiting the beta group without a partner:**
- Direct network: friends/family who are non-native speakers, or know someone who is
- Relevant online communities: immigrant/expat forums, language-exchange groups, subreddits for specific diaspora communities
- Direct outreach: a short, honest post explaining the tool and asking for testers — no institutional credibility to lean on, so be transparent about it being an independent project

**Exit criterion:** ≥70% flow completion, ≥80% comprehension success, 0 safety violations, measured on real beta usage.

**Key gates before treating beta as "real usage" data:**
- Disclaimer + consent copy reviewed in every beta language by a native speaker (informally recruited if needed).
- Image-deletion verified end-to-end (manual audit of a sample of `deleted_at` timestamps).
- Onboarding explainer tested on at least a few people with zero context on the project, to confirm it does its trust-building job.

---

## Phase 2 — Public Soft Launch

**Goal:** wider, less-curated usage; monitor cost/latency live; no institutional gatekeeping.

**Tasks:**
1. Add Should-priority requirements not yet built: R10 (readable text + scrub controls if not already done), full R12 language picker UX polish.
2. Expand golden set (Phase 0 process) for each new language before enabling it — do not add a language without its own eval pass.
3. Stand up observability dashboard: success rate, latency (p50/p90), cost-per-doc, eval drift over time — sourced from `metrics_events` + `eval_runs`.
4. Load-test the Trigger.dev queue against a plausible spike scenario (e.g. the link getting shared in a large community/forum).
5. Cost monitoring alert if rolling average exceeds $0.02/doc — trigger fallback to Flash-Lite/cheaper TTS tier automatically or via a manual runbook. **This matters more here since the project is self-funded.**
6. Share the public PWA link informally: relevant online communities, social media, a simple one-page landing site explaining what it is and isn't.

**Exit criterion:** metrics hold at larger, less-curated volume; cost stays within budget.

---

## Phase 3 — Open Access / Iterate

**Goal:** fully public tool, iterated on real usage data, no gating.

**Tasks:**
1. Consider Could-priority items: R13 (multi-page capture), R14 (save/share summary — resolve the tension with the no-storage stance explicitly, e.g. a time-limited share link rather than persistent storage).
2. Harden abuse/rate-limiting on public endpoints (no accounts means anonymous abuse potential — add basic rate limits per IP/session on `/api/documents`).
3. Continuous eval regression: every prompt/model change re-runs the (by now larger) golden set before deploy — this becomes a CI gate, not a manual step.
4. Public launch checklist (PRD §14): eval suite green, disclaimer reviewed per language, deletion verified, monitoring live, rollback/kill-switch tested.
5. **Optional, future:** if an NGO, legal-aid org, or community group organically discovers and wants to use/promote the tool, that's a welcome bonus — evaluate a lightweight partnership at that point, but the roadmap does not depend on it happening.

**Exit criterion:** sustained North Star metric growth (documents genuinely comprehended per active user/month), guardrails remain green.

---

## Cross-phase engineering practices

- **Golden set is a living regression suite.** Every model or prompt change → run golden set → compare against `eval_runs` history before deploying. Treat this the way a normal engineering team treats unit tests.
- **Never relax the "no fabrication" guardrail for convenience.** If extraction fails, the correct product behavior is an honest empty state — this is enforced in code (TRD §6), not just in the prompt.
- **Model swap policy:** any change of underlying model (e.g. future Gemini version) requires a full golden-set eval pass before rollout — treat as a breaking change, not a drop-in upgrade.
- **Cost discipline:** default to the cheapest model/TTS tier that clears eval thresholds; only escalate to a pricier tier if evals demand it — self-funded projects don't get to absorb surprise API bills.
- **Kill switch:** feature-flag the entire capture flow so it can be disabled instantly if a safety violation or privacy incident is detected in production.

---

## Suggested solo-builder workflow (for reference)

Since there's no team, roles collapse onto one person across phases — sequence matters more than parallelism:

| Stage | Focus |
|---|---|
| Phase 0 | Wear the "AI/prompt engineer" hat: sourcing documents, writing ground truth, tuning the prompt against eval thresholds |
| Phase 1 | Wear the "full-stack engineer" hat: build the PWA, API routes, Trigger.dev jobs, then briefly the "designer" hat for onboarding/consent copy and low-literacy UI |
| Phase 1 (testing) | Wear the "PM" hat: recruit beta testers, review feedback, decide what's a blocking issue vs. a fast-follow |
| Phase 2–3 | Cycle back through all three hats as needed: eval maintenance, feature additions, and community-driven distribution |

**Time-boxing tip:** because there's no external deadline pressure from a partner, it's easy for a solo project to drift. Treat the exit criteria in each phase as hard gates you set for yourself, not aspirational targets.
