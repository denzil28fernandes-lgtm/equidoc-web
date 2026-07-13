export const config = {
  maxDuration: 60, // allow up to 60s for Gemini API processing
}

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
  "originalText": string,             // 1-2 sentence excerpt of the most important part, in its ORIGINAL language
  "spoken": string                    // warm TTS script in ${lang}, spoken like a helpful person. Greet, give the summary, read the key facts plainly, warn clearly about anything worth attention, THEN say what the reader can do next, and end by gently reminding them this is not legal advice. Flow naturally — not a robot, not a bullet list.
}

CRITICAL RULES:
- Write ALL reader-facing fields (docType, summary, facts, clauses, nextSteps, glossary, spoken) ONLY in ${lang}.
- Keep everything at a 5th-grade reading level.
- Be objective and kind. Explain options and who can help, but do NOT give legal advice.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'no_key', message: 'Missing GEMINI_API_KEY environment variable on Vercel.' })

  const MODEL = 'gemini-flash-latest'
  const { image, images, language } = req.body
  const imageList = images || (image ? [image] : [])
  if (imageList.length === 0) return res.status(400).json({ error: 'no_image', message: 'No photo received.' })

  const lang = language || 'English'
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, for deadline urgency
  const prompt = buildPrompt(lang, today)

  try {
    const imageParts = imageList.map(img => ({ inlineData: { mimeType: 'image/jpeg', data: img } }))
    
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    })

    if (!r.ok) {
      const text = await r.text()
      return res.status(502).json({ error: 'gemini_error', message: text.slice(0, 600) })
    }

    const data = await r.json()
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    text = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    const jsonStr = s >= 0 && e > s ? text.slice(s, e + 1) : text
    
    try {
      return res.status(200).json(JSON.parse(jsonStr))
    } catch {
      return res.status(200).json({ readable: false, confidence: 'partial', docType: '', summary: '', facts: [], clauses: [], originalText: '', spoken: '' })
    }
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: String(err?.message || err) })
  }
}
