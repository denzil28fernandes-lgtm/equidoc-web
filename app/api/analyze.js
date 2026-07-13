export const config = {
  maxDuration: 60, // allow up to 60s for Gemini API processing
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
  const prompt = `You are EquiDoc, an empathetic assistant helping migrant and blue-collar workers understand complex or intimidating documents. A document (potentially spanning multiple photos) is attached. Please read them in order.

Step 1: Carefully read and transcribe the document in your "raw_transcription" field. Do not skip fine print, numbers, or dates.
Step 2: Analyze the document for the reader's obligations, rights, and key figures (pay, dates, penalties).
Step 3: Translate and simplify the core message into ${lang}. Use extremely simple, clear language (CEFR A2 reading level). Avoid all jargon.

Respond with ONLY a valid JSON object in this exact structure:
{
  "raw_transcription": string,
  "confidence": "clear" | "partial",
  "docType": string,
  "summary": string,
  "facts": [ { "emoji": string, "label": string, "value": string } ],
  "clauses": [ { "emoji": string, "title": string, "desc": string } ],
  "originalText": string,
  "spoken": string
}

CRITICAL RULES:
- Write ALL reader-facing fields ONLY in ${lang}.
- Keep the language at a 5th-grade reading level.
- Be objective and helpful. Do NOT give legal advice.`

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
