# EquiDoc — Test Documents

Six fictional but realistic formal documents (PDF) for exercising the EquiDoc
flow (photo → analyze → summary + key facts + clause flags + audio + chat) and
finding bugs. All names, addresses, case numbers, and companies are invented —
these are test fixtures, not real records.

**How to use:** open a PDF on a second screen (or print one page), then point the
app's camera at it — or use the app's gallery/file fallback to feed the PDF/photo
into `/api/analyze`. Each document is chosen to stress a different part of the
pipeline.

## The documents

| # | File | Type | What it stresses / bugs to hunt |
|---|------|------|----------------------------------|
| 1 | `01_eviction-notice.pdf` | Notice to Vacate | **Hard deadline + urgency.** Does it surface the *14-day / 17 Mar 2026* deadline and flag the eviction consequence + `$50/day` late charge as "worth paying attention to"? |
| 2 | `02_medical-consent.pdf` | Surgical consent | **Sensitive content + jargon.** "laparoscopic cholecystectomy" → plain words? Does the risk list survive? Does it over-refuse or mishandle the death-risk line? |
| 3 | `03_loan-agreement.pdf` | Personal loan (TILA) | **Numbers, tables, fine print.** Multiple money amounts (`$5,000` / `$297.79` / `34.99%` / `$7,146.88`) — does it mix them up? Are the fee table, auto-renewal, and arbitration/class-action waiver flagged? |
| 4 | `04_benefits-denial.pdf` | Benefits denial letter | **Reference numbers + appeal deadline.** Extracts Case No. `FA-3390-77812` and the *30-day / 5 Apr 2026* appeal deadline? Frames the appeal path clearly? |
| 5 | `05_employment-contract.pdf` | Job offer + terms | **Obligation clauses.** Non-compete (12 mo / 50 mi), at-will, 90-day probation, `$85` uniform payroll deduction — are the ones that bind *you* flagged? |
| 6 | `06_aviso-corte-servicio_ES.pdf` | Utility cut-off (Spanish) | **Non-English source + translation.** Source is Spanish with accents (á/é/ñ). If UI language ≠ Spanish, does translation work? Currency + `$187.50` / `$75` / `19 mar 2026` deadline preserved? |

## Suggested bug-hunting checklist

- **Deadlines:** every doc has an explicit deadline — is it extracted, and is the *urgency* conveyed? (docs 1, 3, 4, 6)
- **Money accuracy:** doc 3 has 8+ distinct amounts. Confirm the app never swaps principal for total, or an APR for a fee.
- **Clause flagging precision:** the arbitration waiver (3), non-compete (5), deposit forfeiture (1) should be flagged; boilerplate should not drown them out.
- **Reference/case numbers:** docs 1, 3, 4, 5, 6 each carry an ID the user needs to keep — does the app preserve it verbatim?
- **Translation round-trip:** run doc 6 with several UI languages, including a right-to-left one (Arabic/Urdu) — check layout + that Spanish→target actually happens.
- **Chat grounding:** ask specifics ("How much do I owe?", "What's the deadline?", "Can I still sue them?") — answers should match the doc, not hallucinate.
- **Comprehension / consent gates:** doc 2 is consent-heavy — does the app's own consent/"I understand" step behave sensibly around medical risk?
- **Long / 2-page docs:** each PDF is 1–2 pages — watch for truncation or a dropped second page.
- **Fallback path:** with no `GEMINI_API_KEY`, confirm the built-in sample still renders end-to-end for every doc.

## Regenerating

Sources are generated from `scratchpad/build_docs.py` (HTML → PDF via headless
Chrome). Edit that script and re-run to tweak the documents.
