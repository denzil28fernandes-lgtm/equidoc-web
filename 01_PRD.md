# PRD — EquiDoc
**Web-Native Document Accessibility Engine**

| | |
|---|---|
| Author | Solo builder |
| Version | v4 — standalone (no institutional partner) |
| Platform | Mobile-first PWA |
| Type | AI/ML product (multimodal LLM) |
| Project type | **Independent build.** No NGO, no institutional partner. All validation, document sourcing, and testing done directly by the builder and a small self-recruited beta group. |

---

## 1. One-liner

A person photographs a complex paper document (contract, lease, benefits form) and within seconds hears a simplified, translated audio summary in their own language — with the clauses that affect their rights flagged separately.

**North Star:** documents genuinely *understood*, not documents processed.

---

## 2. Problem

Migrant and blue-collar workers, non-native speakers, and anyone facing a dense legal/administrative document routinely sign, ignore, or discard paperwork they can't fully read. Language barriers and low textual literacy mean people commit to terms they can't understand, with no easy way to check what they agreed to.

**Why now:** Multimodal LLMs do OCR + translation + plain-language rewriting in a single low-cost call. Every target user already has a smartphone browser. A zero-install PWA removes app-store friction entirely.

**Evidence status — self-validated, no partner data yet.** Because there's no institutional partner to supply real client documents or interview subjects, evidence is gathered directly:
- **Self-sourced document corpus:** publicly available contract/lease/form templates, government-published sample forms, and the builder's own (redacted) documents — used to build the eval golden set (see §9).
- **Small beta group:** friends, family, online communities (e.g. immigrant/expat forums, language-exchange communities) recruited directly, not through a caseworker.
- **Baseline comparison:** how well a test user understands a sample document today using what they already have (Google Translate, a friend, nothing) vs. with EquiDoc.

---

## 3. Goals & success metrics

**Outcome metric:** Documents comprehended per active user/month — a doc only counts when the user completes the flow **and** confirms understanding (one-tap "I understand" or a lightweight comprehension check).

| Layer | Metric | Baseline → Target |
|---|---|---|
| Primary (outcome) | Comprehension success rate | n/a → ≥ 80% |
| Input | Flow completion rate (capture → audio playback) | n/a → ≥ 70% |
| Input | OCR usable-extraction rate (no retake needed) | n/a → ≥ 85% |
| Input | Time to summary (p50 / p90) | n/a → ≤ 20s / ≤ 45s |
| Guardrail | Critical-clause miss rate (self-audited against golden set) | ≤ 2% |
| Guardrail | Material mistranslation / hallucinated-obligation rate | ≤ 2% |
| Guardrail | Cost per document | ≤ $0.02 |

**Example OKR:** Objective — "Prove AI can make dense documents genuinely understandable for non-expert readers." KR1: 70% flow completion in beta. KR2: ≥80% comprehension success in beta. KR3: critical-clause miss rate ≤2% on self-built golden set.

---

## 4. Non-goals (v1)

- **Not legal advice.** Explains what a document says — never advises what to do.
- **No editing/signing/submitting.** Read-and-understand only.
- **Not a document store.** Images deleted immediately after processing.
- **No accounts.** Anonymous, mobile-first, no login wall.
- **Not every language day one.** Validated short list only, chosen by builder based on personal network/beta reach.
- **No offline processing in v1.** Requires network round-trip.
- **No institutional/enterprise integration in v1.** No NGO case-management hooks, no multi-tenant admin panel — this is a single, self-serve public tool.

---

## 5. Users

### Primary — "Marisol" (the actual end user)
- Migrant/blue-collar worker, non-native speaker, or anyone handed a document denser than their comfort level
- Budget Android, older browser, intermittent data
- JTBD: *"Help me understand what I'm agreeing to before I sign."*
- Success: hears a clear summary in their language, understands obligations + risky clauses, feels safe to decide.
- **Reached directly** — via word of mouth, community forums, social sharing of the PWA link — not via a caseworker intermediary.

### Secondary — none required for v1
The original design assumed an NGO caseworker as trust-intermediary and distribution channel. In the standalone version, **that role is absorbed by the product itself**: the consent screen, disclaimer, and "not legal advice" framing have to do the trust-building work that a caseworker would otherwise provide. This raises the bar on UI/UX clarity (see `04_UI_UX_WORKFLOW.md`) since there's no human in the loop to explain the tool before first use.

If a caseworker or advocate does discover and use the tool with a client, that's a welcome bonus distribution path — but it is **not required, assumed, or built for** in v1.

---

## 6. User stories

- As a user, I photograph a document and hear what it means in my language before I sign.
- As a user, the app flags clauses affecting my rights/money so nothing buried catches me out.
- As a user, I'm told plainly my photo goes to the cloud and is deleted — I consent with open eyes, without needing anyone to explain it to me first.
- As a user with a blurry photo, I get clear retake guidance.
- As a user, I can re-hear or re-read the summary at my own pace.
- As a user, I trust the app because it's transparent about not storing my document and not giving legal advice — that trust has to be earned entirely through the product, since there's no trusted human introducing me to it.

---

## 7. Requirements (MoSCoW)

| # | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | Camera capture inside mobile browser, no install | Must | Multi-page later |
| R2 | Explicit in-language cloud-processing consent before capture | Must | Gate + logged. Does double duty as the "trust-building" step normally handled by a caseworker |
| R3 | Async OCR/extraction via background job (no browser timeout) | Must | Trigger.dev queue |
| R4 | Plain-language simplification + translation | Must | Gemini 3.5 Flash |
| R5 | Detect/surface attention-worthy clauses (obligations, deadlines, penalties) | Must | Never "advice" |
| R6 | Audio playback of summary in target language | Must | TTS engine |
| R7 | Image deleted immediately post-processing, no archive | Must | Privacy guardrail, verifiable |
| R8 | Image-quality guidance + retake + confidence signal | Must | De-risks #1 risk (OCR) |
| R9 | Persistent in-language "not legal advice" disclaimer | Must | Liability guardrail |
| R10 | Readable text summary alongside audio, replay/scrub | Should | Accessibility |
| R11 | One-tap comprehension confirmation + emoji feedback | Should | Feeds North Star + evals |
| R12 | Language/dialect picker limited to validated set | Should | No over-promising |
| R13 | Multi-page document capture | Could | Defer if it slows v1 |
| R14 | Save/share summary; offline replay of last result | Could | Tension with no-storage stance |
| R15 | Self-serve onboarding (short in-app explainer, first-run only) | Should | **New for standalone version** — replaces the trust/explainer role a caseworker would play |

---

## 8. Acceptance criteria (Given/When/Then)

**Consent (R1, R2)**
- Given a first-time user reaches capture, When they arrive, Then an in-language consent notice blocks capture until accepted.
- Given consent declined, When user tries to proceed, Then no upload occurs and a plain explanation is shown.

**Extraction quality (R3, R8)**
- Given a blurry/cropped/low-light photo, When processing runs, Then user gets a specific retake prompt, not a wrong summary.
- Given no readable text found, When processing completes, Then an empty-state explains this and offers retake — never a fabricated summary.
- Given low-but-nonzero confidence, When summary is shown, Then a visible "low confidence — double-check" indicator appears.

**Simplification & playback (R4, R5, R6, R9)**
- Given text extracted, When summarized, Then output is in the user's language, plain reading level, with attention-clauses listed separately.
- Given a summary is displayed, Then the "comprehension support, not legal advice" disclaimer is visible in-language.
- Given summary ready, When user taps play, Then audio plays in target language; if unsupported, readable fallback + notice shown.

**Privacy (R7)**
- Given a job ends (success or failure), Then the source image is deleted within the defined window and deletion is logged/verifiable.

**Onboarding (R15)**
- Given a first-time visitor, When they land on the app, Then a short (≤3-screen) explainer shows what the app does, what it doesn't do, and what happens to their photo — before consent is even shown.

---

## 9. AI spec (eval-driven)

**AI does:** OCR/extraction, cleanup, translation, plain-language rewriting, clause flagging.
**AI must not:** give legal advice, predict outcomes, guess illegible text, invent obligations/dates/amounts.

**Model:** Gemini 3.5 Flash (3.1 Flash-Lite for cost) — multimodal OCR + large context in one call. In code the model is pinned to the `gemini-flash-latest` alias, which always resolves to Google's current Flash.
**Approach:** Structured prompting, strict output schema: `extracted_text, summary, attention_clauses[], confidence`. Grounded strictly in extracted text — no outside knowledge.
**Why not fine-tune yet:** Prompt + schema iterates faster during discovery; revisit only if evals plateau below target.

**Golden set — self-sourced (no partner document supply):**
Build 30–50 evaluation documents from sources that don't require an institutional partner:
- Publicly available contract/lease/employment-form **templates** (government sites, legal-aid publishers, sample-document banks)
- The builder's own real documents, manually redacted of any personal identifiers
- Synthetic documents: realistic contracts/forms generated (by the builder, or with LLM assistance) to cover clause types that are hard to find publicly (e.g. penalty clauses, arbitration clauses)
- Beta-group volunteers who opt in to share a redacted document for the eval set (explicit consent, separate from normal app usage)

Each golden-set document needs a human-written known-good summary + flagged-clause list, written by the builder (ideally cross-checked by at least one other person to catch blind spots).

| Quality dimension | Scoring | Ship threshold |
|---|---|---|
| Extraction accuracy | CER vs. ground truth (code) | ≤ 5% CER |
| Faithfulness (no hallucination) | LLM-as-judge + manual spot-check | ≥ 98% faithful |
| Critical-clause recall | vs. builder-labelled set (code) | ≥ 95% recall |
| Translation adequacy | LLM-as-judge + native-speaker review (recruit informally, e.g. from beta group) | ≥ 4/5 avg |
| Readability | Reading-grade metric | ≤ grade 6 |
| Safety / no-advice | Classifier + judge | 0 violations |

**Guardrails:**
- Never output legal advice; persistent disclaimer.
- Never guess illegible content — mark as "couldn't read this part."
- Refuse/limit on non-document images with clear empty state.
- Validate quality per language/dialect before shipping it.

**"What if it's wrong" UX:**
- Visible extraction-confidence signal.
- Show original photo/extracted text alongside summary for cross-check.
- One-tap retake + "this looks wrong."
- For high-stakes cases, explicitly suggest the user seek a human (free legal aid clinic, embassy/consulate service, community org) — the app can point to *generic* public resources without needing a formal partnership.

**Cost/latency budget:** ≤ $0.02/doc, ≤ 45s time-to-summary. Feedback ("looks wrong" reports, R11) reviewed manually by the builder and, where consented, added to the golden set.

---

## 10. UX principles

Mobile-first, low-literacy-friendly: large tap targets, icon + audio cues, minimal text, no account.

Key screens: **Onboarding explainer (new, R15)** → Capture (+ consent + framing guidance) → Processing/waiting → Result (audio + text + attention-clauses + confidence + disclaimer) → Error/retake/empty states (highest-trust-value screens, especially critical now that there's no human intermediary building trust).

Low-literacy usability testing required before public beta — recruit informally (friends, family, online communities) rather than through a partner organization.

---

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Budget Android + older browsers, intermittent data; p50 ≤20s / p90 ≤45s; graceful slow-network handling |
| Privacy | Immediate image deletion, no archive, data-minimizing logging, verifiable deletion |
| Consent | In-language disclosure before capture; clear statement of what's sent, where, for how long |
| Security | Encrypted transit/at-rest for transient data; least-privilege keys; single contractible TTS vendor |
| Accessibility | Audio-first, large targets, high contrast, screen-reader friendly |
| Compliance | Treat documents as sensitive personal data by default; follow general data-protection best practice (e.g. GDPR-style minimization) even without a formal compliance review, since there's no partner legal team to lean on |
| Cost | ≤ $0.02/doc; degrade to Flash-Lite / cheaper TTS under budget pressure — **cost discipline matters more here since this is self-funded** |
| Scale | Queue absorbs spikes without browser timeouts; retry/failure UX; full observability |

*(Full stack + cost model → see `02_TRD.md`)*

---

## 12. Risks & dependencies

**Dependencies:** Third-party services only — Gemini API, Supabase, Trigger.dev, TTS vendor. **No institutional/NGO dependency** — this is the key structural difference from the original design.

**Key risks:**
1. **OCR accuracy on real photos** — core product risk. Mitigate: capture guidance, retake prompts, confidence checks.
2. **Legal-interpretation liability** — mitigate with disclaimer + careful, conservative prompt design (and, if feasible, an informal review by anyone with legal-adjacent knowledge, even without a formal partner).
3. **Language/dialect coverage** — uneven LLM/TTS support; validate before promising. Language choices now driven by builder's own network/reach rather than partner caseload.
4. **No trust intermediary** — without a caseworker vouching for the tool, the product itself must earn user trust entirely through clear consent, transparent privacy behavior, and credible design. This raises the bar on R2, R9, and R15.
5. **Sourcing enough real-world test documents** — without partner-supplied documents, the golden set may skew toward templates/synthetic documents rather than messy real-world photos. Mitigate by prioritizing self-sourced real documents and beta-volunteer submissions over synthetic ones where possible.
6. **Distribution** — no built-in channel (a partner would have provided one). Growth depends on word-of-mouth, community sharing, and possibly light organic marketing (e.g. posting in relevant communities, a simple landing page).

**Riskiest assumption:** the model can extract + faithfully simplify real, messy, multilingual phone photos well enough to be trusted on high-stakes documents — *and* that the product alone (without a human intermediary) can build enough user trust to get people to actually use it on documents that matter.

**Cheapest test:** run the self-sourced golden set through the model before building any UI; score against §9 thresholds. Separately, informally test the consent/onboarding screens with a few real people to see if they'd trust the flow without anyone explaining it to them.

**Open questions:**
- Which language/dialect pairs ship first (driven by builder's own network reach)?
- How to recruit a meaningful beta group without an institutional channel?
- How to verify "understanding" without burdening a low-literacy user, and without a caseworker to help interpret feedback?
- Multi-page in v1 or fast-follow?

---

## 13. Out of scope / future

- Expanded validated language/dialect coverage
- Offline/on-device processing
- Model-selection policy + eval gate for model swaps
- Saved/shareable summaries, "bring this to someone you trust" handoff
- Guided help on common form types (carefully, given no-advice stance)
- **Future possibility, not v1:** if an NGO or community org does express interest later, the architecture (no accounts, session-based, privacy-first) is already compatible with that kind of partnership being added on top — but v1 is built to stand entirely on its own.

---

## 14. Rollout plan (evidence-gated, not calendar-gated)

| Phase | What happens | Exit criterion |
|---|---|---|
| 0 — Eval first | Run self-sourced golden set through model, no UI | Meets §9 thresholds on chosen languages |
| 1 — Private beta | Small build behind a flag; tested by builder + a self-recruited beta group (friends, family, relevant online communities) | ≥70% flow completion, ≥80% comprehension, 0 safety violations |
| 2 — Public soft launch | Public PWA link shared informally (social media, relevant communities, forums); no paid distribution yet | Metrics hold with a larger, less-curated user base; cost ≤ budget |
| 3 — Open access / iterate | Fully public, iterate on languages and features based on real usage data | Sustained North Star growth; guardrails green |

**Launch checklist:** eval suite green on shipping languages · disclaimer copy reviewed per language (informally, by a native speaker if possible) · image-deletion verified end-to-end · monitoring live · rollback/kill-switch tested.
