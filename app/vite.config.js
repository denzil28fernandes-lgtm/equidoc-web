import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Google AI Studio Model
// PRD Recommended Production Model: Gemini 3.5 Flash
const MODEL = 'gemini-3.5-flash'

function buildPrompt(language) {
  const lang = language || 'English'
  return `You are EquiDoc, an empathetic assistant helping migrant and blue-collar workers understand complex or intimidating documents. A photo of a document is attached.

Step 1: Carefully read and transcribe the document in your "raw_transcription" field. Do not skip fine print, numbers, or dates.
Step 2: Analyze the document for the reader's obligations, rights, and key figures (pay, dates, penalties).
Step 3: Translate and simplify the core message into ${lang}. Use extremely simple, clear language (CEFR A2 reading level). Avoid all jargon.

Respond with ONLY a valid JSON object in this exact structure:
{
  "raw_transcription": string,       // Verbatim transcription of the original text (for your internal reasoning).
  "readable": boolean,               // ALWAYS return true and do your best to extract information, even if it is blurry, dark, or cropped
  "confidence": "clear" | "partial",
  "docType": string,                 // A simple 2-4 word title in ${lang} (e.g. "Employment Contract", "Late Notice")
  "summary": string,                 // 2-3 short, simple sentences in ${lang} explaining exactly what the document wants the reader to do or know.
  "facts": [ { "emoji": string, "label": string, "value": string } ],  // 1-4 vital facts (e.g. Dates, Pay, Deadlines). Keep labels under 3 words. in ${lang}
  "clauses": [ { "emoji": string, "title": string, "desc": string } ], // 0-4 important conditions, warnings, or obligations affecting their time/money. in ${lang}
  "originalText": string,            // A 1-2 sentence excerpt of the most critical part of the original text (in its original language)
  "spoken": string                   // A highly curated, structured script for text-to-speech in ${lang}. Format it exactly like a helpful human speaking directly to the user. Start with a warm greeting. Clearly narrate the summary, read the facts plainly, and strongly warn about any dangerous clauses. Make it flow perfectly. Do not sound like a robot.
}

CRITICAL RULES:
- Write ALL reader-facing fields (docType, summary, facts, clauses, spoken) ONLY in ${lang}.
- Keep the language at a 5th-grade reading level.
- Be objective and helpful. Do NOT give legal advice.`
}

// Local proxy: keeps GEMINI_API_KEY server-side (never shipped to the browser).
function geminiProxy(env) {
  return {
    name: 'equidoc-gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        const send = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })

        const key = env.GEMINI_API_KEY
        if (!key) {
          return send(500, {
            error: 'no_key',
            message: 'GEMINI_API_KEY is missing. Add it to app/.env.local, then stop and restart the dev server.',
          })
        }

        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const { image, language } = JSON.parse(raw || '{}')
          if (!image) return send(400, { error: 'no_image', message: 'No photo was received.' })

          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: buildPrompt(language) },
                    { inlineData: { mimeType: 'image/jpeg', data: image } }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            }),
          })

          if (!r.ok) {
            const t = await r.text()
            let message = t.slice(0, 600)
            if (r.status === 429) message = 'The Gemini API is rate-limited right now. Wait a minute and retry.'
            else if (r.status === 400 && message.includes('API_KEY_INVALID')) message = 'Google AI Studio rejected the API key. Check it in app/.env.local.'
            return send(502, { error: 'gemini_error', status: r.status, message })
          }

          const data = await r.json()
          let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          text = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
          // Models sometimes wrap the JSON in prose — grab the outermost {...}.
          const s = text.indexOf('{'), e = text.lastIndexOf('}')
          const jsonStr = s >= 0 && e > s ? text.slice(s, e + 1) : text
          try {
            return send(200, JSON.parse(jsonStr))
          } catch {
            // Not JSON (model refused or just described the image). Return a
            // clean "unreadable" so the app shows the retake screen, never hangs.
            return send(200, { readable: false, confidence: 'partial', docType: '', summary: '', facts: [], clauses: [], originalText: '', spoken: '' })
          }
        } catch (e) {
          return send(500, { error: 'server_error', message: String(e?.message || e) })
        }
      })

      server.middlewares.use('/api/chat', async (req, res) => {
        const send = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })

        const key = env.GEMINI_API_KEY
        if (!key) return send(500, { error: 'no_key' })

        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const { message, language, documentContext } = JSON.parse(raw || '{}')
          
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: `You are a helpful assistant answering questions about a document. The document was previously analyzed and summarized as follows:\n\n${documentContext}\n\nThe user asks: "${message}". Reply directly to their question in ${language}. Keep the answer brief, empathetic, and at a 5th-grade reading level.` }]
              }],
              generationConfig: { temperature: 0.3 }
            }),
          })
          const data = await r.json()
          let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I am unable to reply right now.'
          return send(200, { reply: text.trim() })
        } catch (e) {
          return send(500, { error: 'server_error' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix loads ALL env vars (incl. our un-prefixed, server-only key).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), geminiProxy(env)],
    server: {
      // Allow serving through a Cloudflare quick tunnel (HTTPS for phone camera).
      allowedHosts: ['.trycloudflare.com'],
    },
  }
})
