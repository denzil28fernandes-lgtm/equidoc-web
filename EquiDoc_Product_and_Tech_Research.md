# EquiDoc — Product & Tech Research

*Prepared for the EquiDoc team ahead of an NGO deployment. Status: pre-build research (no production code yet, per Guru's direction).*

*Last updated: 16 June 2026*

---

## 0. Purpose of this document

Guru asked us to **not start building yet** and instead do proper product and tech research before committing to production code, because he's lining up an NGO to deploy this with. This document does two things:

1. **Product research** — defines exactly what EquiDoc needs to do, who uses it, what the screens and features are, and what the NGO actually needs from it.
2. **Tech research** — validates (and corrects) the proposed architecture, settles the model and text-to-speech questions, and gives a realistic cost model.

It ends with the key risks and a recommended phased plan.

---

## 1. The problem (restated sharply)

Migrant and blue-collar workers regularly sign or discard high-stakes paperwork — employment contracts, housing agreements, health and safety guidance — without understanding it, because of **language barriers** and **varying literacy levels**. That creates a real asymmetry in legal and personal rights.

The job EquiDoc does for the user: *"Take a photo of a document I can't read, and tell me — out loud, in my language — what it actually says and whether anything in it is bad for me."*

Two distinct users:

- **The end-user (worker):** low digital literacy, possibly low textual literacy even in their own language, a cheap Android phone, intermittent data, speaks one of many possible languages. Needs the answer *spoken*, fast, and trustworthy.
- **The NGO (operator/distributor):** wants to put this in front of the people they serve, possibly assist them in person, and trust that it's safe, private, and won't give dangerously wrong advice. They are the deployment channel and the credibility gatekeeper.

Designing for both is the core product challenge.

---

## 2. Product research

### 2.1 Core user journey (end-user)

1. **Open** the web app (a link, a QR code from the NGO, or a saved home-screen icon — no app store).
2. **Choose language** once (remembered after that). This must be possible with flags/native-script labels, not English-only text.
3. **Snap** a photo of the document with the phone camera (or pick from gallery).
4. **Wait** with a clear, reassuring progress state (this is where the heavy lifting happens).
5. **Listen** — the app reads a simplified summary aloud in the user's language, and highlights anything risky.
6. **Re-listen / next steps** — replay, slow down, or get a short "what you should do" prompt (e.g. "don't sign yet — ask someone you trust about clause 4").

### 2.2 Feature set — MVP vs later (MoSCoW)

**Must have (v1 / demo / first NGO pilot)**

- Camera + gallery capture, mobile browser.
- One-tap language selection with native-script + audio labels.
- Photo → text extraction → simplification → translation → **spoken** output.
- Clear, slow, replayable audio with a visible simplified-text transcript alongside.
- A plain-language "summary + key points" structure (not a wall of text).
- Privacy by default: image deleted after processing; clear messaging about that.

**Should have**

- Risk/"watch out" flagging (predatory clauses, deadlines, money owed) — *clearly framed as "things to check," not legal advice* (see §4).
- Offline-friendly behaviour / graceful failure on bad connections.
- "Ask a question about this document" follow-up.

**Could have**

- Save/history of past documents (raises privacy stakes — only if justified).
- NGO-assisted mode (a caseworker helps the worker, sees a dashboard).
- Document-type detection (contract vs medical vs housing) to tailor the summary.

**Won't have (for now)**

- Anything that looks like binding legal advice or that auto-fills/signs documents.
- Accounts/logins for end-users in v1 (friction + privacy risk).

### 2.3 UX principles for low-literacy, low-end users

- **Audio-first, text-second.** Assume the user may not read well. Every important action should be reachable without reading English.
- **One primary action per screen.** Big camera button. Big play button. Minimal chrome.
- **Iconography + native script + voice prompts**, not English labels.
- **Forgiving capture.** Auto-handle skew, glare, multi-page; let them re-take easily.
- **Honest progress + trust cues.** Tell them what's happening and that their photo is private and will be deleted.
- **Designed for cheap Android + Chrome**, small screens, slow networks, limited storage.

### 2.4 What the NGO actually needs (don't skip this)

This is the difference between "a cool demo" and "a deployed product." Questions to confirm with Guru/the NGO:

- **Who are their people and what languages** do they actually serve first? (Drives the priority language list.)
- **Assisted or self-serve?** Will a caseworker be present (changes the UX a lot)?
- **Distribution:** QR codes at a centre? A link over WhatsApp? Posters?
- **Liability comfort:** how strongly do they want "this is not legal advice" framing?
- **Data/privacy expectations:** are they okay with documents touching a cloud (Gemini, Supabase) at all, given how sensitive these are?
- **Success metric:** what does "this worked" mean to them — documents understood, people who avoided signing something bad, time saved by caseworkers?

---

## 3. Tech research

### 3.1 Architecture at a glance (proposed)

```
[ Phone camera / browser (Next.js PWA) ]
                │  upload image
                ▼
[ Supabase Storage + Postgres ]
                │  trigger job
                ▼
[ Background worker (Trigger.dev?) ]
                │  call multimodal model
                ▼
[ Gemini 3.x — OCR + clean + translate + simplify + flag ]
                │  structured response
                ▼
[ Client renders simplified text + plays audio ]
                ▲
        [ Text-to-Speech: browser API OR cloud TTS ]  ← see §3.3, this is the big decision
```

The shape is sound. Two parts of the original brief need correcting: the **model** (§3.2) and the **TTS approach** (§3.3).

### 3.2 The AI model — correction + recommendation

**Gemini 1.5 Flash is fully retired.** As of 2026 the entire Gemini 1.5 family is shut down and API calls return **404 errors** — so it cannot be used even "just for testing." This needs to change in the plan before anyone wires it up.

Current options (Gemini API pricing, mid-2026):

| Model | Input / Output ($ per 1M tokens) | Best for |
|---|---|---|
| **Gemini 3.1 Flash-Lite** | $0.25 / $1.50 | Cheapest, fast, high RPM — the true replacement for "1.5 Flash for testing" |
| **Gemini 3.5 Flash** | $1.50 / $9.00 | Best accuracy/cost balance for messy document photos + risk flagging |
| Gemini 3.1 Pro | $2.00 / $12.00 | Overkill for this; only if quality demands it |

**Recommendation:** prototype on **3.1 Flash-Lite** (matches the "fast + high RPM for testing" intent Guru wanted from 1.5 Flash), and benchmark **3.5 Flash** on real document photos for the production summary/risk-flagging path. Keep the model behind one config switch so swapping is trivial.

**On OCR quality (good news):** recent benchmarks show modern multimodal LLMs (Gemini included) **match or beat traditional OCR** on real-world photos, handwriting, low-quality scans, creases, and glare — they "look past the noise" better than classic OCR. So a separate OCR engine is likely **not needed**; Gemini can do extract-clean-translate-simplify in one call.

**One real limitation:** accuracy drops below ~150 ppi. Translation: **image capture quality matters.** Budget effort for good camera capture (resolution, framing guidance, anti-glare) — it's more important than the model choice.

### 3.3 ⚠️ The biggest finding: "free browser TTS for many languages" does not hold up

The brief assumes the **Web Speech API** (browser built-in text-to-speech) delivers zero-cost audio in the user's language. For a multi-language product on **cheap Android phones in the field, this is the project's biggest technical risk:**

- Browser TTS **doesn't ship its own voices** — it uses whatever voices are **installed on that specific device's OS**.
- **Cheap Android phones have limited storage and often lack language voice packs.** Availability varies device to device, and the user may need to manually download a voice pack — exactly the friction we're trying to remove.
- Voice lists also **differ by browser** (Google voices only in Chrome, etc.).
- Net effect: on the exact devices our users have, the language we need **may simply not be available**, and we can't guarantee it.

Since our priority languages are **major world languages + migrant-worker languages (Tagalog, Bahasa, Nepali, Bengali, Urdu, Arabic, Amharic, etc.)**, relying on per-device voices is too fragile.

**Recommended approach: cloud TTS with browser TTS as a fallback.**

| Option | Coverage | Cost | Reliability on cheap phones |
|---|---|---|---|
| **Web Speech API (browser)** | Whatever's installed on the device | Free | ❌ Unreliable / inconsistent per device |
| **Google Cloud TTS** | 75+ languages incl. Bengali, Filipino, Nepali, Urdu (verify Amharic) | ~$4 / 1M chars (Standard), $16/M (Neural) | ✅ Consistent — server-side |
| Azure / ElevenLabs | Broad, varies | Varies | ✅ Consistent |

Generating audio **server-side** and streaming an audio file to the phone gives **consistent, guaranteed** voices regardless of device — which is the whole accessibility promise. The cost is small (see §3.5). Keep browser TTS as a zero-cost fallback for the well-supported languages, but **don't depend on it.**

> Action item for the group: confirm **Amharic** coverage on the chosen TTS provider — it's the one language above whose support I couldn't confirm. Some lower-resource languages may have no good TTS anywhere, which would shape the launch language list.

### 3.4 Stack validation: Next.js / Supabase / Trigger.dev

- **Next.js 15 PWA** — good fit. PWA = install-to-home-screen without an app store, works on cheap Android Chrome. Right call.
- **Supabase (Postgres + Storage)** — reasonable for sessions and temporary image hosting. The important design choice is a **strict retention/auto-delete policy** on Storage (see §3.6).
- **Trigger.dev (async orchestration)** — *probably not needed for v1.* A single document photo → one model call → one TTS call typically completes in a few seconds, well within a normal serverless request. Async job queues add real complexity. **Recommendation:** start with a simple server action / API route. Introduce Trigger.dev only if/when (a) processing genuinely exceeds request timeouts, (b) we batch multi-page documents, or (c) volume needs queueing. Don't pay the complexity cost up front.

### 3.5 Cost model (per document)

Rough back-of-envelope, one ~one-page document:

- **Model (Gemini):** ~$0.002 per doc on Flash-Lite, ~$0.01 on 3.5 Flash.
- **Cloud TTS:** a ~1,000–1,500 char spoken summary ≈ $0.004–$0.006 (Standard) or ~$0.02–$0.024 (Neural).
- **Supabase storage:** negligible (images deleted quickly).

**≈ $0.01–$0.04 per document**, depending on model + voice quality. At a few thousand documents/month this is **single-digit to low-tens of dollars** — genuinely cheap, but **not literally zero**, so someone needs to own the API keys and a (small) budget. The "zero cost" promise holds **for the end-user**, not for us running it.

### 3.6 Privacy, data & safety architecture (must get right for an NGO)

These are legal, medical, housing and immigration documents — among the most sensitive data a person has.

- **Delete images by default**, immediately after processing. No long-term storage unless there's a clear, consented reason.
- **Minimise retention** of extracted text too; if we cache, encrypt and expire it.
- **Be explicit to the user** (in their language, by voice) that the photo is private and deleted.
- **Disclose cloud processing.** The image does go to a cloud model (Gemini) — the NGO must be okay with that. If not, that's a major architectural constraint to surface now.
- **No accounts in v1** = less personal data to hold = less risk.

### 3.7 The "predatory clause" feature — handle with care

Flagging predatory clauses / critical deadlines is the most *valuable* feature and the most *dangerous* one:

- LLMs can miss or hallucinate clauses; a **false "this is safe"** could cause real harm.
- Anything resembling **legal advice carries liability**, especially via an NGO.

**Recommendation:** frame it as **"things to double-check"**, never "this is legal advice." Always pair it with "show a trusted person / the NGO before signing." Decide with Guru whether this is in the v1 demo or a fast-follow once accuracy is validated on real documents.

---

## 4. Key risks & open decisions

| # | Risk / decision | Why it matters | Recommendation |
|---|---|---|---|
| 1 | **1.5 Flash is dead (404)** | Blocks any current build | Switch to 3.1 Flash-Lite (proto) / 3.5 Flash (prod) |
| 2 | **Browser TTS unreliable per device** | Breaks core promise for many languages | Use cloud TTS server-side; browser TTS as fallback only |
| 3 | **Sensitive documents in the cloud** | NGO trust + legal exposure | Delete-by-default, disclose cloud use, confirm NGO is OK with it |
| 4 | **Predatory-clause = pseudo-legal-advice** | Liability + harm from errors | Frame as "check this," not advice; validate before launch |
| 5 | **Launch language list undefined** | Drives TTS feasibility + testing | Get the NGO's actual first languages; confirm each has TTS |
| 6 | **Capture quality > model quality** | OCR fails below ~150 ppi | Invest in camera UX (framing, glare, resolution) |
| 7 | **Async orchestration may be premature** | Trigger.dev adds complexity | Start simple; add queues only when needed |
| 8 | **Who pays / owns API keys** | Not literally zero-cost | Assign owner + small budget |

---

## 5. Recommended next steps (research → build)

1. **Confirm scope with NGO + Guru:** first languages, assisted vs self-serve, distribution channel, privacy comfort, success metric (§2.4).
2. **Lock the model + TTS decisions:** Flash-Lite/3.5 Flash + cloud TTS, behind config switches. Verify TTS coverage for each launch language (esp. Amharic).
3. **Build one bulletproof flow** end-to-end before breadth: e.g. *photo of an English employment contract → spoken summary + "check these" points in one confirmed-supported language*.
4. **Prototype camera capture** early — it's the quality bottleneck.
5. **Write the privacy/retention policy** (delete-by-default) and the "not legal advice" framing before any real documents are processed.
6. **Defer Trigger.dev** until a real timeout/volume reason appears.
7. **Validate risk-flagging accuracy** on a set of real (anonymised) documents before promising it.

---

## Sources

- [Gemini API release notes / changelog (1.5 & 2.0 shutdowns)](https://ai.google.dev/gemini-api/docs/changelog)
- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)
- [Google retires Gemini 2.0 Flash → 2.5 Flash](https://aiweekly.co/alerts/google-retires-gemini-20-flash-001-replace-with-25-flash)
- [Gemini 3.5 Flash API pricing](https://devtk.ai/en/models/gemini-3-5-flash/)
- [Gemini 3.1 Flash-Lite API pricing](https://devtk.ai/en/models/gemini-3-1-flash-lite/)
- [Web Speech API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Web Speech API supported voices/languages](https://docs.merkulov.design/text-to-speech-supported-voices-and-languages/)
- [Android TTS depends on installed system voices (Android Developers)](https://android-developers.googleblog.com/2009/09/introduction-to-text-to-speech-in.html)
- [Google Cloud Text-to-Speech — supported voices & languages](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- [OmniAI OCR benchmark (VLMs vs traditional OCR)](https://getomni.ai/blog/ocr-benchmark)
- [Context-independent OCR with multimodal LLMs — resolution effects](https://arxiv.org/pdf/2503.23667)
- [Can Google Gemini read scanned documents — OCR limits](https://www.datastudios.org/post/can-google-gemini-read-scanned-documents-ocr-capabilities-and-accuracy-limits)
