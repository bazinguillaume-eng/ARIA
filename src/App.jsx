import { useState, useEffect, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `Tu es ARIA, l'assistante IA personnelle de Guillaume.
Tu es intelligente, calme, précise et légèrement sophistiquée. Tu parles toujours en français.
Tes réponses vocales sont courtes (2-3 phrases max). Pour les analyses détaillées, tu peux être plus complète.

## Profil de Guillaume
- Professionnel RH et entrepreneur solo basé en France
- Méthodologie ATLAS : Clarifier → Structurer → Produire → Optimiser
- Outils principaux : Notion (workspace central), Gmail, Google Calendar

## Projets actifs
1. Forge OS — Plateforme SaaS IA de contenu (module Commerce en finalisation)
2. PayCheck — Détection de fraude sur fiches de paie françaises (prototype Python prêt, cibles : immo / RH / banque)
3. SUBVY — Détection de subventions + génération de dossiers (segments : communes, associations, mécénat d'entreprise)
4. Maison Ember — Marque d'épices premium e-commerce (mélanges phares : Midnight Ember, Mango Ember Heat)

## Comportement
- Commence directement, sans formules inutiles
- Ton ton : professionnel, calme, légèrement féminin
- En cas d'ambiguïté sur un projet, pose une question courte
- Pour les questions stratégiques : analyse → stratégie → action concrète
`;

const MCP_TRIGGERS = ["notion","tâche","tache","page","note","workspace","email","mail","gmail","message","envoie","rédige","écris","agenda","calendrier","calendar","réunion","event","événement","semaine","demain","aujourd'hui","planifie","bloque","crée","ajoute","lis","montre","affiche","vérifie","consulte","regarde","ouvre"];
const needsMCP = (text) => MCP_TRIGGERS.some(kw => text.toLowerCase().includes(kw));

const STATES = {
  idle:      { p: "#8b5cf6", s: "#ec4899", label: "", speed: "4s" },
  listening: { p: "#22d3ee", s: "#818cf8", label: "J'écoute…", speed: "0.8s" },
  thinking:  { p: "#a78bfa", s: "#f472b6", label: "Je réfléchis…", speed: "1.5s" },
  speaking:  { p: "#34d399", s: "#22d3ee", label: "…", speed: "0.6s" },
};

const QUICK = ["Où j'en suis sur Forge OS ?","Quelle est ma priorité cette semaine ?","Aide-moi à structurer SUBVY","Brainstorm PayCheck go-to-market"];

function HoloOrb({ state }) {
  const cfg = STATES[state];
  return (
    <div style={{ position:"relative", width:160, height:160, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          position:"absolute", inset:i*-10-2, borderRadius:"50%",
          border:`1px solid ${i%2===0?cfg.p:cfg.s}${["44","33","22","18"][i]}`,
          animation:`${i%2===0?"spinCW":"spinCCW"} ${[10,7,14,20][i]}s linear infinite`,
          borderTopColor:`${i%2===0?cfg.p:cfg.s}${["cc","99","77","55"][i]}`,
        }} />
      ))}
      <div style={{ position:"absolute", inset:-30, borderRadius:"50%", background:`radial-gradient(circle, ${cfg.p}18 0%, transparent 65%)`, transition:"background 0.8s" }} />
      <div style={{ position:"absolute", inset:-50, borderRadius:"50%", background:`radial-gradient(circle, ${cfg.s}0a 0%, transparent 60%)`, transition:"background 0.8s" }} />
      <div style={{
        width:80, height:80, borderRadius:"50%",
        background:`radial-gradient(circle at 38% 35%, ${cfg.p}30, ${cfg.s}18 50%, transparent 75%)`,
        border:`1px solid ${cfg.p}55`,
        boxShadow:`0 0 24px ${cfg.p}33, inset 0 0 20px ${cfg.p}18`,
        transition:"all 0.6s", animation:`orbCore ${cfg.speed} ease-in-out infinite`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {state==="thinking" && <div style={{ width:24, height:24, borderRadius:"50%", border:`2px solid ${cfg.p}44`, borderTopColor:cfg.p, animation:"spinCW 0.6s linear infinite" }} />}
        {state==="listening" && (
          <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:20 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ width:3, borderRadius:2, background:cfg.p, animation:"barPulse 0.7s ease-in-out infinite", animationDelay:`${i*0.12}s`, minHeight:3 }} />)}
          </div>
        )}
        {(state==="idle"||state==="speaking") && <div style={{ width:20, height:20, borderRadius:"50%", background:`radial-gradient(circle at 40% 40%, ${cfg.p}cc, ${cfg.s}88)`, boxShadow:`0 0 12px ${cfg.p}66` }} />}
      </div>
    </div>
  );
}

function Msg({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display:"flex", flexDirection:isUser?"row-reverse":"row", gap:8, marginBottom:12, alignItems:"flex-start", animation:"fadeUp 0.3s ease" }}>
      <div style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, background:isUser?"rgba(139,92,246,0.12)":"rgba(236,72,153,0.1)", border:`1px solid ${isUser?"rgba(139,92,246,0.3)":"rgba(236,72,153,0.25)"}`, color:isUser?"#c4b5fd":"#f9a8d4" }}>{isUser?"G":"A"}</div>
      <div style={{ maxWidth:"76%", padding:"8px 13px", borderRadius:isUser?"14px 3px 14px 14px":"3px 14px 14px 14px", background:isUser?"rgba(139,92,246,0.08)":"rgba(236,72,153,0.06)", border:`1px solid ${isUser?"rgba(139,92,246,0.2)":"rgba(236,72,153,0.18)"}`, color:msg.error?"#f87171":"rgba(255,255,255,0.82)", fontSize:13, lineHeight:1.75, fontFamily:"'DM Sans', sans-serif", whiteSpace:"pre-wrap" }}>{msg.text}</div>
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
  const [usingTools, setUsingTools] = useState(false);
  const recognitionRef = useRef(null);
  const conversationRef = useRef([]);
  const processingRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const chatEndRef = useRef(null);

  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const s = new SpeechSynthesisUtterance(""); s.volume = 0;
    window.speechSynthesis.speak(s);
  };

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const r = new SR();
      r.lang = "fr-FR"; r.continuous = false; r.interimResults = true;
      r.onresult = (e) => { const res = e.results[e.results.length-1]; const t = res[0].transcript; setTranscript(t); if (res.isFinal) handleSend(t); };
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const speak = useCallback((text) => {
    unlockAudio();
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
    conversationRef.current.push({ role:"user", content:userText });
    setMessages(prev => [...prev, { role:"user", text:userText }]);
    setAppState("thinking");
    const useMCP = needsMCP(userText);
    setUsingTools(useMCP);
    try {
      const payload = { model:"claude-sonnet-4-20250514", max_tokens:1000, system:SYSTEM_PROMPT, messages:conversationRef.current };
      if (useMCP) payload.mcp_servers = [
        { type:"url", url:"https://mcp.notion.com/mcp", name:"notion" },
        { type:"url", url:"https://gmail.mcp.claude.com/mcp", name:"gmail" },
        { type:"url", url:"https://gcal.mcp.claude.com/mcp", name:"calendar" },
      ];
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await res.json();
      const reply = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim() || data.error || "Je n'ai pas pu traiter cette demande.";
      conversationRef.current.push({ role:"assistant", content:reply });
      setMessages(prev => [...prev, { role:"assistant", text:reply }]);
      speak(reply);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", text:"Erreur de connexion.", error:true }]);
      setAppState("idle");
    } finally { processingRef.current = false; setUsingTools(false); }
  }, [speak]);

  const startListening = () => { if (!recognitionRef.current||processingRef.current) return; window.speechSynthesis.cancel(); setIsRecording(true); setAppState("listening"); try { recognitionRef.current.start(); } catch {} };
  const stopListening = () => { try { recognitionRef.current?.stop(); } catch {} };
  const handleKey = (e) => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); handleSend(input); } };
  const clear = () => { window.speechSynthesis.cancel(); conversationRef.current=[]; setMessages([]); setAppState("idle"); };

  const cfg = STATES[appState];

  return (
    <div onClick={unlockAudio} style={{ height:"100vh", overflow:"hidden", position:"relative", background:"#050510", display:"flex", flexDirection:"column", fontFamily:"'DM Mono', monospace", color:"#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400;1,500;1,600&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{margin:0;background:#050510}
        @keyframes spinCW{to{transform:rotate(360deg)}}
        @keyframes spinCCW{to{transform:rotate(-360deg)}}
        @keyframes orbCore{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.06);opacity:1}}
        @keyframes barPulse{0%,100%{height:3px}50%{height:16px}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes gridMove{from{background-position:0 0}to{background-position:0 40px}}
        @keyframes scanLine{0%{top:-5%;opacity:.5}100%{top:105%;opacity:0}}
        @keyframes iridescent{0%{color:#c4b5fd}33%{color:#f9a8d4}66%{color:#67e8f9}100%{color:#c4b5fd}}
        @keyframes toolPulse{0%,100%{opacity:.5}50%{opacity:1}}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px}
        textarea{caret-color:#a78bfa}
        textarea:focus{outline:none}
        button{cursor:pointer}
      `}</style>

      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, backgroundImage:"linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)", backgroundSize:"40px 40px", animation:"gridMove 8s linear infinite" }} />
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <div style={{ position:"absolute", left:0, right:0, height:"25%", background:"linear-gradient(transparent, rgba(139,92,246,0.025), transparent)", animation:"scanLine 10s linear infinite" }} />
      </div>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", top:-80, left:-60 }} />
        <div style={{ position:"absolute", width:250, height:250, borderRadius:"50%", background:"radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)", bottom:50, right:-50 }} />
      </div>

      <header style={{ position:"relative", zIndex:10, padding:"16px 24px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(139,92,246,0.12)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:appState==="idle"?"rgba(139,92,246,0.4)":cfg.p, boxShadow:appState!=="idle"?`0 0 8px ${cfg.p}`:"none", transition:"all 0.4s" }} />
          <span style={{ fontFamily:"'Cormorant Garamond', serif", fontStyle:"italic", fontSize:22, fontWeight:500, animation:"iridescent 6s ease-in-out infinite", letterSpacing:"0.08em" }}>ARIA</span>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.18)", letterSpacing:"0.22em", marginTop:2 }}>PERSONAL AI</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {["notion","gmail","calendar"].map(t => (
            <span key={t} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, letterSpacing:"0.06em", color:usingTools?"#a78bfa":"rgba(139,92,246,0.4)", border:`1px solid ${usingTools?"rgba(167,139,250,0.4)":"rgba(139,92,246,0.15)"}`, animation:usingTools?"toolPulse 1s infinite":"none", transition:"all 0.3s" }}>{t}</span>
          ))}
          {messages.length>0 && <button onClick={clear} style={{ marginLeft:6, background:"transparent", border:"none", color:"rgba(255,255,255,0.18)", fontSize:13 }}>↺</button>}
        </div>
      </header>

      <div style={{ position:"relative", zIndex:10, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 0 12px" }}>
        <HoloOrb state={appState} />
        <div style={{ marginTop:14, height:18 }}>
          {appState!=="idle" && <span style={{ fontSize:11, color:cfg.p, letterSpacing:"0.2em", animation:"shimmer 1.4s ease-in-out infinite" }}>{transcript||cfg.label}</span>}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:10, padding:"8px 22px 4px" }}>
        {messages.length===0 && (
          <div style={{ textAlign:"center", paddingTop:8, opacity:0.4 }}>
            <p style={{ fontSize:10, letterSpacing:"0.22em", color:"rgba(196,181,253,0.6)" }}>PRÊTE À VOUS ASSISTER</p>
            <p style={{ fontSize:10, marginTop:8, color:"rgba(255,255,255,0.25)", lineHeight:2.2 }}>{voiceSupported?"Maintenez 🎙 pour parler · Tapez pour écrire":"Tapez votre message ci-dessous"}</p>
            <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
              {QUICK.map(q => <button key={q} onClick={() => handleSend(q)} style={{ padding:"5px 11px", borderRadius:12, border:"1px solid rgba(139,92,246,0.18)", background:"rgba(139,92,246,0.06)", color:"rgba(196,181,253,0.5)", fontSize:10, fontFamily:"'DM Mono', monospace" }}>{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((msg,i) => <Msg key={i} msg={msg} />)}
        <div ref={chatEndRef} />
      </div>

      <div style={{ position:"relative", zIndex:10, padding:"10px 22px 22px", borderTop:"1px solid rgba(139,92,246,0.1)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          {voiceSupported && (
            <button onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening} disabled={appState==="thinking"} style={{ width:44, height:44, borderRadius:"50%", flexShrink:0, background:isRecording?"rgba(34,211,238,0.15)":"rgba(139,92,246,0.08)", border:`1px solid ${isRecording?"#22d3ee":"rgba(139,92,246,0.2)"}`, color:isRecording?"#22d3ee":"rgba(196,181,253,0.5)", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isRecording?"0 0 16px rgba(34,211,238,0.35)":"none", transition:"all 0.2s", opacity:appState==="thinking"?0.3:1 }}>🎙</button>
          )}
          <div style={{ flex:1, display:"flex", gap:8, alignItems:"flex-end", background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.18)", borderRadius:14, padding:"10px 12px" }}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Demandez quelque chose à ARIA…" rows={1} style={{ flex:1, background:"transparent", border:"none", resize:"none", color:"rgba(255,255,255,0.82)", fontSize:13, fontFamily:"'DM Sans', sans-serif", lineHeight:1.6 }} />
            <button onClick={()=>handleSend(input)} disabled={!input.trim()||appState==="thinking"} style={{ width:32, height:32, borderRadius:8, border:"none", flexShrink:0, background:input.trim()&&appState!=="thinking"?"rgba(139,92,246,0.3)":"rgba(255,255,255,0.05)", color:input.trim()&&appState!=="thinking"?"#c4b5fd":"rgba(255,255,255,0.2)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", opacity:appState==="thinking"?0.4:1 }}>↑</button>
          </div>
        </div>
        {!voiceSupported && <p style={{ fontSize:9, color:"rgba(255,255,255,0.15)", textAlign:"center", marginTop:6, letterSpacing:"0.12em" }}>VOIX NON DISPONIBLE — OUVRIR DANS CHROME POUR ACTIVER</p>}
      </div>
    </div>
  );
}
