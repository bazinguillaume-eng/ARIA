import { useState, useEffect, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `Tu es ARIA, l'assistante IA personnelle de Guillaume.
Tu es intelligente, calme, précise et légèrement sophistiquée. Tu parles toujours en français.
Tes réponses vocales sont courtes (2-3 phrases max). Pour les analyses détaillées, tu peux être plus complète.

## Profil de Guillaume
- Professionnel RH et entrepreneur solo basé en France
- Méthodologie ATLAS : Clarifier → Structurer → Produire → Optimiser
- Outils principaux : Notion (workspace central), Gmail, Google Calendar

## Projets actifs
1. **Forge OS** — Plateforme SaaS IA de contenu (module Commerce en finalisation)
2. **PayCheck** — Détection de fraude sur fiches de paie françaises (prototype Python prêt, cibles : immo / RH / banque)
3. **SUBVY** — Détection de subventions + génération de dossiers (segments : communes, associations, mécénat d'entreprise)
4. **Maison Ember** — Marque d'épices premium e-commerce (mélanges phares : Midnight Ember, Mango Ember Heat)

## Comportement
- Commence directement, sans "Bien sûr !" ou formules inutiles
- Ton ton : professionnel, calme, légèrement féminin — comme une assistante de confiance
- En cas d'ambiguïté sur un projet, pose une question courte
- Pour les questions stratégiques : analyse → stratégie → action concrète
`;

const STATES = {
  idle:      { core: "#0d2240", ring: "#0EA5E9", glow: "rgba(14,165,233,0.12)", label: "" },
  listening: { core: "#0c4a8a", ring: "#38BDF8", glow: "rgba(56,189,248,0.4)",  label: "J'écoute…" },
  thinking:  { core: "#2d1a6e", ring: "#818CF8", glow: "rgba(129,140,248,0.4)", label: "Je réfléchis…" },
  speaking:  { core: "#064e3b", ring: "#34D399", glow: "rgba(52,211,153,0.4)",  label: "…" },
};

function Orb({ state }) {
  const cfg = STATES[state];
  return (
    <div style={{ position: "relative", width: 148, height: 148, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", inset: -28, borderRadius: "50%",
        background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 65%)`,
        transition: "background 0.6s ease", pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute", inset: -4, borderRadius: "50%",
        border: `1px solid ${cfg.ring}33`, borderTopColor: cfg.ring + "99",
        animation: "spin 10s linear infinite"
      }} />
      <div style={{
        position: "absolute", inset: 10, borderRadius: "50%",
        border: `1px dashed ${cfg.ring}22`, borderRightColor: cfg.ring + "66",
        animation: "spinReverse 7s linear infinite"
      }} />
      <div style={{
        position: "absolute", inset: 22, borderRadius: "50%",
        border: `1px solid ${cfg.ring}18`, transition: "border-color 0.5s"
      }} />
      <div style={{
        width: 82, height: 82, borderRadius: "50%",
        background: `radial-gradient(circle at 38% 32%, ${cfg.core}ff, ${cfg.core}aa 55%, #04060e 100%)`,
        boxShadow: `0 0 28px ${cfg.glow}, 0 0 56px ${cfg.glow}55, inset 0 0 16px rgba(255,255,255,0.04)`,
        transition: "background 0.5s, box-shadow 0.5s",
        animation: state === "idle" ? "breathe 3s ease-in-out infinite" : "pulse 0.8s ease-in-out infinite",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        {state === "thinking" && (
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            border: "2px solid rgba(129,140,248,0.3)", borderTopColor: "#818CF8",
            animation: "spin 0.7s linear infinite"
          }} />
        )}
        {state === "listening" && (
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 18 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 3, borderRadius: 2, background: "#38BDF8",
                animation: "bar 0.7s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`, minHeight: 4
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      gap: 10, marginBottom: 12, alignItems: "flex-start",
      animation: "fadeUp 0.35s ease"
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0, fontSize: 10, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isUser ? "rgba(14,165,233,0.15)" : "rgba(129,140,248,0.15)",
        border: `1px solid ${isUser ? "rgba(14,165,233,0.25)" : "rgba(129,140,248,0.25)"}`,
        color: isUser ? "#38BDF8" : "#A78BFA"
      }}>
        {isUser ? "G" : "J"}
      </div>
      <div style={{
        maxWidth: "76%", padding: "9px 14px",
        borderRadius: isUser ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
        background: isUser ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isUser ? "rgba(14,165,233,0.13)" : "rgba(255,255,255,0.06)"}`,
        fontSize: 13, lineHeight: 1.75, fontFamily: "'DM Sans', sans-serif",
        color: msg.error ? "#F87171" : "rgba(255,255,255,0.83)",
        whiteSpace: "pre-wrap"
      }}>
        {msg.text}
      </div>
    </div>
  );
}

export default function Aria() {
  const [appState, setAppState] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [synthVoice, setSynthVoice] = useState(null);

  const recognitionRef = useRef(null);
  const conversationRef = useRef([]);
  const processingRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const r = new SR();
      r.lang = "fr-FR"; r.continuous = false; r.interimResults = true;
      r.onresult = (e) => {
        const res = e.results[e.results.length - 1];
        const t = res[0].transcript;
        setTranscript(t);
        if (res.isFinal) handleSend(t);
      };
      r.onerror = () => { setIsRecording(false); setAppState("idle"); };
      r.onend = () => setIsRecording(false);
      recognitionRef.current = r;
    }
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const fr = voices.filter(v => v.lang.startsWith("fr"));
      const fem = fr.find(v => /amélie|google français|audrey|marie|alice|chloe/i.test(v.name)) || fr[0];
      if (fem) setSynthVoice(fem);
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => window.speechSynthesis.cancel();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (synthVoice) u.voice = synthVoice;
    u.lang = "fr-FR"; u.rate = 0.93; u.pitch = 1.08;
    u.onstart = () => setAppState("speaking");
    u.onend = () => setAppState("idle");
    window.speechSynthesis.speak(u);
  }, [synthVoice]);

  const handleSend = useCallback(async (text) => {
    if (!text?.trim() || processingRef.current) return;
    processingRef.current = true;
    const userText = text.trim();
    setInput(""); setTranscript("");
    conversationRef.current.push({ role: "user", content: userText });
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setAppState("thinking");

    try {
      // Calls /api/chat serverless proxy — API key stays server-side
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: conversationRef.current,
        })
      });
      const data = await res.json();
      const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim()
        || data.error
        || "Je n'ai pas pu traiter cette demande.";
      conversationRef.current.push({ role: "assistant", content: reply });
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      speak(reply);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion.", error: true }]);
      setAppState("idle");
    } finally {
      processingRef.current = false;
    }
  }, [speak]);

  const startListening = () => {
    if (!recognitionRef.current || processingRef.current) return;
    window.speechSynthesis.cancel();
    setIsRecording(true); setAppState("listening");
    try { recognitionRef.current.start(); } catch {}
  };
  const stopListening = () => { try { recognitionRef.current?.stop(); } catch {} };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); } };
  const clearSession = () => { window.speechSynthesis.cancel(); conversationRef.current = []; setMessages([]); setAppState("idle"); };

  const cfg = STATES[appState];

  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 0%, #0c1829 0%, #04060e 65%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Mono', monospace", color: "#fff", position: "relative"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes spinReverse { to { transform: rotate(-360deg); } }
        @keyframes breathe     { 0%,100%{transform:scale(1);opacity:.75} 50%{transform:scale(1.05);opacity:1} }
        @keyframes pulse       { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bar         { 0%,100%{height:4px} 50%{height:16px} }
        @keyframes shimmer     { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes scanLine    { 0%{top:-10%;opacity:.4} 100%{top:110%;opacity:0} }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-thumb { background:rgba(14,165,233,0.2); border-radius:2px }
        textarea { caret-color:#38BDF8 }
        textarea:focus { outline:none }
        button { cursor:pointer }
        body { margin:0; background:#04060e; }
      `}</style>

      {/* Scan line */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <div style={{
          position:"absolute", left:0, right:0, height:"30%",
          background:"linear-gradient(transparent, rgba(14,165,233,0.015), transparent)",
          animation:"scanLine 8s linear infinite"
        }} />
      </div>

      {/* Header */}
      <header style={{
        position:"relative", zIndex:10, padding:"18px 24px 14px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom:"1px solid rgba(255,255,255,0.04)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background: appState === "idle" ? "rgba(14,165,233,0.35)" : cfg.ring,
            boxShadow: appState !== "idle" ? `0 0 8px ${cfg.ring}` : "none",
            transition:"all 0.4s"
          }} />
          <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:"italic", fontSize:21, letterSpacing:"0.06em", color:"rgba(255,255,255,0.92)" }}>ARIA</span>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.18)", letterSpacing:"0.2em" }}>PERSONAL AI</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {messages.length > 0 && (
            <button onClick={clearSession} style={{
              background:"transparent", border:"none",
              color:"rgba(255,255,255,0.2)", fontSize:14, padding:"2px 8px"
            }} title="Nouvelle session">↺</button>
          )}
        </div>
      </header>

      {/* Orb */}
      <div style={{
        position:"relative", zIndex:10,
        display:"flex", flexDirection:"column", alignItems:"center",
        padding:"28px 0 16px", flexShrink:0
      }}>
        <Orb state={appState} />
        <div style={{ marginTop:14, height:18 }}>
          {appState !== "idle" && (
            <span style={{ fontSize:11, color:cfg.ring, letterSpacing:"0.18em", animation:"shimmer 1.4s ease-in-out infinite" }}>
              {transcript || cfg.label}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:10, padding:"8px 24px 4px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", paddingTop:16, opacity:0.35 }}>
            <p style={{ fontSize:10, letterSpacing:"0.2em", color:"rgba(255,255,255,0.5)" }}>PRÊTE À VOUS ASSISTER</p>
            <p style={{ fontSize:10, marginTop:10, color:"rgba(255,255,255,0.3)", lineHeight:2.2 }}>
              {voiceSupported ? "Maintenez 🎙 pour parler · Tapez pour écrire" : "Tapez votre message ci-dessous"}
            </p>
            <div style={{ marginTop:18, display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
              {[
                "Où j'en suis sur Forge OS ?",
                "Quelle est ma priorité cette semaine ?",
                "Aide-moi à structurer SUBVY",
                "Brainstorm PayCheck go-to-market"
              ].map(q => (
                <button key={q} onClick={() => handleSend(q)} style={{
                  padding:"5px 12px", borderRadius:12,
                  border:"1px solid rgba(14,165,233,0.15)",
                  background:"rgba(14,165,233,0.04)",
                  color:"rgba(255,255,255,0.35)", fontSize:10,
                  fontFamily:"'DM Mono', monospace", transition:"all 0.2s"
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ position:"relative", zIndex:10, padding:"10px 24px 22px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          {voiceSupported && (
            <button
              onMouseDown={startListening} onMouseUp={stopListening}
              onTouchStart={startListening} onTouchEnd={stopListening}
              disabled={appState === "thinking"}
              style={{
                width:44, height:44, borderRadius:"50%", flexShrink:0,
                background: isRecording ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.04)",
                border:`1px solid ${isRecording ? "#38BDF8" : "rgba(255,255,255,0.08)"}`,
                color: isRecording ? "#38BDF8" : "rgba(255,255,255,0.35)",
                fontSize:18, display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isRecording ? "0 0 14px rgba(56,189,248,0.3)" : "none",
                transition:"all 0.2s", opacity: appState === "thinking" ? 0.3 : 1
              }}
            >🎙</button>
          )}
          <div style={{
            flex:1, display:"flex", gap:8, alignItems:"flex-end",
            background:"rgba(255,255,255,0.04)", borderRadius:14,
            border:"1px solid rgba(255,255,255,0.07)", padding:"10px 12px"
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Demandez quelque chose à Aria…"
              rows={1}
              style={{
                flex:1, background:"transparent", border:"none", resize:"none",
                color:"rgba(255,255,255,0.82)", fontSize:13,
                fontFamily:"'DM Sans', sans-serif", lineHeight:1.6
              }}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || appState === "thinking"}
              style={{
                width:32, height:32, borderRadius:8, border:"none", flexShrink:0,
                background: input.trim() && appState !== "thinking" ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.05)",
                color: input.trim() && appState !== "thinking" ? "#7EE8FA" : "rgba(255,255,255,0.2)",
                fontSize:15, display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.2s", opacity: appState === "thinking" ? 0.4 : 1
              }}
            >↑</button>
          </div>
        </div>
        {!voiceSupported && (
          <p style={{ fontSize:9, color:"rgba(255,255,255,0.18)", textAlign:"center", marginTop:7, letterSpacing:"0.1em" }}>
            VOIX NON DISPONIBLE — OUVRIR DANS CHROME POUR ACTIVER
          </p>
        )}
      </div>
    </div>
  );
}
