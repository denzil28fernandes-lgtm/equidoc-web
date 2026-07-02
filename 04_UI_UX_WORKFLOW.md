# UI/UX Workflow — EquiDoc

Design principles from PRD §10: mobile-first, low-literacy-friendly, audio-first, large tap targets, minimal text, no accounts. **Error/retake/empty states are the highest-trust-value screens — treat them as first-class, not afterthoughts.**

---

## 1. Full flow (happy path)

```
[Landing] → [Onboarding explainer] → [Language Select] → [Consent] → [Capture] → [Processing]
    → [Result: audio + text + clauses + confidence + disclaimer]
    → [Feedback: "Do you understand this now?"]
    → [Done / Capture another]
```

**Note on standalone design:** in the original design, an NGO caseworker introduced the tool to a client and answered "wait, what is this?" questions before first use. There's no caseworker here, so the **onboarding explainer (R15) is a new, load-bearing screen** — it has to do that trust-building work on its own, first-run only (skippable on repeat visits).

---

## 2. Screen-by-screen

### 2.1 Landing
- App name/icon, one-sentence explanation with an icon (camera → speech bubble → ear), no login.
- Single primary CTA: "Start" / large camera icon button.
- No text wall. Icon-led.

### 2.1a Onboarding explainer (R15 — first-run only)
- 2–3 lightweight, icon-led screens (swipe or auto-advance), shown once per session/device:
  1. "Take a photo of a document you don't understand" (icon: camera + confusing paper)
  2. "We'll read it and explain it in your language, out loud" (icon: speech bubble + ear)
  3. "Your photo is never kept — it's deleted right after" (icon: photo → trash, reassuring not alarming)
- Skippable after first view — do not force returning users through it again.
- This screen exists specifically to replace the human introduction a caseworker would otherwise give.

### 2.2 Language select
- Grid of language names in **their own script** (not just English labels) — e.g. "العربية," "தமிழ்," "Kreyòl" — so a low-literacy-in-English user can recognize their own language visually.
- Limited to the validated allow-list (R12) — do not show languages that haven't passed eval.
- Selection persists to session (`preferred_language`).

### 2.3 Consent (R2 — hard gate)
- Plain-language, in selected language: "Your photo is sent to a secure service to read it, then deleted. We do not keep your document." — icon of photo → cloud → trash can, animated or static illustration.
- Two large buttons: "I agree, continue" / "No, don't continue."
- **Decline path:** no upload occurs; shows a plain explanation screen (not a dead end — link back to Landing).
- Every consent shown/answered is logged (`consents` table) regardless of outcome.

### 2.4 Capture
- Full-screen camera viewfinder (native `<input type="file" capture="environment">` or camera API).
- Live framing guidance overlay: corner guides, "hold steady," "avoid glare" hints — proactive, not just reactive to a bad photo.
- Large shutter button, easy for a nervous/rushed user to hit.
- Retake affordance always visible after capture, before upload confirmation ("Use this photo" / "Retake").

### 2.5 Processing / waiting
- Sets expectation explicitly: a simple animated indicator + text like "Reading your document... this takes about 20 seconds."
- No spinner with no context — anxiety during this wait is a real UX risk for a user trusting a stranger's document to a phone.
- If it runs past p90 (45s), show a reassurance message ("Still working — complex documents take a bit longer") rather than letting it look frozen.

### 2.6 Result screen (the core screen)
Layout, top to bottom:
1. **Confidence indicator** (if low) — visible banner: "We're not 100% sure we read this correctly — please double-check." (only shown when confidence below threshold)
2. **Audio player** — big play/pause, scrub bar, replay button. This is the primary consumption mode.
3. **Readable text summary** (R10) — same content as audio, for anyone who wants to read/screen-read it, or share screen with someone else.
4. **Attention-clauses list** — visually distinct card/section (e.g. amber accent, warning icon — but not alarming/red, to avoid implying legal danger). Each clause: short excerpt + why it matters (deadline/penalty/obligation/rights).
5. **"See original photo / extracted text"** toggle — lets a trusted friend, family member, or community advocate cross-check against source, since there's no caseworker in the loop by default.
6. **Persistent disclaimer** (R9) — small but always visible, not hidden in a footer link: "This helps you understand your document. It is not legal advice."
7. **Actions row:** "Retake / try again," "This looks wrong" (one tap), "I understand this now" (comprehension confirmation, feeds R11 + North Star).

### 2.7 Error / empty states
| Situation | Screen behavior |
|---|---|
| Blurry/low-light/cropped photo | Specific retake prompt: "Move closer" / "Avoid glare" / "Include the whole page" — never a guessed summary |
| No document detected in image | Empty state: "We couldn't find a document in this photo" + retake CTA |
| Low but nonzero confidence | Result screen shown *with* visible low-confidence banner, not blocked |
| Network failure / job failed | Plain retry screen, no technical jargon, offer retake or "try again" |
| Unsupported audio language | Fallback to readable text + explicit notice: "Audio isn't available in this language yet — here's the written summary" |

### 2.8 Feedback / comprehension check
- One-tap emoji-based or binary "Yes, I understand" / "No, I'm still confused" — deliberately lightweight, not a quiz that could shame a low-literacy user.
- Optional "this looks wrong" flag routes to the eval feedback loop (with consent, may join golden set).

---

## 3. State machine (client-visible states)

```
IDLE
  → LANGUAGE_SELECTED
    → CONSENT_PENDING
      → CONSENT_DECLINED (terminal, offers restart)
      → CONSENT_ACCEPTED
        → CAPTURING
          → UPLOAD_PENDING
            → QUEUED
              → PROCESSING
                → DONE                 (→ show full result)
                → LOW_CONFIDENCE       (→ show result + warning banner)
                → NO_TEXT_FOUND        (→ empty state + retake)
                → FAILED               (→ retry screen)
```

---

## 4. Accessibility checklist

- Minimum tap target size ~44×44px, generously spaced.
- High contrast mode by default (this is not an optional theme — it's the default given target users may have low vision).
- All icons paired with short text labels, not icon-only navigation.
- Screen-reader labels on every interactive element, tested with a real screen reader before pilot.
- Audio playback controls fully operable without reading (icon-based play/pause/replay).
- No time-limited interactions except the AI processing wait itself (no session-expiry pressure during reading/listening).

---

## 5. Content/copy rules

- All user-facing copy (consent, disclaimer, error states) must exist in every validated `target_language` — no partial translation of critical trust screens.
- Reading level target for all UI copy: plain, short sentences — same bar as the AI's own output (~grade 6).
- Never use legal or technical jargon in UI copy, even to describe what the app does.

---

## 6. Pre-pilot validation requirement

Per PRD §10: **low-literacy usability testing is required before pilot**, specifically on:
- Consent screen comprehension (do users understand what they're agreeing to?)
- Capture flow completion without assistance
- Whether the attention-clauses framing reads as "advice" to real users (liability risk check)
