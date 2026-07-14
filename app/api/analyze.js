export const config = {
  maxDuration: 60, // allow up to 60s for Gemini API processing
}

const MODEL = 'gemini-flash-latest'

// Documents we read (evictions, contracts, medical, benefits) legitimately contain
// harsh legal wording. Turn off Gemini's content blocking so a real document is never
// refused — our job is to explain it faithfully, not to moderate it.
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Canonical EquiDoc prompt. Keep this IN SYNC with the copy in vite.config.js
// (the local dev proxy). The goal is not just to say what the document means,
// but to tell the reader — in their language, simply — what they can do about it.
function buildPrompt(lang, today) {
  return `You are EquiDoc, a calm, trustworthy helper for migrant and blue-collar workers who find official documents confusing or intimidating. A document (it may span several photos) is attached — read every page in order. Today's date is ${today}.

Your job is not only to explain what the document SAYS, but to help the reader understand what it MEANS for them and what they can do about it.

Step 1 — Read: transcribe the document into "raw_transcription". Do not skip fine print, numbers, names, or dates.
Step 2 — Understand: work out the reader's obligations, rights, deadlines, and money — anything that affects their time, rights, or money.
Step 3 — Explain simply, in ${lang}: translate and rewrite everything at a CEFR A2 / 5th-grade level. Short sentences. No jargon. Speak TO the reader as "you".

How to explain well:
- Talk to the reader directly: "you must…", "this means you…". Never abstract or third-person.
- Deadlines: always give the exact date AND how urgent it is compared to today (e.g. "by 17 March — that is 4 days away"). Point out the single most important date.
- Money and time: when the document gives enough detail, add a short plain comparison so the number feels real (e.g. "$2,340 — about three months of rent"). Never invent a comparison the document does not support.
- Be honest and calm: do not frighten the reader, but do not hide bad news.
- Do NOT give legal advice or tell them what to decide. You MAY explain their options and who can help.

Respond with ONLY a valid JSON object in this EXACT structure:
{
  "raw_transcription": string,        // verbatim, for your own reasoning
  "readable": boolean,                // ALWAYS true; do your best even if blurry, dark, or cropped
  "confidence": "clear" | "partial",
  "docType": string,                  // simple 2-4 word title in ${lang}
  "summary": string,                  // 2-3 short, simple sentences in ${lang}: what this document is and what it wants from the reader
  "facts": [ { "emoji": string, "label": string, "value": string } ],  // 1-4 vital facts (dates, pay, deadlines) in ${lang}. Make deadlines and money concrete as described above. Labels under 3 words.
  "clauses": [ { "emoji": string, "title": string, "desc": string } ], // 0-4 conditions that affect the reader. "title" = the short warning; "desc" MUST explain the effect in second person and start with "This means you…" (or the natural ${lang} equivalent). in ${lang}
  "nextSteps": [ { "emoji": string, "text": string } ],  // 1-3 concrete, practical, NON-LEGAL actions the reader can take now, in ${lang}. Procedural only, e.g. "Do not sign today — you can take it home and read it first", "Call a free tenant helpline and ask for more time", "Keep this letter — you need the case number to appeal". Never a legal opinion or "you should sue".
  "glossary": [ { "term": string, "plain": string } ],   // 0-4 hard or official words you could not avoid. "term" = the word as it appears (in ${lang}); "plain" = a one-line simple meaning (in ${lang}). Empty array if everything is already simple.
  "helpResources": [ { "emoji": string, "who": string, "how": string } ], // 0-3 GENERIC free places the reader could turn to for THIS kind of document, in ${lang}. Resource TYPES ONLY — e.g. a free legal aid / advice clinic, a workers'-rights helpline, their country's embassy or consulate labour section, a trusted local community organisation. "who" = the type of place (a few words); "how" = one short line on what to ask them or what to bring. NEVER invent a specific phone number, website, address, or organisation name — types only.
  "checks": [ { "q": string, "yes": boolean } ],          // EXACTLY 2 simple yes/no comprehension questions in ${lang} that check the reader understood the MOST important points (e.g. a deadline, a cost, an obligation). "q" = the question, phrased so the answer is clearly yes or no. "yes" = true if the correct answer is "yes", false if the correct answer is "no". Concrete, answerable from the summary. Vary the answers — do not make both "yes".
  "originalText": string,             // 1-2 sentence excerpt of the most important part, in its ORIGINAL language
  "spoken": string                    // warm TTS script in ${lang}, spoken like a helpful person. Greet, give the summary, read the key facts plainly, warn clearly about anything worth attention, THEN say what the reader can do next, and end by gently reminding them this is not legal advice. Flow naturally — not a robot, not a bullet list.
}

CRITICAL RULES:
- Write ALL reader-facing fields (docType, summary, facts, clauses, nextSteps, glossary, helpResources, checks, spoken) ONLY in ${lang}.
- Keep everything at a 5th-grade reading level.
- Be objective and kind. Explain options and who can help, but do NOT give legal advice.`
}

// One call to Gemini, classified so the caller can decide whether to retry:
//   { kind: 'ok', json }                    — parsed a usable result
//   { kind: 'transient', status, message }  — 429/500/503/network: worth retrying
//   { kind: 'empty', finishReason, blockReason } — 200 but no usable JSON (bad output or a safety block)
//   { kind: 'fatal', status, message }      — e.g. bad key: retrying won't help
async function callGemini(key, body) {
  let r
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    return { kind: 'transient', message: String(e?.message || e) }
  }

  if (!r.ok) {
    const text = (await r.text()).slice(0, 600)
    if (r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503) {
      return { kind: 'transient', status: r.status, message: text }
    }
    return { kind: 'fatal', status: r.status, message: text }
  }

  const data = await r.json()
  const cand = data?.candidates?.[0]
  const finishReason = cand?.finishReason || null
  const blockReason = data?.promptFeedback?.blockReason || null
  let text = cand?.content?.parts?.[0]?.text || ''
  text = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  const jsonStr = s >= 0 && e > s ? text.slice(s, e + 1) : text
  try {
    return { kind: 'ok', json: JSON.parse(jsonStr) }
  } catch {
    return { kind: 'empty', finishReason, blockReason }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'no_key', message: 'Missing GEMINI_API_KEY environment variable on Vercel.' })

  const { image, images, language } = req.body
  const imageList = images || (image ? [image] : [])
  if (imageList.length === 0) return res.status(400).json({ error: 'no_image', message: 'No photo received.' })

  const lang = language || 'English'
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, for deadline urgency
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: buildPrompt(lang, today) },
        ...imageList.map((img) => ({ inlineData: { mimeType: 'image/jpeg', data: img } })),
      ],
    }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    safetySettings: SAFETY_SETTINGS,
  }

  // Balanced retry: transient errors (429/503/500/network) fail fast, so retry them
  // cheaply with backoff. An empty/blocked result costs a full re-analysis, so only
  // retry that while there's time left before the 60s function limit.
  const MAX_ATTEMPTS = 3
  const SLOW_RETRY_BUDGET_MS = 35000
  const startedAt = Date.now()
  let last = null

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const out = await callGemini(key, requestBody)
      if (out.kind === 'ok') return res.status(200).json(out.json)
      if (out.kind === 'fatal') {
        let message = out.message
        if (out.status === 400 && message.includes('API_KEY_INVALID')) message = 'Google AI Studio rejected the API key.'
        return res.status(502).json({ error: 'gemini_error', status: out.status, message })
      }
      last = out
      if (attempt === MAX_ATTEMPTS) break
      // Don't start a slow re-analysis if we're already low on time budget.
      if (out.kind === 'empty' && Date.now() - startedAt > SLOW_RETRY_BUDGET_MS) break
      await sleep(attempt * 1000) // 1s, then 2s
    }

    if (last?.kind === 'transient') {
      return res.status(503).json({ error: 'overloaded', message: 'The reader is very busy right now. Please try again in a moment.' })
    }
    // Exhausted on an empty/blocked result — return a clean "unreadable" (with diagnostics)
    // so the app shows the retake screen, never a fabricated summary.
    return res.status(200).json({
      readable: false, confidence: 'partial', docType: '', summary: '', facts: [], clauses: [],
      nextSteps: [], glossary: [], originalText: '', spoken: '',
      finishReason: last?.finishReason || null, blockReason: last?.blockReason || null,
    })
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: String(err?.message || err) })
  }
}
