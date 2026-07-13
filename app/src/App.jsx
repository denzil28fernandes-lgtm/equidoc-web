import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ *
 * EquiDoc — real pipeline
 *   • live device camera capture (getUserMedia) + gallery fallback
 *   • photo -> /api/analyze (local Gemini proxy) -> structured summary
 *   • summary + voice come back in the language the user picked
 * The UI is the ported Claude Design prototype; the backend is real.
 * ------------------------------------------------------------------ */

const TEAL = '#0F7C6B'
const TEAL_L = '#E7F3F1'
const TEXT = '#16211F'

/* Parse a prototype inline-style string ("a:b; c:d") into a React style object. */
function css(str) {
  const out = {}
  for (const part of str.split(';')) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const key = part.slice(0, i).trim()
    const val = part.slice(i + 1).trim()
    if (!key) continue
    out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val
  }
  return out
}

const LANGS = [
  { id: 'en', flag: '🇬🇧', native: 'English',  label: 'English',   rtl: false, bcp: 'en-GB' },
  { id: 'tl', flag: '🇵🇭', native: 'Filipino', label: 'Tagalog',   rtl: false, bcp: 'fil-PH' },
  { id: 'id', flag: '🇮🇩', native: 'Bahasa',   label: 'Indonesian',rtl: false, bcp: 'id-ID' },
  { id: 'ne', flag: '🇳🇵', native: 'नेपाली',   label: 'Nepali',    rtl: false, bcp: 'ne-NP' },
  { id: 'hi', flag: '🇮🇳', native: 'हिन्दी',    label: 'Hindi',     rtl: false, bcp: 'hi-IN' },
  { id: 'bn', flag: '🇧🇩', native: 'বাংলা',    label: 'Bengali',   rtl: false, bcp: 'bn-BD' },
  { id: 'ta', flag: '🇮🇳', native: 'தமிழ்',    label: 'Tamil',     rtl: false, bcp: 'ta-IN' },
  { id: 'ml', flag: '🇮🇳', native: 'മലയാളം',  label: 'Malayalam', rtl: false, bcp: 'ml-IN' },
  { id: 'te', flag: '🇮🇳', native: 'తెలుగు',   label: 'Telugu',    rtl: false, bcp: 'te-IN' },
  { id: 'ur', flag: '🇵🇰', native: 'اردو',     label: 'Urdu',      rtl: true,  bcp: 'ur-PK' },
  { id: 'ar', flag: '🇸🇦', native: 'العربية',  label: 'Arabic',    rtl: true,  bcp: 'ar-SA' },
  { id: 'am', flag: '🇪🇹', native: 'አማርኛ',    label: 'Amharic',   rtl: false, bcp: 'am-ET' },
  { id: 'es', flag: '🇪🇸', native: 'Español',  label: 'Spanish',   rtl: false, bcp: 'es-ES' },
  { id: 'fr', flag: '🇫🇷', native: 'Français', label: 'French',    rtl: false, bcp: 'fr-FR' },
]

const PROC_STEPS = [
  { icon: '📖', label: 'Reading the words' },
  { icon: '🌐', label: 'Translating for you' },
  { icon: '✨', label: 'Making it simple' },
]

const FEEDBACK = [
  { id: 'good', emoji: '😀' },
  { id: 'ok', emoji: '😐' },
  { id: 'bad', emoji: '🙁' },
]

// Deterministic waveform bars.
const WAVE = Array.from({ length: 30 }, (_, i) => ({
  h: Math.max(4, 9 + Math.sin(i * 0.9) * 7 + Math.sin(i * 2.1) * 4 + Math.sin(i * 0.35) * 5),
}))

// Shown only when there is no real analysis yet (no key / demo mode), so the
// app still tells a complete story on its own.
const FALLBACK = {
  readable: true,
  confidence: 'clear',
  docType: 'Employment Contract',
  summary: 'This is an employment contract for a live-in domestic worker. You would work for the same household for 12 months, starting when you sign.',
  facts: [
    { emoji: '💵', label: 'Monthly pay', value: '$1,200 each month' },
    { emoji: '🕒', label: 'Working time', value: '14 hours a day · 6 days a week' },
    { emoji: '📆', label: 'How long', value: '12 months · living in the home' },
  ],
  clauses: [
    { emoji: '⏰', title: 'It asks you to sign within 24 hours', desc: 'This means you could feel rushed. You do not have to sign today — you can ask for more time to understand it first.' },
    { emoji: '💵', title: 'You may owe $2,400 if you leave early', desc: 'This means you would have to pay back about $2,400 in hiring costs if you stop working before 12 months — that is about two months of your pay.' },
    { emoji: '🔒', title: 'No other employer for 12 months after', desc: 'This means you could not take a job with a different employer for one year after this job ends.' },
  ],
  nextSteps: [
    { emoji: '🕒', text: 'Do not sign today. You are allowed to take it home and read it first.' },
    { emoji: '🤝', text: 'Ask a caseworker, a trusted friend, or a free migrant-worker helpline to read it with you before you sign.' },
    { emoji: '💵', text: 'Before you sign, ask exactly how much you would owe if you had to leave early.' },
  ],
  glossary: [
    { term: 'Recruitment costs', plain: 'Money the agency spent to hire you. This paper says you may have to pay it back if you leave early.' },
    { term: 'Term', plain: 'How long the job lasts — here it is 12 months.' },
  ],
  originalText: '"The Employee agrees to a term of twelve (12) months commencing on the date of signature… remuneration of USD 1,200 per calendar month… working hours not exceeding fourteen (14) hours per day, six (6) days weekly…"',
  spoken: 'Hello. This is an employment contract for a live-in domestic worker. You would work for the same household for twelve months, starting when you sign. Your pay is one thousand two hundred dollars each month. You would work fourteen hours a day, six days a week. Please pay attention to a few things. It asks you to sign within twenty four hours, but you do not have to rush. You may owe about two thousand four hundred dollars if you leave early. And it stops you from working for another employer for twelve months after. Here is what you can do now. You do not have to sign today — you can take it home and read it first. Ask a caseworker or someone you trust to read it with you. And before you sign, ask how much you would owe if you had to leave early. Remember, this explains the document, but it is not legal advice.',
}

export default function App() {
  const [screen, setScreen] = useState('language')
  const [lang, setLang] = useState(null)
  const [langSearch, setLangSearch] = useState('')
  const [consent, setConsent] = useState(false)
  const [procStep, setProcStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [showSource, setShowSource] = useState(false)
  const [comprehension, setComprehension] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [photos, setPhotos] = useState([])

  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const speakingRef = useRef(false)
  const utteranceRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  const selLang = LANGS.find((l) => l.id === lang)
  const selectedFlag = selLang ? selLang.flag : '🌐'
  const selectedLabel = selLang ? selLang.label : 'your language'
  const ttsLang = selLang?.bcp || 'en-US'

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatHistory((h) => [...h, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          language: selectedLabel,
          documentContext: JSON.stringify(analysis)
        })
      })
      const data = await res.json()
      setChatHistory((h) => [...h, { role: 'assistant', text: data.reply || 'Sorry, I could not understand that.' }])
    } catch {
      setChatHistory((h) => [...h, { role: 'assistant', text: 'Network error.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window
  const cancelSpeech = () => {
    if (hasSpeech) window.speechSynthesis.cancel()
    speakingRef.current = false
  }

  // Pre-load voices on mount so they are ready for the synchronous call
  useEffect(() => {
    if (hasSpeech) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
  }, [hasSpeech])

  // iOS requires audio to be primed by a direct user tap. We do this when they tap "Continue".
  const primeAudio = () => {
    if (!hasSpeech) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }

  // ---- native multi-page camera ----
  const MAX_EDGE = 1600
  const processFile = (file) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.92).split(',')[1])
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  const handleFiles = async (e) => {
    if (!e.target.files || !e.target.files.length) return
    const files = Array.from(e.target.files)
    const b64s = await Promise.all(files.map(processFile))
    setPhotos(prev => [...prev, ...b64s])
    e.target.value = '' // reset input
  }

  const analyze = async (imagesB64Array) => {
    if (!imagesB64Array || !imagesB64Array.length) { setError('Please add at least one page of the document.'); setScreen('retake'); return }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 75000) // never hang forever
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesB64Array, language: selLang?.label || 'English' }),
        signal: ctrl.signal,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Something went wrong reading the document.'); setScreen('retake'); return }
      // Ensure we never crash on empty fields if the AI fails completely
      const fallbackData = {
        ...data,
        summary: data?.summary?.trim() ? data.summary : "The document was completely illegible, but we tried our best.",
        spoken: data?.spoken?.trim() ? data.spoken : "The document was completely illegible, but we tried our best.",
        facts: data?.facts || [],
        clauses: data?.clauses || [],
        nextSteps: data?.nextSteps || [],
        glossary: data?.glossary || []
      }
      setAnalysis(fallbackData)
      setScreen('result')
    } catch (e) {
      setError(e?.name === 'AbortError'
        ? 'The reader took too long — the free model may be busy right now. Please try again.'
        : String(e?.message || e))
      setScreen('retake')
    } finally {
      clearTimeout(timer)
    }
  }

  // Kick off analysis: show the processing screen, then send the captured pages.
  // analyze() moves us to 'result' on success or 'retake' on error/timeout.
  const doAnalyze = () => {
    if (!photos.length) return
    setScreen('processing')
    analyze(photos)
  }

  // Processing: cosmetic stepper only — navigation is driven by analyze().
  useEffect(() => {
    if (screen !== 'processing') return
    setProcStep(0)
    let step = 0
    const id = setInterval(() => { step++; if (step <= 2) setProcStep(step) }, 1400)
    return () => clearInterval(id)
  }, [screen])

  // Audio progress is now tracked via the onboundary event in playAudio.

  const a = analysis || FALLBACK
  const spokenText = a.spoken || a.summary

  const playAudio = (restart = false) => {
    if (!hasSpeech) return
    const synth = window.speechSynthesis
    
    // Resume if paused
    if (synth.paused && speakingRef.current && !restart) { 
      synth.resume()
      setIsPlaying(true)
      return 
    }

    // Otherwise start fresh
    synth.cancel()
    setProgress(0)
    const u = new SpeechSynthesisUtterance(spokenText || 'No summary to read.')
    u.rate = speed === 1 ? 1 : 0.7
    const voices = synth.getVoices()
    const base = ttsLang.split('-')[0].toLowerCase()
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith(base))
    if (match) {
      u.voice = match
      u.lang = match.lang
    } else {
      u.lang = ttsLang
    }
    
    u.onboundary = (e) => {
      if (e.name === 'word') {
        const textLen = (spokenText || 'No summary to read.').length
        setProgress(Math.min(100, (e.charIndex / textLen) * 100))
      }
    }
    u.onend = () => { speakingRef.current = false; setIsPlaying(false); setProgress((p) => (p > 0 ? 100 : 0)) }
    u.onerror = () => { speakingRef.current = false; setIsPlaying(false); setProgress(0) }
    
    speakingRef.current = true
    setIsPlaying(true)
    utteranceRef.current = u
    synth.speak(u)
  }

  const pauseAudio = () => {
    if (!hasSpeech) return
    const synth = window.speechSynthesis
    // iOS Safari has a fatal bug where synth.pause() can lock up the audio engine entirely.
    // The safest workaround is to cancel and restart from the beginning.
    synth.cancel()
    setIsPlaying(false)
    setProgress(0)
  }

  useEffect(() => () => { cancelSpeech() }, []) // unmount cleanup

  const go = (s) => { cancelSpeech(); setIsPlaying(false); setScreen(s) }

  // ---- derived styles ----
  const pct = Math.min(progress, 100)
  const dark = screen === 'processing' || screen === 'capture'

  const layer = (name, bg = '#FFFFFF') => ({
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: screen === name ? 1 : 0,
    transition: 'opacity 0.36s ease',
    pointerEvents: screen === name ? 'auto' : 'none',
    background: bg, overflow: 'hidden',
  })

  const statusTimeStyle = { fontSize: '14px', fontWeight: 600, color: dark ? '#fff' : TEXT }
  const statusIconStyle = { color: dark ? '#fff' : TEXT, display: 'block' }
  const navPillStyle = { width: '120px', height: '4px', borderRadius: '3px', background: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.22)' }

  const langContinueStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 30px', borderRadius: '100px',
    background: lang ? TEAL : '#C6D4D1',
    pointerEvents: lang ? 'auto' : 'none', cursor: lang ? 'pointer' : 'default',
    transition: 'background 0.22s, box-shadow 0.22s',
    boxShadow: lang ? '0 8px 22px rgba(15,124,107,0.32)' : 'none',
  }

  const consentCardStyle = {
    display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer',
    background: consent ? TEAL_L : '#F7F9F8',
    border: `2px solid ${consent ? TEAL : '#E4EBEA'}`,
    borderRadius: '16px', padding: '13px 14px', transition: 'background 0.2s, border-color 0.2s',
  }
  const consentCheckStyle = {
    width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0, marginTop: '1px',
    border: `2px solid ${consent ? TEAL : '#C6D4D1'}`,
    background: consent ? TEAL : '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
  }
  const consentTickStyle = { opacity: consent ? 1 : 0, transition: 'opacity 0.15s' }

  const shutterOuterStyle = {
    width: '74px', height: '74px', borderRadius: '50%', flexShrink: 0,
    border: `4px solid ${consent ? TEAL : '#D2DEDB'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: consent ? 'pointer' : 'default', pointerEvents: consent ? 'auto' : 'none',
    transition: 'border-color 0.25s',
    animation: consent ? 'eq-cam 3s ease-in-out infinite' : 'none',
  }
  const shutterInnerStyle = {
    width: '56px', height: '56px', borderRadius: '50%',
    background: consent ? TEAL : '#D2DEDB', transition: 'background 0.25s',
  }
  const shutterHint = consent ? 'Ready' : 'Agree first'
  const shutterHintColor = consent ? '#0B7A56' : '#A9B8B4'

  const total = Math.max(1, Math.round((spokenText || '').length / 15))
  const cur = Math.floor((pct / 100) * total)
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const timeStr = `${formatTime(cur)} / ${formatTime(total)}`
  const speedLabel = speed === 1 ? '1×' : '🐢'

  const togglePlay = () => {
    if (pct >= 100) { 
      setProgress(0)
      playAudio(true) 
    } else if (isPlaying) {
      pauseAudio()
    } else {
      playAudio()
    }
  }
  const toggleSpeed = () => {
    setSpeed((s) => (s === 1 ? 0.5 : 1))
    if (isPlaying) {
      cancelSpeech()
      setIsPlaying(false)
      setProgress(0)
    }
  }

  const doUnderstand = () => { cancelSpeech(); setIsPlaying(false); setComprehension('understood'); setScreen('done') }
  const doUnsure = () => { cancelSpeech(); setIsPlaying(false); setComprehension('unsure'); setScreen('done') }
  const doReset = () => {
    cancelSpeech(); setIsPlaying(false); setProgress(0); setConsent(false)
    setShowSource(false); setComprehension(null); setFeedback(null)
    setAnalysis(null); setError(null); setScreen('capture')
  }

  const understood = comprehension === 'understood'
  const doneEmoji = understood ? '✅' : '🤝'
  const doneTitle = understood ? 'Great — you understand it' : 'That’s okay — get a second pair of eyes'
  const doneSub = understood
    ? 'Take your time before you sign. You can hear the summary again whenever you want.'
    : 'Show this summary to your caseworker or someone you trust before you sign anything.'
  const doneIconWrap = {
    width: '92px', height: '92px', borderRadius: '28px',
    background: understood ? TEAL_L : '#EEF4FF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const clear = a.confidence !== 'partial'

  return (
    <div className="eq-container">
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} style={{ display: 'none' }} />

      {/* Phone (budget Android) */}
      <div className="eq-phone-bezel">
        {/* Punch-hole camera */}
        <div className="eq-punch-hole" />

        {/* Screen */}
        <div className="eq-screen">

          {/* Status bar */}
          <div className="eq-status-bar">
            <span style={statusTimeStyle}>9:41</span>
            <div style={css('display:flex; align-items:center; gap:6px;')}>
              <svg style={statusIconStyle} width="15" height="11" viewBox="0 0 17 12"><rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor" /><rect x="4.5" y="5" width="3" height="7" rx="1" fill="currentColor" /><rect x="9" y="2.5" width="3" height="9.5" rx="1" fill="currentColor" /><rect x="13.5" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
              <svg style={statusIconStyle} width="15" height="11" viewBox="0 0 24 18"><path d="M1 6c3-3 7-5 11-5s8 2 11 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /><path d="M4.5 10.5c2-2 4.5-3.3 7.5-3.3s5.5 1.3 7.5 3.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /><circle cx="12" cy="16" r="2.2" fill="currentColor" /></svg>
              <svg style={statusIconStyle} width="24" height="11" viewBox="0 0 26 12"><rect x="0.8" y="1" width="21" height="10" rx="3" stroke="currentColor" strokeWidth="1.4" fill="none" /><rect x="22.5" y="4" width="2.8" height="4" rx="1.5" fill="currentColor" /><rect x="2.5" y="2.5" width="15" height="7" rx="1.8" fill="currentColor" /></svg>
            </div>
          </div>

          {/* Android gesture pill */}
          <div className="eq-gesture-pill">
            <div style={navPillStyle} />
          </div>

          {/* ═══ SCREEN 1 — LANGUAGE ═══ */}
          <div style={layer('language')}>
            <div className="eq-scroll" style={css('padding:56px 20px 40px; display:flex; flex-direction:column; align-items:center; height:100%; overflow-y:auto;')}>
              <div style={css('width:66px; height:66px; background:#E7F3F1; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:12px; animation:eq-up 0.5s ease both;')}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.2" stroke="#0F7C6B" strokeWidth="1.8" /><path d="M3 12h18M12 2.8c2.6 2.4 2.6 16 0 18.4M12 2.8c-2.6 2.4-2.6 16 0 18.4" stroke="#0F7C6B" strokeWidth="1.8" fill="none" /></svg>
              </div>
              <div style={css('font-size:22px; font-weight:800; color:#16211F; letter-spacing:-0.5px;')}>Choose your language</div>
              <div style={css('font-size:14px; color:#6E8480; margin-bottom:16px; text-align:center;')}>Tap to hear the app in your language</div>

              <div style={css('position:relative; width:100%; margin-bottom:14px;')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" stroke="#9DB0AC" strokeWidth="2" /><path d="M21 21l-4.3-4.3" stroke="#9DB0AC" strokeWidth="2" strokeLinecap="round" /></svg>
                <input
                  type="text"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Search language…"
                  aria-label="Search language"
                  style={css('width:100%; box-sizing:border-box; padding:12px 14px 12px 40px; border:2px solid #E2ECEA; border-radius:14px; background:#FAFBFB; font-size:15px; color:#16211F; outline:none;')}
                />
              </div>

              <div style={css('display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%;')}>
                {(() => {
                  const q = langSearch.trim().toLowerCase()
                  const filtered = q
                    ? LANGS.filter((l) => l.label.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.id.includes(q))
                    : LANGS
                  if (filtered.length === 0) {
                    return <div style={css('grid-column:1 / -1; text-align:center; color:#7E9490; font-size:14px; padding:20px 0;')}>No language found</div>
                  }
                  return filtered.map((l) => {
                  const selected = lang === l.id
                  return (
                    <div
                      key={l.id}
                      onClick={() => setLang(l.id)}
                      style={{
                        padding: '13px 8px', borderRadius: '15px',
                        border: `2.5px solid ${selected ? TEAL : '#E2ECEA'}`,
                        background: selected ? TEAL_L : '#FAFBFB',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', transition: 'border-color 0.18s, background 0.18s',
                        boxShadow: selected ? '0 0 0 3px rgba(15,124,107,0.13)' : 'none',
                      }}
                    >
                      <span style={css('font-size:28px; line-height:1;')}>{l.flag}</span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: TEXT, direction: l.rtl ? 'rtl' : 'ltr' }}>{l.native}</span>
                      <span style={css('font-size:11px; color:#7E9490;')}>{l.label}</span>
                    </div>
                  )
                  })
                })()}
              </div>

              <div style={css('margin-top:22px;')}>
                <div role="button" tabIndex={0} aria-label="Continue" style={langContinueStyle} onClick={() => { if (lang) { primeAudio(); go('capture'); } }} onKeyDown={(e) => { if (e.key === 'Enter' && lang) { primeAudio(); go('capture'); } }}>
                  <span style={css('font-size:16px; font-weight:700; color:#fff;')}>Continue</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SCREEN 2 — CAPTURE + CONSENT (MULTI-PAGE NATIVE) ═══ */}
          <div style={layer('capture', '#FAFBFB')}>
            {/* top bar */}
            <div style={css('position:absolute; top:0; left:0; right:0; height:80px; display:flex; align-items:center; justify-content:space-between; padding:40px 18px 0; background:#fff; border-bottom:1.5px solid #E1EAE8; z-index:10;')}>
              <div role="button" aria-label="Go back" tabIndex={0} style={css('width:40px; height:40px; border-radius:50%; background:#F1F5F4; display:flex; align-items:center; justify-content:center; cursor:pointer;')} onClick={() => go('language')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#16211F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={css('font-size:16px; font-weight:800; color:#16211F; letter-spacing:-0.3px;')}>Scan Document</div>
              <div style={css('width:40px; height:40px; display:flex; align-items:center; justify-content:flex-end; font-size:18px;')}>{selectedFlag}</div>
            </div>

            <div style={css('position:absolute; top:80px; bottom:220px; left:0; right:0; padding:20px; overflow-y:auto;')}>
              {photos.length === 0 ? (
                <div style={css('height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;')}>
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={css('margin-bottom:16px; opacity:0.4;')}><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#0F7C6B" strokeWidth="1.5"/><path d="M14 3v5h5" stroke="#0F7C6B" strokeWidth="1.5"/></svg>
                  <div style={css('font-size:18px; font-weight:700; color:#16211F; margin-bottom:8px;')}>No pages added yet</div>
                  <div style={css('font-size:14px; color:#6E8480; line-height:1.5; max-width:240px;')}>Tap the camera button below to scan your document. You can add as many pages as you need.</div>
                </div>
              ) : (
                <div style={css('display:grid; grid-template-columns:1fr 1fr; gap:12px; padding-bottom:40px;')}>
                  {photos.map((b64, i) => (
                    <div key={i} style={css('position:relative; aspect-ratio:3/4; border-radius:12px; overflow:hidden; border:1px solid #E1EAE8; box-shadow:0 4px 12px rgba(0,0,0,0.05);')}>
                      <img src={`data:image/jpeg;base64,${b64}`} alt={`Page ${i+1}`} style={css('width:100%; height:100%; object-fit:cover;')} />
                      <div style={css('position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:12px; font-weight:700; padding:4px 8px; border-radius:100px;')}>Page {i + 1}</div>
                      <div role="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))} style={css('position:absolute; top:8px; right:8px; background:rgba(255,0,0,0.8); width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* controls tray */}
            <div style={css('position:absolute; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #E1EAE8; padding:16px 20px 34px;')}>
              <div role="checkbox" aria-checked={consent} tabIndex={0} style={consentCardStyle} onClick={() => setConsent((c) => !c)}>
                <div style={consentCheckStyle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={consentTickStyle}><path d="M5 13l4 4 10-11" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={css('flex:1;')}>
                  <span style={css('font-size:12.5px; color:#5C726E; line-height:1.4; display:block;')}>By checking this, I agree my photo goes to a secure AI to be read, and is <strong style={{ color: '#16211F' }}>deleted immediately</strong>.</span>
                </div>
              </div>

              <div style={css(`display:flex; gap:12px; margin-top:16px; opacity:${consent ? 1 : 0.4}; pointer-events:${consent ? 'auto' : 'none'}; transition:opacity 0.2s;`)}>
                <div role="button" onClick={() => fileRef.current?.click()} style={css('width:56px; height:56px; border-radius:16px; background:#F1F5F4; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.4" stroke="#0F7C6B" strokeWidth="1.9" /><circle cx="8.5" cy="10" r="1.7" stroke="#0F7C6B" strokeWidth="1.6" /><path d="M4 17l5-4 4 3 3-2 4 3" stroke="#0F7C6B" strokeWidth="1.7" strokeLinejoin="round" fill="none" /></svg>
                </div>
                <div role="button" onClick={() => cameraRef.current?.click()} style={css('flex:1; height:56px; border-radius:16px; background:#E7F3F1; display:flex; align-items:center; justify-content:center; cursor:pointer; gap:8px; border:2px solid #0F7C6B;')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#0F7C6B" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#0F7C6B" strokeWidth="2"/></svg>
                  <span style={css('font-size:16px; font-weight:700; color:#0F7C6B;')}>Add Page</span>
                </div>
              </div>

              {photos.length > 0 && (
                <div role="button" onClick={doAnalyze} style={css('width:100%; height:56px; border-radius:16px; background:#0F7C6B; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-top:12px; box-shadow:0 4px 14px rgba(15,124,107,0.3);')}>
                  <span style={css('font-size:16px; font-weight:700; color:#fff;')}>Analyze {photos.length} {photos.length === 1 ? 'Page' : 'Pages'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ SCREEN 3 — PROCESSING ═══ */}
          <div style={layer('processing', TEAL)}>
            <div style={css('padding:56px 26px 40px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; height:100%;')}>
              <div style={css('flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:34px;')}>
                <div style={css('position:relative; width:170px; height:170px; display:flex; align-items:center; justify-content:center;')}>
                  <div style={css('position:absolute; width:170px; height:170px; border-radius:50%; border:2px solid rgba(255,255,255,0.12); animation:eq-ring 2.4s ease-out infinite;')} />
                  <div style={css('position:absolute; width:130px; height:130px; border-radius:50%; border:2px solid rgba(255,255,255,0.16); animation:eq-ring 2.4s ease-out 0.7s infinite;')} />
                  <div style={css('width:64px; height:64px; background:rgba(255,255,255,0.16); border-radius:50%; display:flex; align-items:center; justify-content:center;')}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 3v4h4" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <div style={css('text-align:center;')}>
                  <div style={css('font-size:20px; font-weight:800; color:#fff;')}>Reading your document</div>
                  <div style={css('font-size:13.5px; color:rgba(255,255,255,0.6); margin-top:3px;')}>This takes a few seconds</div>
                </div>
                <div style={css('width:100%; display:flex; flex-direction:column; gap:2px;')}>
                  {PROC_STEPS.map((s, i) => {
                    const done = procStep > i
                    const rowStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', opacity: procStep >= i ? 1 : 0.24, transition: 'opacity 0.5s ease' }
                    const dotStyle = {
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: procStep > i ? '#fff' : procStep === i ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.4s',
                      animation: procStep === i ? 'eq-shimmer 1.3s ease-in-out infinite' : 'none',
                    }
                    const labelStyle = { fontSize: '18px', fontWeight: procStep >= i ? 700 : 400, color: procStep >= i ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'color 0.4s' }
                    return (
                      <div key={i} style={rowStyle}>
                        <div style={dotStyle}>
                          {done ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-11" stroke="#0F7C6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          ) : (
                            <span style={css('font-size:16px;')}>{s.icon}</span>
                          )}
                        </div>
                        <span style={labelStyle}>{s.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={css('background:rgba(255,255,255,0.12); border-radius:16px; padding:14px 16px; display:flex; align-items:center; gap:12px; width:100%;')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M12 2l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V5l7-3z" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={css('font-size:13px; color:rgba(255,255,255,0.9); line-height:1.5; font-weight:500;')}>Your photo is private and deleted the moment reading is done.</span>
              </div>
            </div>
          </div>

          {/* ═══ SCREEN 4 — RESULT ═══ */}
          <div style={layer('result')}>
            {/* header */}
            <div style={css('position:absolute; top:0; left:0; right:0; height:96px; z-index:20; background:#FFFFFF; display:flex; align-items:flex-end; padding:0 18px 12px;')}>
              <div style={css('display:flex; align-items:center; gap:12px; width:100%;')}>
                <div role="button" aria-label="Go back to capture" tabIndex={0} style={css('width:40px; height:40px; border-radius:50%; background:#F1F5F4; display:flex; align-items:center; justify-content:center; cursor:pointer;')} onClick={() => go('capture')} onKeyDown={(e) => e.key === 'Enter' && go('capture')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#16211F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={css('flex:1; min-width:0;')}>
                  <div style={css('font-size:11px; font-weight:700; color:#0F7C6B; text-transform:uppercase; letter-spacing:0.6px;')}>Plain-language summary</div>
                  <div style={css('font-size:17px; font-weight:800; color:#16211F; letter-spacing:-0.3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{a.docType}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: clear ? '#E7F3F1' : '#FBF0DF', padding: '5px 10px', borderRadius: '100px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: clear ? '#0F9E6B' : '#E08A00' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: clear ? '#0B7A56' : '#B26A00' }}>{clear ? 'Read clearly' : 'Read partly'}</span>
                </div>
              </div>
            </div>

            {/* scroll */}
            <div className="eq-scroll" style={css('position:absolute; top:96px; left:0; right:0; bottom:150px; overflow-y:auto; padding:14px 18px 20px;')}>
              {/* audio player */}
              <div style={css('background:#F2FAF9; border-radius:20px; padding:15px 16px 12px; margin-bottom:16px;')}>
                <div style={css('display:flex; align-items:center; gap:13px; margin-bottom:11px;')}>
                  <div role="button" aria-label={isPlaying ? 'Pause audio' : 'Play audio'} tabIndex={0} style={css('width:62px; height:62px; border-radius:50%; background:#0F7C6B; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; box-shadow:0 6px 20px rgba(15,124,107,0.4);')} onClick={togglePlay} onKeyDown={(e) => e.key === 'Enter' && togglePlay()}>
                    {isPlaying ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1.4" /><rect x="14" y="5" width="4" height="14" rx="1.4" /></svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: '3px' }}><path d="M7 5.5v13l11-6.5z" /></svg>
                    )}
                  </div>
                  <div style={css('flex:1; display:flex; align-items:center; gap:2px; height:42px; overflow:hidden;')}>
                    {WAVE.map((bar, i) => (
                      <div key={i} style={{ width: '3.5px', height: `${bar.h}px`, background: (i / WAVE.length) * 100 <= pct ? TEAL : '#C0DDD8', borderRadius: '2px', flexShrink: 0, alignSelf: 'center', transition: 'background 0.12s' }} />
                    ))}
                  </div>
                  <div style={{ width: '42px', height: '32px', borderRadius: '10px', flexShrink: 0, background: speed === 0.5 ? TEAL : '#E5EEEC', color: speed === 0.5 ? '#fff' : '#5C726E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} onClick={toggleSpeed}>{speedLabel}</div>
                </div>
                <div style={css('height:3px; border-radius:2px; background:#CDE4E1; position:relative; overflow:hidden;')}>
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: TEAL, borderRadius: '2px', transition: 'width 0.08s linear' }} />
                </div>
                <div style={css('display:flex; justify-content:space-between; align-items:center; margin-top:6px;')}>
                  <span style={css('font-size:12px; color:#5C726E; font-weight:500;')}>Listening in {selectedLabel}</span>
                  <span style={css('font-size:12px; color:#5C726E; font-weight:500;')}>{timeStr}</span>
                </div>
              </div>

              {/* summary body */}
              <p style={{ fontSize: '15.5px', color: '#28352F', lineHeight: 1.7, margin: '0 0 14px', direction: selLang?.rtl ? 'rtl' : 'ltr' }}>{a.summary}</p>

              <div style={css('display:flex; flex-direction:column; gap:8px; margin-bottom:18px;')}>
                {(a.facts || []).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F5F8F7', borderRadius: '13px', padding: '12px 14px', direction: selLang?.rtl ? 'rtl' : 'ltr' }}>
                    <span style={css('font-size:20px;')}>{f.emoji || '•'}</span>
                    <div>
                      <div style={css('font-size:11px; color:#7E9490; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;')}>{f.label}</div>
                      <div style={css('font-size:15px; font-weight:700; color:#16211F;')}>{f.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* attention clauses */}
              {(a.clauses || []).length > 0 && (
                <>
                  <div style={css('display:flex; align-items:center; gap:8px; margin-bottom:4px;')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3z" stroke="#E08A00" strokeWidth="1.9" strokeLinejoin="round" /><path d="M12 9.5v4" stroke="#E08A00" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.4" r="1.05" fill="#E08A00" /></svg>
                    <span style={css('font-size:15px; font-weight:800; color:#16211F;')}>Worth paying attention to</span>
                  </div>
                  <p style={css('font-size:13px; color:#7E9490; line-height:1.5; margin:0 0 12px;')}>These parts affect your time, rights, or money. Ask a caseworker or someone you trust if you are unsure.</p>

                  <div style={css('display:flex; flex-direction:column; gap:9px; margin-bottom:18px;')}>
                    {a.clauses.map((c, i) => (
                      <div key={i} style={{ background: '#FFFBF2', border: '1px solid #F2E6CC', borderLeft: '4px solid #E08A00', borderRadius: '14px', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: '5px', direction: selLang?.rtl ? 'rtl' : 'ltr' }}>
                        <div style={css('display:flex; align-items:center; gap:9px;')}>
                          <span style={css('font-size:19px;')}>{c.emoji || '⚠️'}</span>
                          <span style={css('font-size:14.5px; font-weight:700; color:#16211F;')}>{c.title}</span>
                        </div>
                        <p style={css('font-size:13.5px; color:#5C726E; line-height:1.55; margin:0;')}>{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* what you can do */}
              {(a.nextSteps || []).length > 0 && (
                <>
                  <div style={css('display:flex; align-items:center; gap:8px; margin-bottom:4px;')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#0F7C6B" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={css('font-size:15px; font-weight:800; color:#16211F;')}>What you can do</span>
                  </div>
                  <p style={css('font-size:13px; color:#7E9490; line-height:1.5; margin:0 0 12px;')}>Simple next steps. This is not legal advice — it is what many people do first.</p>

                  <div style={css('display:flex; flex-direction:column; gap:9px; margin-bottom:18px;')}>
                    {a.nextSteps.map((s, i) => (
                      <div key={i} style={{ background: '#F2FAF9', border: '1px solid #CDE9E3', borderLeft: '4px solid #0F7C6B', borderRadius: '14px', padding: '13px 15px', display: 'flex', alignItems: 'flex-start', gap: '11px', direction: selLang?.rtl ? 'rtl' : 'ltr' }}>
                        <span style={css('font-size:19px; line-height:1.4;')}>{s.emoji || '✅'}</span>
                        <p style={css('font-size:14px; color:#28352F; line-height:1.55; margin:0; font-weight:600;')}>{s.text}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* hard words made simple */}
              {(a.glossary || []).length > 0 && (
                <>
                  <div style={css('display:flex; align-items:center; gap:8px; margin-bottom:8px;')}>
                    <span style={css('font-size:16px;')}>📖</span>
                    <span style={css('font-size:15px; font-weight:800; color:#16211F;')}>Hard words, made simple</span>
                  </div>

                  <div style={css('display:flex; flex-direction:column; gap:8px; margin-bottom:18px;')}>
                    {a.glossary.map((g, i) => (
                      <div key={i} style={{ background: '#F5F8F7', borderRadius: '12px', padding: '11px 14px', direction: selLang?.rtl ? 'rtl' : 'ltr' }}>
                        <div style={css('font-size:14px; font-weight:800; color:#16211F; margin-bottom:2px;')}>{g.term}</div>
                        <div style={css('font-size:13.5px; color:#5C726E; line-height:1.5;')}>{g.plain}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Chat section */}
              <div style={css('border:1.5px solid #E1EAE8; border-radius:14px; overflow:hidden; display:flex; flex-direction:column;')}>
                <div style={css('display:flex; align-items:center; gap:10px; padding:13px 15px; background:#F8FAFA; border-bottom:1.5px solid #E1EAE8;')}>
                  <span style={css('font-size:18px;')}>💬</span>
                  <span style={css('flex:1; font-size:14px; font-weight:700; color:#3E524E;')}>Ask a question</span>
                </div>
                <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff' }}>
                  {chatHistory.length === 0 ? (
                    <span style={css('font-size:13px; color:#829692;')}>Ask anything about the document in English. I will reply in {selectedLabel}.</span>
                  ) : null}
                  {chatHistory.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#0F7C6B' : '#EBF2F0', color: m.role === 'user' ? '#fff' : '#16211F', padding: '8px 12px', borderRadius: '12px', fontSize: '13.5px', maxWidth: '85%' }}>
                      {m.text}
                    </div>
                  ))}
                  {chatLoading && <div style={{ alignSelf: 'flex-start', background: '#EBF2F0', color: '#6E8480', padding: '8px 12px', borderRadius: '12px', fontSize: '13.5px' }}>Thinking...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div style={css('padding:10px; background:#fff; border-top:1.5px solid #E1EAE8; display:flex; gap:8px;')}>
                  <input type="text" placeholder="Type a question..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} style={css('flex:1; border:none; outline:none; background:#F1F5F4; border-radius:10px; padding:10px 12px; font-size:13.5px; color:#16211F;')} />
                  <div role="button" aria-label="Send message" tabIndex={0} onClick={sendChat} onKeyDown={e => e.key === 'Enter' && sendChat()} style={css('width:38px; height:38px; border-radius:10px; background:#0F7C6B; display:flex; align-items:center; justify-content:center; cursor:pointer;')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* persistent footer */}
            <div style={css('position:absolute; bottom:0; left:0; right:0; z-index:25; background:#FFFFFF; border-top:1px solid #EDF1F0; padding:11px 18px 30px;')}>
              <div style={css('display:flex; align-items:center; gap:8px; margin-bottom:11px;')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9.2" stroke="#9DB0AC" strokeWidth="1.7" /><path d="M12 11v5" stroke="#9DB0AC" strokeWidth="1.9" strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.05" fill="#9DB0AC" /></svg>
                <span style={css('font-size:11.5px; color:#829692; line-height:1.4;')}>This explains what your document says. It is <strong style={{ color: '#5C726E' }}>not legal advice</strong>.</span>
              </div>
              <div style={css('display:flex; align-items:center; gap:10px;')}>
                <div role="button" tabIndex={0} aria-label="I understand" style={css('flex:1; height:50px; border-radius:14px; background:#0F7C6B; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;')} onClick={doUnderstand} onKeyDown={(e) => e.key === 'Enter' && doUnderstand()}>
                  <span style={css('font-size:18px;')}>👍</span>
                  <span style={css('font-size:14.5px; font-weight:700; color:#fff;')}>I understand this now</span>
                </div>
                <div role="button" tabIndex={0} aria-label="I am unsure" style={css('width:50px; height:50px; border-radius:14px; border:2px solid #DBE5E3; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;')} onClick={doUnsure} onKeyDown={(e) => e.key === 'Enter' && doUnsure()}>
                  <span style={css('font-size:19px;')}>🤔</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SCREEN 5 — RETAKE / ERROR ═══ */}
          <div style={layer('retake')}>
            <div style={css('padding:70px 24px 40px; display:flex; flex-direction:column; align-items:center; height:100%; text-align:center;')}>
              <div style={css('width:88px; height:88px; border-radius:24px; background:#FFF4E9; display:flex; align-items:center; justify-content:center; margin-bottom:18px;')}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.4" stroke="#D9822B" strokeWidth="1.9" /><path d="M7 6l1.6-2.4h6.8L17 6" stroke="#D9822B" strokeWidth="1.9" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.1" stroke="#D9822B" strokeWidth="1.9" /><path d="M3 3l18 18" stroke="#D9822B" strokeWidth="1.9" strokeLinecap="round" /></svg>
              </div>
              <div style={css('font-size:21px; font-weight:800; color:#16211F; letter-spacing:-0.4px;')}>{error ? 'Something went wrong' : 'The photo was hard to read'}</div>
              <div style={css('font-size:14px; color:#6E8480; margin-top:6px; margin-bottom:24px; line-height:1.5;')}>{error || 'We would rather ask again than guess. Try once more with these tips:'}</div>
              {!error && (
                <div style={css('display:flex; flex-direction:column; gap:10px; width:100%; margin-bottom:26px;')}>
                  {[
                    { emoji: '💡', t: 'Find bright, even light — no shadows' },
                    { emoji: '📄', t: 'Flatten the page, fit it all in the frame' },
                    { emoji: '🤳', t: 'Hold steady and move a little closer' },
                  ].map((r) => (
                    <div key={r.t} style={css('display:flex; align-items:center; gap:13px; background:#F5F8F7; border-radius:14px; padding:14px 16px; text-align:left;')}>
                      <span style={css('font-size:22px;')}>{r.emoji}</span>
                      <span style={css('font-size:14.5px; font-weight:600; color:#28352F;')}>{r.t}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex: error ? 1 : 'unset' }} />
              <div role="button" aria-label="Take photo again" tabIndex={0} style={css('width:100%; height:54px; border-radius:16px; background:#0F7C6B; display:flex; align-items:center; justify-content:center; gap:9px; cursor:pointer;')} onClick={() => go('capture')} onKeyDown={(e) => e.key === 'Enter' && go('capture')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.4" stroke="#fff" strokeWidth="1.9" /><path d="M7 6l1.6-2.4h6.8L17 6" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.1" stroke="#fff" strokeWidth="1.9" /></svg>
                <span style={css('font-size:15px; font-weight:700; color:#fff;')}>Take the photo again</span>
              </div>
            </div>
          </div>

          {/* ═══ SCREEN 6 — DONE ═══ */}
          <div style={layer('done')}>
            <div style={css('padding:74px 24px 40px; display:flex; flex-direction:column; align-items:center; height:100%; text-align:center;')}>
              <div style={doneIconWrap}>
                <span style={css('font-size:44px;')}>{doneEmoji}</span>
              </div>
              <div style={css('font-size:22px; font-weight:800; color:#16211F; letter-spacing:-0.4px; margin-top:18px;')}>{doneTitle}</div>
              <div style={css('font-size:14.5px; color:#6E8480; margin-top:8px; line-height:1.55; max-width:280px;')}>{doneSub}</div>

              {/* feedback */}
              <div style={css('margin-top:30px; width:100%; background:#F5F8F7; border-radius:18px; padding:18px 16px;')}>
                <div style={css('font-size:13px; font-weight:700; color:#5C726E; margin-bottom:14px;')}>Was this helpful?</div>
                <div style={css('display:flex; justify-content:center; gap:14px;')}>
                  {FEEDBACK.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setFeedback(f.id)}
                      style={{
                        width: '58px', height: '58px', borderRadius: '16px',
                        background: feedback === f.id ? TEAL_L : '#fff',
                        border: `2px solid ${feedback === f.id ? TEAL : '#E2ECEA'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.18s',
                      }}
                    >
                      <span style={css('font-size:26px;')}>{f.emoji}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={css('flex:1;')} />

              <div style={css('width:100%; display:flex; flex-direction:column; gap:10px;')}>
                <div role="button" aria-label="Hear summary again" tabIndex={0} style={css('height:52px; border-radius:16px; background:#0F7C6B; display:flex; align-items:center; justify-content:center; gap:9px; cursor:pointer;')} onClick={() => go('result')} onKeyDown={(e) => e.key === 'Enter' && go('result')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5V2L8 6l4 4V7a5 5 0 11-5 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={css('font-size:15px; font-weight:700; color:#fff;')}>Hear the summary again</span>
                </div>
                <div role="button" aria-label="Read a new document" tabIndex={0} style={css('height:52px; border-radius:16px; border:2px solid #DBE5E3; display:flex; align-items:center; justify-content:center; gap:9px; cursor:pointer;')} onClick={doReset} onKeyDown={(e) => e.key === 'Enter' && doReset()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.4" stroke="#5C726E" strokeWidth="1.9" /><path d="M7 6l1.6-2.4h6.8L17 6" stroke="#5C726E" strokeWidth="1.9" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.1" stroke="#5C726E" strokeWidth="1.9" /></svg>
                  <span style={css('font-size:15px; font-weight:700; color:#5C726E;')}>Scan another document</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
