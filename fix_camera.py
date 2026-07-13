import re

with open("app/src/App.jsx", "r") as f:
    content = f.read()

# 1. State changes
state_target = """  const [camReady, setCamReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchOk, setTorchOk] = useState(false)

  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)"""

state_replace = """  const [photos, setPhotos] = useState([])

  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const fileRef = useRef(null)
  const cameraRef = useRef(null)"""

content = content.replace(state_target, state_replace)

# 2. Camera logic
camera_target = """  // ---- camera ----
  const stopCamera = () => {
    const s = streamRef.current
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    setCamReady(false)
  }

  useEffect(() => {
    if (screen !== 'capture') return
    let cancelled = false
    setError(null)
    setTorchOn(false)
    setTorchOk(false)
    // Ask for the sharpest rear camera the device can give us — small print
    // needs the pixels. The browser clamps to whatever the hardware supports.
    navigator.mediaDevices?.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        // iOS will cap this to the maximum supported resolution (often 4K).
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      },
      audio: false,
    })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCamReady(true)
        // Some phones expose a torch we can toggle for low light.
        const track = stream.getVideoTracks?.()[0]
        if (track?.getCapabilities?.().torch) setTorchOk(true)
      })
      .catch(() => setCamReady(false)) // no camera / denied / not-secure -> gallery fallback
    return () => { cancelled = true; stopCamera() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    try {
      const next = !torchOn
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch { /* torch not really controllable — ignore */ }
  }

  // Draw any image source into a size-capped canvas → { b64 }.
  // Capping the longest edge keeps the upload fast while staying crisp for OCR.
  const MAX_EDGE = 1600
  const encodeFrame = (source, sw, sh) => {
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d').drawImage(source, 0, 0, w, h)
    const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1]
    return { b64 }
  }

  // Grab the sharpest frame we can: prefer a real autofocused still photo
  // (ImageCapture), fall back to the live video frame where unsupported (iOS).
  const grabPhoto = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return { b64: null }
    let bitmap = null
    try {
      const track = streamRef.current?.getVideoTracks?.()[0]
      if (track && 'ImageCapture' in window) {
        const blob = await new window.ImageCapture(track).takePhoto()
        bitmap = await createImageBitmap(blob)
      }
    } catch { /* takePhoto unsupported/failed — use the live frame */ }
    const out = bitmap
      ? encodeFrame(bitmap, bitmap.width, bitmap.height)
      : encodeFrame(v, v.videoWidth, v.videoHeight)
    bitmap?.close?.()
    return out
  }

  const analyze = async (imageB64) => {
    if (!imageB64) { setError('The camera did not give a photo. Use the gallery button to pick one.'); setScreen('retake'); return }"""

camera_replace = """  // ---- native multi-page camera ----
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
    if (!imagesB64Array || !imagesB64Array.length) { setError('Please add at least one page of the document.'); setScreen('retake'); return }"""

content = content.replace(camera_target, camera_replace)

# 3. Analyze fetch body
fetch_target = """      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageB64, language: selLang?.label || 'English' }),
        signal: ctrl.signal,
      })"""

fetch_replace = """      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesB64Array, language: selLang?.label || 'English' }),
        signal: ctrl.signal,
      })"""

content = content.replace(fetch_target, fetch_replace)

# 4. doShoot
shoot_target = """  const doShoot = async () => {
    if (!consent) return
    const { b64 } = await grabPhoto()
    stopCamera()
    
    // Quality checks removed per request; sending straight to processing
    setScreen('processing')
    setProcStep(0)
    
    // Fake the processing steps for UX
    const procT1 = setTimeout(() => setProcStep(1), 1800)
    const procT2 = setTimeout(() => setProcStep(2), 3400)
    
    await analyze(b64)
    
    clearTimeout(procT1)
    clearTimeout(procT2)
  }"""

shoot_replace = """  const doAnalyze = async () => {
    if (!consent || photos.length === 0) return
    
    setScreen('processing')
    setProcStep(0)
    
    const procT1 = setTimeout(() => setProcStep(1), 1800)
    const procT2 = setTimeout(() => setProcStep(2), 3400)
    
    await analyze(photos)
    
    clearTimeout(procT1)
    clearTimeout(procT2)
  }"""

content = content.replace(shoot_target, shoot_replace)

# 5. Capture UI
ui_target = """          {/* ═══ SCREEN 2 — CAPTURE + CONSENT ═══ */}
          <div style={layer('capture', '#0E1512')}>
            <div style={css('position:relative; height:100%; background:#0E1512;')}>
              {/* viewfinder */}
              <div style={css('position:absolute; inset:0; display:flex; align-items:center; justify-content:center;')}>
                <div style={css('position:relative; width:74%; height:52%; margin-top:-40px;')}>
                  {/* live camera */}
                  <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', background: '#000', opacity: camReady ? 1 : 0, transition: 'opacity 0.3s' }} />
                  {/* fallback graphic when no camera */}
                  {!camReady && (
                    <div style={css('position:absolute; inset:0; background:#f3efe7; border-radius:6px; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:rotate(-1.4deg); overflow:hidden; padding:16px 14px;')}>
                      <div style={css('height:8px; width:58%; background:#d8d0c2; border-radius:2px; margin-bottom:11px;')} />
                      <div style={css('height:5px; width:92%; background:#e4ddd0; border-radius:2px; margin-bottom:7px;')} />
                      <div style={css('height:5px; width:88%; background:#e4ddd0; border-radius:2px; margin-bottom:7px;')} />
                      <div style={css('height:5px; width:95%; background:#e4ddd0; border-radius:2px; margin-bottom:7px;')} />
                      <div style={css('height:5px; width:70%; background:#e4ddd0; border-radius:2px; margin-bottom:14px;')} />
                      <div style={css('height:5px; width:90%; background:#e4ddd0; border-radius:2px; margin-bottom:7px;')} />
                      <div style={css('height:5px; width:84%; background:#e4ddd0; border-radius:2px;')} />
                    </div>
                  )}
                  {/* framing corners */}
                  <div style={css('position:absolute; top:-8px; left:-8px; width:30px; height:30px; border-top:3px solid #37E0C4; border-left:3px solid #37E0C4; border-radius:4px 0 0 0;')} />
                  <div style={css('position:absolute; top:-8px; right:-8px; width:30px; height:30px; border-top:3px solid #37E0C4; border-right:3px solid #37E0C4; border-radius:0 4px 0 0;')} />
                  <div style={css('position:absolute; bottom:-8px; left:-8px; width:30px; height:30px; border-bottom:3px solid #37E0C4; border-left:3px solid #37E0C4; border-radius:0 0 0 4px;')} />
                  <div style={css('position:absolute; bottom:-8px; right:-8px; width:30px; height:30px; border-bottom:3px solid #37E0C4; border-right:3px solid #37E0C4; border-radius:0 0 4px 0;')} />
                  <div style={css('position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#37E0C4,transparent); animation:eq-scan 3.2s ease-in-out infinite;')} />
                </div>
              </div>

              {/* top bar */}
              <div style={css('position:absolute; top:44px; left:0; right:0; display:flex; align-items:center; justify-content:space-between; padding:0 18px;')}>
                <div role="button" aria-label="Go back" tabIndex={0} style={css('width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; cursor:pointer;')} onClick={() => go('language')} onKeyDown={(e) => e.key === 'Enter' && go('language')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={css('display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.35); padding:7px 14px; border-radius:100px;')}>
                  <span style={css('font-size:14px; font-weight:800; color:#fff; letter-spacing:-0.3px;')}>EquiDoc</span>
                </div>
                <div style={css('width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; font-size:18px;')}>{selectedFlag}</div>
              </div>

              {/* torch / flashlight — only if the device exposes one */}
              {torchOk && (
                <div
                  role="button" aria-label="Toggle flashlight" tabIndex={0}
                  onClick={toggleTorch} onKeyDown={(e) => e.key === 'Enter' && toggleTorch()}
                  title="Turn the light on or off"
                  style={css(`position:absolute; top:96px; right:18px; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; background:${torchOn ? '#FDE68A' : 'rgba(255,255,255,0.14)'};`)}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 2h6l-1 7h3l-8 13 2-9H8z" stroke={torchOn ? '#7A5B00' : '#fff'} strokeWidth="1.8" strokeLinejoin="round" fill={torchOn ? '#7A5B00' : 'none'} /></svg>
                </div>
              )}

              {/* framing hint */}
              <div style={css('position:absolute; top:50%; left:50%; transform:translate(-50%,150px); background:rgba(0,0,0,0.5); padding:8px 15px; border-radius:100px;')}>
                <span style={css('font-size:13px; color:#E8FFFA; font-weight:500;')}>{camReady ? 'Fit the whole page · avoid glare & shadows' : 'No camera? Use the gallery button →'}</span>
              </div>

              {/* consent + shutter tray */}
              <div style={css('position:absolute; bottom:0; left:0; right:0; background:#FFFFFF; border-radius:24px 24px 0 0; padding:18px 20px 34px;')}>
                <div role="checkbox" aria-checked={consent} tabIndex={0} style={consentCardStyle} onClick={() => setConsent((c) => !c)} onKeyDown={(e) => e.key === 'Enter' && setConsent((c) => !c)}>
                  <div style={consentCheckStyle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={consentTickStyle}><path d="M5 13l4 4 10-11" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div style={css('flex:1;')}>
                    <div style={css('display:flex; align-items:center; gap:6px; margin-bottom:2px;')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V5l7-3z" stroke="#0F7C6B" strokeWidth="1.8" fill="none" strokeLinejoin="round" /></svg>
                      <span style={css('font-size:13px; font-weight:700; color:#16211F;')}>Before we read it</span>
                    </div>
                    <span style={css('font-size:12.5px; color:#5C726E; line-height:1.5;')}>Your photo goes to a secure cloud service to be read, then is <strong style={{ color: '#16211F' }}>deleted right away</strong>. Nothing is saved. Tap to agree.</span>
                  </div>
                </div>

                {/* shutter */}
                <div style={css('display:flex; align-items:center; justify-content:center; gap:40px; margin-top:18px;')}>
                  <div role="button" aria-label="Upload from gallery" tabIndex={0} style={css('width:52px; height:52px; border-radius:14px; border:2px solid #DBE5E3; display:flex; align-items:center; justify-content:center; cursor:pointer;')} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()} title="Choose a photo from the gallery">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.4" stroke="#5C726E" strokeWidth="1.9" /><circle cx="8.5" cy="10" r="1.7" stroke="#5C726E" strokeWidth="1.6" /><path d="M4 17l5-4 4 3 3-2 4 3" stroke="#5C726E" strokeWidth="1.7" strokeLinejoin="round" fill="none" /></svg>
                  </div>
                  <div role="button" aria-label="Take photo" tabIndex={0} style={shutterOuterStyle} onClick={doShoot} onKeyDown={(e) => e.key === 'Enter' && doShoot()}>
                    <div style={shutterInnerStyle} />
                  </div>
                  <div style={css('width:52px; height:52px; display:flex; align-items:center; justify-content:center;')}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: shutterHintColor, textAlign: 'center', lineHeight: 1.3, width: '56px' }}>{shutterHint}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>"""

ui_replace = """          {/* ═══ SCREEN 2 — CAPTURE + CONSENT (MULTI-PAGE NATIVE) ═══ */}
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
          </div>"""

content = content.replace(ui_target, ui_replace)

# 6. Add the hidden inputs right before the closing </div> of return
input_target = """        <div style={css('position:relative; z-index:10; width:100%; max-width:440px; height:100%; max-height:850px; background:#F1F5F4; box-shadow:0 20px 60px rgba(0,0,0,0.1); overflow:hidden;')} className="eq-app-container">"""

input_replace = """        <div style={css('position:relative; z-index:10; width:100%; max-width:440px; height:100%; max-height:850px; background:#F1F5F4; box-shadow:0 20px 60px rgba(0,0,0,0.1); overflow:hidden;')} className="eq-app-container">
          <input type="file" ref={cameraRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFiles} />
          <input type="file" ref={fileRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />"""

content = content.replace(input_target, input_replace)

# Also remove the existing fileRef input further down if it exists:
old_input = """          <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const bitmap = await createImageBitmap(file)
            const { b64 } = encodeFrame(bitmap, bitmap.width, bitmap.height)
            bitmap.close()
            setScreen('processing')
            setProcStep(0)
            const procT1 = setTimeout(() => setProcStep(1), 1800)
            const procT2 = setTimeout(() => setProcStep(2), 3400)
            await analyze(b64)
            clearTimeout(procT1)
            clearTimeout(procT2)
          }} />"""
content = content.replace(old_input, "")

with open("app/src/App.jsx", "w") as f:
    f.write(content)
