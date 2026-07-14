# PRD — EquiDoc
**Web-Native Document Accessibility Engine**

| | |
|---|---|
| Author | Solo builder |
| Version | **v5 — as-built reconciliation** (supersedes v4; original kept as `01_PRD.md` for comparison) |
| Platform | Mobile-first web app (PWA-ready, not yet installable) |
| Type | AI/ML product (multimodal LLM) |
| Project type | **Independent build.** No NGO, no institutional partner. All validation, document sourcing, and testing done directly by the builder and a small self-recruited beta group. |
| Reconciled | 2026-07-14 — every section marked against the actual build. **Status tags:** ✅ built · ⚠️ partial / differs · ❌ not built yet. |

> **What this version is.** v4 described the intended product (async queue, Supabase, server-side TTS, eval harness). v5 keeps that vision but tells the truth about what exists **today**: a working front-end prototype with live Gemini analysis, grounded chat, a comprehension check, and browser-based audio — and **no backend infrastructure, storage, TTS vendor, or measurement yet.** Unbuilt pieces are not deleted; they are moved to §13 (Next phase) so the roadmap stays visible.

---

## 1. One-liner

A person photographs a complex paper document (contract, lease, benefits form) and within seconds **reads — and, where their device supports it, hears — a simplified, translated plain-language summary in their own language, with the clauses that affect their rights flagged separately.** They can then ask follow-up questions, do a quick understanding check, and share the summary with someone they trust.

**North Star:** documents genuinely *understood*, not documents processed.

> ⚠️ **Honesty note vs v4:** v4 said the user "hears" the summary. In reality the **reliable** output is **text**; audio is **best-effort** and depends on the device having a voice for that language (see §9, §11). Where no voice exists, the app now says so plainly and shows the text.

---

## 2. Problem

Migrant and blue-collar workers, non-native speakers, and anyone facing a dense legal/administrative document routinely sign, ignore, or discard paperwork they can't fully read. Language barriers and low textual literacy mean people commit to terms they can't understand, with no easy way to check what they agreed to.

**Why now:** Multimodal LLMs do OCR + translation + plain-language rewriting in a single low-cost call. Every target user already has a smartphone browser. A zero-install web tool removes app-store friction entirely.

**Evidence status — self-validated, no partner data yet.** Because there's no institutional partner to supply real client documents or interview subjects, evidence is gathered directly:
- **Self-sourced document corpus:** publicly available contract/lease/form templates, government-published sample forms, and the builder's own (redacted) documents. A starter set exists in `test-documents/` (eviction notice, medical consent, loan agreement, benefits denial, employment contract, Spanish service-cutoff notice).
- **Small beta group:** friends, family, online communities recruited directly, not through a caseworker.
- **Baseline comparison:** how well a test user understands a sample document today (Google Translate, a friend, nothing) vs. with EquiDoc.

---

## 3. Goals & success metrics

**Outcome metric:** Documents comprehended per active user/month — a doc only counts when the user completes the flow **and** confirms understanding (now via a lightweight yes/no comprehension check, not just a tap).

| Layer | Metric | Baseline → Target | Instrumentation |
|---|---|---|---|
| Primary (outcome) | Comprehension success rate | n/a → ≥ 80% | ❌ **Not captured** — the quiz runs but its result is not logged anywhere |
| Input | Flow completion rate (capture → summary) | n/a → ≥ 70% | ❌ Not captured |
| Input | OCR usable-extraction rate (no retake needed) | n/a → ≥ 85% | ❌ Not captured |
| Input | Time to summary (p50 / p90) | n/a → ≤ 20s / ≤ 45s | ❌ Not captured (60s function limit + client retry loop) |
| Guardrail | Critical-clause miss rate (self-audited vs golden set) | ≤ 2% | ❌ No golden set / eval yet |
| Guardrail | Material mistranslation / hallucinated-obligation rate | ≤ 2% | ❌ No eval yet |
| Guardrail | Cost per document | ≤ $0.02 | ❌ Not measured (model is Flash-`latest`; cost unverified) |

> ⚠️ **Reality:** the product currently has **no analytics or logging of any kind.** Comprehension result, emoji feedback, completion, latency, and cost are all in-memory only. **Nothing feeds the North Star yet.** Adding minimal, privacy-safe event logging is the highest-value next step for making any of §3 real.

**Example OKR (unchanged intent):** Objective — "Prove AI can make dense documents genuinely understandable for non-expert readers." KR1: 70% flow completion in beta. KR2: ≥80% comprehension success in beta. KR3: critical-clause miss rate ≤2% on self-built golden set. *(All three currently unmeasurable — see instrumentation column.)*

---

## 4. Non-goals (v1)

- **Not legal advice.** Explains what a document says — never advises what to do. ✅ Enforced in prompt + persistent disclaimer.
- **No editing/signing/submitting.** Read-and-understand only. ✅
- **Not a document store.** ✅ **Stronger than v4 promised:** images are sent in the analysis request and **never persisted server-side** — there is no database or storage layer at all.
- **No accounts.** Anonymous, mobile-first, no login wall. ✅
- **Not every language day one.** ⚠️ **Diverges:** 20 languages ship in the picker (see §9), **none formally validated** against an eval set, and TTS coverage across them is uneven.
- **No offline processing in v1.** Requires network round-trip. ✅ (and no offline replay either — no service worker yet.)
- **No institutional/enterprise integration in v1.** ✅

---

## 5. Users

### Primary — "Marisol" (the actual end user)
- Migrant/blue-collar worker, non-native speaker, or anyone handed a document denser than their comfort level.
- Budget Android, older browser, intermittent data.
- JTBD: *"Help me understand what I'm agreeing to before I sign."*
- Success: understands the summary in their language, sees obligations + risky clauses, feels safe to decide, and can pass it to someone they trust.
- **Reached directly** — via word of mouth, community forums, social sharing of the link.

### Secondary — none required for v1
Without an NGO caseworker as trust-intermediary, **that role is absorbed by the product itself** — the consent screen, disclaimer, and framing must do the trust-building. This raises the bar on UI/UX clarity.

> ⚠️ **Gap:** this trust-building copy (consent, disclaimer, headings, onboarding) is currently **English-only** — see §7 R2/R9/R15 and §10. For a non-English, low-literacy user, an English shell undercuts the standalone-trust premise.

---

## 6. User stories

- As a user, I photograph a document and understand what it means in my language before I sign. ✅ (read; ⚠️ hear only where a device voice exists)
- As a user, the app flags clauses affecting my rights/money so nothing buried catches me out. ✅
- As a user, I can **ask follow-up questions** about the document and get grounded answers. ✅ *(new — not in v4)*
- As a user, I do a **quick check** so I know I actually understood the key points. ✅ *(new — upgrades v4's emoji tap)*
- As a user, I can **share the summary** with a friend or advocate. ✅ *(new — was only a "Could" in v4)*
- As a user, I'm told plainly my photo goes to the cloud and isn't kept. ⚠️ Told at consent, **English-only**.
- As a user with a blurry photo, I get clear retake guidance. ✅
- As a user, I can re-hear or re-read the summary at my own pace. ✅ (text always; audio device-dependent, with pause/resume + speed)

---

## 7. Requirements (MoSCoW) — with build status

| # | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| R1 | Camera capture inside mobile browser, no install | Must | ✅ | Multi-page supported |
| R2 | Explicit **in-language** cloud-processing consent before capture | Must | ⚠️ | Consent checkbox exists and gates capture, but copy is **English-only**; not translated to the chosen language |
| R3 | Async OCR/extraction via background job (no browser timeout) | Must | ❌ | **Synchronous** serverless call + retry loop instead; no Trigger.dev/queue |
| R4 | Plain-language simplification + translation | Must | ✅ | Gemini Flash (`gemini-flash-latest`) |
| R5 | Detect/surface attention-worthy clauses | Must | ✅ | "Worth paying attention to" section |
| R6 | Audio playback of summary in target language | Must | ⚠️ | **Browser Web Speech only**, device-dependent; honest "not available on this device" fallback when no voice |
| R7 | Image deleted immediately post-processing, no archive | Must | ⚠️/✅ | **Never stored at all** (better) — but consequently **no deletion log / verifiable mechanism** exists |
| R8 | Image-quality guidance + retake + confidence signal | Must | ⚠️ | Retake + "Read partly" confidence pill ✅; live capture-framing overlay ❌ |
| R9 | Persistent **in-language** "not legal advice" disclaimer | Must | ⚠️ | Present & persistent, but **English-only** |
| R10 | Readable text summary alongside audio, replay/scrub | Should | ⚠️ | Text + replay + speed ✅; draggable scrubber ❌ (progress bar is display-only) |
| R11 | Comprehension confirmation + emoji feedback | Should | ✅ | **Exceeds** — real yes/no quiz + emoji; ⚠️ result **not logged** |
| R12 | Language picker limited to validated set | Should | ❌ | 20 languages, unvalidated, **+ search box** |
| R13 | Multi-page document capture | Could | ✅ | Built |
| R14 | Save/share summary; offline replay | Could | ⚠️ | **Share built** (native share / clipboard); offline replay ❌ |
| R15 | Self-serve onboarding explainer (first-run) | Should | ❌ | **Not built** — app opens directly to the language picker |

### New requirements (built, but absent from v4)

| # | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| N1 | **Grounded Q&A chat** about the analyzed document | Should | ✅ | `/api/chat`, answers in target language, grounded in the summary |
| N2 | **"Who can help you"** generic free-resource layer | Should | ✅ | Resource *types* only (legal aid clinic, embassy, community group) — never invented specifics; model-generated in target language |
| N3 | **Lightweight comprehension check** (2 yes/no Qs from the doc) | Should | ✅ | Turns "I understand" into measured understanding; routes to "understood" or "get a second pair of eyes" |
| N4 | **Share to someone you trust** | Should | ✅ | Native share sheet → WhatsApp etc., clipboard fallback |
| N5 | **Language search** in the picker | Could | ✅ | Filters by label/native name/id |
| N6 | **Honest TTS-availability handling** | Must | ✅ | Detects installed voices; never reads text in a mismatched voice; shows a clear notice — satisfies R6's "if unsupported, readable fallback + notice shown" |
| N7 | **Transient-failure retry + safety settings** | Should | ✅ | Retries 429/503/overload with backoff; `BLOCK_NONE` so real legal wording isn't refused |

---

## 8. Acceptance criteria (Given/When/Then) — with status

**Consent (R1, R2)**
- Given a first-time user reaches capture, When they arrive, Then a consent notice blocks capture until accepted. ✅ *(⚠️ English-only)*
- Given consent declined, When user tries to proceed, Then no upload occurs. ✅

**Extraction quality (R3, R8)**
- Given a blurry/cropped photo, When processing runs, Then user gets a retake prompt, not a wrong summary. ✅ (empty/blocked result → retake)
- Given no readable text, When processing completes, Then an empty-state offers retake — never a fabricated summary. ✅
- Given low-but-nonzero confidence, When summary is shown, Then a "double-check" indicator appears. ⚠️ Shown as a "Read partly" pill (softer than a warning).

**Simplification & playback (R4, R5, R6, R9)**
- Given text extracted, When summarized, Then output is in the user's language, plain reading level, attention-clauses separate. ✅
- Given a summary is displayed, Then the "not legal advice" disclaimer is visible. ⚠️ Yes, **English-only**.
- Given summary ready, When user taps play, Then audio plays in target language; if unsupported, readable fallback + notice shown. ✅ *(now fully met via N6)*

**Privacy (R7)**
- Given a job ends, Then the source image is deleted within the window and deletion is logged/verifiable. ⚠️ Image is **never stored**, so there is nothing to delete and **no log** — the guarantee holds by construction but is not independently *verifiable* via a log.

**Onboarding (R15)**
- Given a first-time visitor, Then a ≤3-screen explainer shows what the app does/doesn't do and what happens to their photo, before consent. ❌ **Not built.**

---

## 9. AI spec

**AI does:** OCR/extraction, cleanup, translation, plain-language rewriting, clause flagging, next-step suggestions, generic help-resource suggestions, comprehension-question generation, grounded follow-up Q&A.
**AI must not:** give legal advice, predict outcomes, invent obligations/dates/amounts, or invent specific help contacts (phone numbers/URLs/org names).

**Model:** **Gemini 3.5 Flash**, pinned in code to the `gemini-flash-latest` alias (always Google's current Flash; avoids retirement of a hard-coded version). Temperature 0.2 (analyze) / 0.3 (chat), `responseMimeType: application/json`.
**Approach:** Structured prompting, strict JSON schema. Output fields: `raw_transcription, readable, confidence, docType, summary, facts[], clauses[], nextSteps[], glossary[], helpResources[], checks[], originalText, spoken`. Grounded strictly in the document.

**Safety:** all four Gemini harm categories set to **`BLOCK_NONE`** — a deliberate choice so genuinely harsh but legitimate legal wording (evictions, penalties, medical) isn't refused. ⚠️ This is a conscious divergence from the "0 safety violations" framing; the guardrail is now the **prompt** ("not legal advice," no invented facts), not Gemini's content filter.

> ⚠️ **Guardrail tension vs v4:** v4 said *"never guess illegible text — mark as 'couldn't read this part.'"* The live prompt instead sets `readable: ALWAYS true — do your best even if blurry`, and unreadability is handled at the app level (empty/blocked model output → retake screen). The model is **not** currently asked to flag specific illegible passages. Decide which behavior you want and align prompt + PRD.

**Golden set & eval — ❌ NOT BUILT.** No golden set, no LLM-judge, no CER/faithfulness/clause-recall scoring exists yet. §9's scoring table and thresholds remain the *plan*, not the current state. `test-documents/` is a starter corpus but has no ground-truth labels.

| Quality dimension | Scoring | Ship threshold | Status |
|---|---|---|---|
| Extraction accuracy | CER vs ground truth | ≤ 5% CER | ❌ |
| Faithfulness | LLM-judge + spot-check | ≥ 98% | ❌ |
| Critical-clause recall | vs labelled set | ≥ 95% | ❌ |
| Translation adequacy | judge + native review | ≥ 4/5 | ❌ |
| Readability | reading-grade metric | ≤ grade 6 | ❌ |
| Safety / no-advice | classifier + judge | 0 violations | ❌ |

**Languages shipped (20):** English, Tagalog, Indonesian, Nepali, Hindi, Bengali, Tamil, Malayalam, Telugu, Urdu, Arabic, Amharic, Spanish, French, Punjabi, Sinhala, Marathi, Gujarati, Kannada, Odia. Translation works for all (model reads the language label); **audio availability is per-device** and uneven (e.g. on macOS, ~10 of 20 have a system voice; a typical Android with Google TTS covers many more).

**"What if it's wrong" UX:** confidence pill ✅ · original excerpt available ✅ · one-tap retake ✅ · **grounded chat to ask clarifying questions** ✅ · **"Who can help you" pointing to generic human help** ✅ · a "this looks wrong" report path ❌ (not built).

**Cost/latency budget:** ≤ $0.02/doc, ≤ 45s — targets only; ❌ not measured.

---

## 10. UX principles

Mobile-first, low-literacy-friendly: large tap targets, icon + audio cues, minimal text, no account.

**Key screens (as built):** Language picker (+ search) → Capture (+ consent + multi-page) → Processing → **Result** (audio *or* honest no-audio notice + text + facts + attention-clauses + next steps + "who can help" + glossary + chat + confidence + disclaimer) → **Comprehension check** → Done (emoji feedback + **share** + replay + rescan) · with Retake/empty states throughout.

> ❌ **Missing vs §10 intent:** (a) no first-run onboarding explainer; (b) the **app shell is English-only** — only Gemini-generated *content* is translated, while "Choose your language," consent, disclaimer, section headings and the quiz chrome stay in English. This is the biggest UX-honesty gap for the target user.

Low-literacy usability testing still required before public beta.

---

## 11. Non-functional requirements — with status

| Area | Requirement | Status |
|---|---|---|
| Performance | Budget Android/older browsers; p50 ≤20s / p90 ≤45s | ⚠️ Plausible but **unmeasured**; 60s function cap + retry loop |
| Privacy | Immediate image deletion, no archive, verifiable | ✅ Never stored; ⚠️ no verifiable log because there's no storage |
| Consent | In-language disclosure before capture | ⚠️ Present but **English-only** |
| Security | Encrypted transit; least-privilege keys; server-side key | ✅ Key stays server-side (serverless fn + dev proxy); HTTPS in prod |
| Accessibility | Audio-first, large targets, high contrast, screen-reader friendly | ⚠️ Audio best-effort; ARIA labels present; not audited |
| Compliance | Treat documents as sensitive; data-minimizing | ✅ No storage, no logging (also why §3 is unmeasured) |
| Cost | ≤ $0.02/doc; degrade to Flash-Lite under pressure | ⚠️ Unmeasured; no cost-based model switch |
| Scale | Queue absorbs spikes; retry/failure UX; observability | ⚠️ Retry/failure UX ✅; **no queue, no observability** |
| Delivery | Installable PWA | ❌ **No manifest / service worker** — runs as a normal web app; not installable/offline |
| Stack | (v4 assumed Next.js 16) | ⚠️ Actual: **React 18 + Vite 5**, serverless functions under `app/api/`, Vite dev proxy mirrors them |

---

## 12. Risks & dependencies

**Dependencies (actual):** **Gemini API only.** ~~Supabase~~, ~~Trigger.dev~~, ~~separate TTS vendor~~ are **not used** — audio is the browser's built-in Web Speech. Hosting via Vercel serverless functions.

**Key risks:**
1. **OCR accuracy on real photos** — core product risk. Mitigate: capture guidance (partial), retake prompts ✅, confidence pill ✅.
2. **Legal-interpretation liability** — mitigate with disclaimer ✅ + conservative prompt ✅. ⚠️ `BLOCK_NONE` shifts all safety onto the prompt.
3. **Language/dialect coverage** — ⚠️ **live risk today:** 20 languages shipped **without validation**, and **audio is device-dependent** (the honest fallback mitigates the worst case).
4. **No trust intermediary** — ⚠️ worsened by the **English-only shell** and **missing onboarding**.
5. **No measurement** — ⚠️ **new risk:** with zero analytics, none of the success metrics can be evaluated; beta learnings will be anecdotal until logging exists.
6. **Distribution** — unchanged; word-of-mouth + community sharing (now aided by the built-in share feature).

**Riskiest assumption:** the model can extract + faithfully simplify real, messy, multilingual phone photos well enough to be trusted on high-stakes documents — *and* that the product alone can earn enough trust for people to use it on documents that matter. **Untested without a golden set or instrumented beta.**

**Cheapest test:** build the golden set + run `test-documents/` (plus real photos) through the model and score against §9 before adding more surface area.

---

## 13. Out of scope / **Next phase** (was "intended" in v4, not yet built)

Moved here so the roadmap stays visible without overstating the current build:

- **Async processing:** Trigger.dev (or equivalent) background job + queue (v4 R3).
- **Storage & verifiable deletion:** Supabase (or equivalent) transient storage with a logged, verifiable deletion window (v4 R7).
- **Server-side TTS vendor:** guaranteed, consistent voices per language regardless of device (v4 R6 / NFR) — the fix for today's device-dependent audio.
- **Eval harness:** golden set with ground-truth labels + LLM-judge + CER/recall scoring (v4 §9) — the prerequisite for the §3 metrics and any model swap.
- **Instrumentation:** privacy-safe event logging for comprehension result, completion, latency, cost.
- **In-language app shell:** translate consent, disclaimer, onboarding, and UI chrome — not just model output.
- **First-run onboarding explainer** (v4 R15).
- **Installable PWA:** manifest + service worker + offline replay of the last result (v4 R14).
- **"This looks wrong" report path** feeding the golden set.
- **Capture-framing overlay** and a true draggable audio scrubber.
- Expanded, **validated** language coverage; on-device processing; model-swap eval gate; guided help on common form types.

---

## 14. Rollout plan (evidence-gated)

| Phase | What happens | Exit criterion | Where we are |
|---|---|---|---|
| 0 — Eval first | Run self-sourced golden set through model, no UI | Meets §9 thresholds | ❌ **Not started** (UI built ahead of eval) |
| 1 — Private beta | Small build behind a flag; builder + self-recruited group | ≥70% completion, ≥80% comprehension, 0 safety violations | ⚠️ Build exists; **can't measure exit criteria** without §3 instrumentation |
| 2 — Public soft launch | Public link shared in communities | Metrics hold; cost ≤ budget | ❌ Blocked on measurement |
| 3 — Open access / iterate | Fully public | Sustained North Star growth; guardrails green | ❌ |

**Launch checklist (unchanged intent):** eval suite green on shipping languages · disclaimer copy reviewed per language (in-language) · image handling verified · monitoring live · rollback/kill-switch tested. **Most items depend on §13 next-phase work.**

---

*v5 reconciles v4 against the build as of 2026-07-14. Original preserved at `01_PRD.md` for side-by-side comparison.*
