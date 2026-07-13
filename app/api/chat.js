export const config = {
  maxDuration: 60, // allow up to 60s for Gemini API processing
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'no_key', message: 'Missing GEMINI_API_KEY environment variable on Vercel.' })

  const MODEL = 'gemini-flash-latest'
  const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ]
  const { message, language, documentContext } = req.body

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `You are a helpful assistant answering questions about a document. The document was previously analyzed and summarized as follows:\n\n${documentContext}\n\nThe user asks: "${message}". Reply directly to their question in ${language}. Keep the answer brief, empathetic, and at a 5th-grade reading level.` }]
        }],
        generationConfig: { temperature: 0.3 },
        safetySettings: SAFETY_SETTINGS
      })
    })

    if (!r.ok) {
      const text = await r.text()
      return res.status(502).json({ error: 'gemini_error', message: text.slice(0, 600) })
    }

    const data = await r.json()
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I am unable to reply right now.'
    return res.status(200).json({ reply: text.trim() })
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: String(err?.message || err) })
  }
}
