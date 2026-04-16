"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import {
  LayoutDashboard, Bot, Search, Bookmark, BarChart2,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Menu, X, Send, Trash2, Lock, AlertTriangle, Zap,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp?: Date;
}

// ─── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", aiMsgs:0 },
  starter:  { label:"Starter",      color:"#00ff99", aiMsgs:50 },
  pro:      { label:"Professional", color:"#3b9eff", aiMsgs:500 },
  business: { label:"Business",     color:"#a78bfa", aiMsgs:Infinity },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

const NAV = [
  { href:"/dashboard",    label:"Dashboard",    Icon:LayoutDashboard },
  { href:"/ai-assistant", label:"AI Assistant", Icon:Bot },
  { href:"/lead-search",  label:"Lead Search",  Icon:Search },
  { href:"/saved-leads",  label:"Saved Leads",  Icon:Bookmark },
  { href:"/emails",       label:"Emails",       Icon:Mail },
  { href:"/calls",        label:"Calls",        Icon:Phone },
  { href:"/tasks",        label:"Tasks",        Icon:CheckSquare },
  { href:"/export",       label:"Export",       Icon:Upload },
  { href:"/billing",      label:"Billing",      Icon:CreditCard },
  { href:"/meta-ads",     label:"Meta Ads",     Icon:Megaphone },
];

const QUICK_PROMPTS = [
  { label:"Find dental clinics in Dubai",    text:"Find me 10 dental clinics in Dubai" },
  { label:"What is Fatila?",                text:"What is Fatila and what does it do?" },
  { label:"How do I score leads?",          text:"How do I score leads effectively?" },
  { label:"About FTI Solutions",            text:"Tell me about FTI Solutions" },
  { label:"What services does FTI offer?",  text:"What services does FTI Solutions offer?" },
  { label:"Find IT companies in London",    text:"Find IT companies in London" },
];

export default function AIAssistantPage() {
  const { user } = useUser();
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const chatEndRef  = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [sidebarActive, setSidebarActive] = useState(false);
  const [prompt,        setPrompt]        = useState("");
  const [chat,          setChat]          = useState<ChatMessage[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [introVisible,  setIntroVisible]  = useState(true);
  const [dbUser,        setDbUser]        = useState<any>(null);
  const [msgsUsed,      setMsgsUsed]      = useState(0); // messages sent this session

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch user plan ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r => r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chat, loading]);

  // ── Canvas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const nodes: any[] = Array.from({ length:60 }, () => ({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.6, vy:(Math.random()-.5)*.6,
    }));
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      nodes.forEach(n => {
        n.x+=n.vx; n.y+=n.vy;
        if(n.x<0||n.x>canvas.width)n.vx*=-1; if(n.y<0||n.y>canvas.height)n.vy*=-1;
        ctx.beginPath(); ctx.arc(n.x,n.y,1.5,0,Math.PI*2); ctx.fillStyle="#00ff99"; ctx.fill();
      });
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle=`rgba(0,255,153,${.1*(1-d/120)})`;ctx.stroke();}
      }
      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const h = (e:MouseEvent) => { const s=document.getElementById("sidebar"); if(sidebarActive&&s&&!s.contains(e.target as Node))setSidebarActive(false); };
    document.addEventListener("click", h); return () => document.removeEventListener("click", h);
  }, [sidebarActive]);

  // ── Derived plan info ─────────────────────────────────────────────────────
  const plan    = ((dbUser?.plan as PlanKey) || "free");
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const isPaid  = plan !== "free";
  const msgMax  = planCfg.aiMsgs;
  const atLimit = msgMax !== Infinity && msgsUsed >= msgMax;

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (msg?: string) => {
    const content = (msg || prompt).trim();
    if (!content || atLimit) return;

    const userMsg: ChatMessage = { role:"user", content, timestamp:new Date() };
    const updatedChat = [...chat, userMsg];
    setChat(updatedChat);
    setPrompt("");
    setIntroVisible(false);
    setLoading(true);
    setMsgsUsed(p => p + 1);

    if (textareaRef.current) textareaRef.current.style.height = "42px";

    try {
      const res  = await fetch("/api/ai", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages:updatedChat }) });
      const data = await res.json();
      setChat(prev => [...prev, { role:"ai", content:data.result, timestamp:new Date() }]);
    } catch {
      setChat(prev => [...prev, { role:"ai", content:"Something went wrong. Please try again.", timestamp:new Date() }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e:React.KeyboardEvent) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();} };
  const handleChange  = (e:React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "42px";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };
  const clearChat = () => { setChat([]); setIntroVisible(true); };
  const fmtTime   = (d?:Date) => d ? d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "";

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#1c2844] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:-10,pointerEvents:"none"}} />

      {/* ── Sidebar ── */}
      <div id="sidebar" className={`sidebar ${sidebarActive?"active":""}`}>
        <div className="sb-logo">
          <div className="logo-dot"/>
          <span className="logo-text">Fatila</span>
        </div>
        <nav>
          {NAV.map(({href,label,Icon})=>(
            <a key={href} href={href} className={href==="/ai-assistant"?"active":""}>
              <Icon size={15} strokeWidth={1.8}/>{label}
            </a>
          ))}
        </nav>
        <div className="sb-footer">
          <span style={{color:planCfg.color,fontSize:11,fontWeight:700}}>{planCfg.label} Plan</span>
          {!isPaid && <a href="/billing" className="sb-upgrade">Upgrade</a>}
        </div>
      </div>

      <button className="menu-btn" onClick={(e)=>{e.stopPropagation();setSidebarActive(p=>!p);}}>
        {sidebarActive ? <X size={20}/> : <Menu size={20}/>}
      </button>

      {/* ── Chat layout ── */}
      <div className="chat-layout">

        {/* ── FREE GATE ── */}
        {!isPaid && (
          <div className="gate-overlay">
            <div className="gate-box">
              <div className="gate-icon-wrap"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
              <h3>AI Assistant is a Paid Feature</h3>
              <p>Upgrade to Starter or higher to start chatting with the AI Assistant for lead generation, platform help, and sales strategy.</p>
              <a href="/billing" className="gate-cta">View Plans — Starting $12/mo</a>
              <div className="gate-perks">
                {["Lead generation advice","Platform feature help","FTI Solutions info","B2B sales strategies"].map(f=>(
                  <span key={f} className="perk"><Zap size={11} color="#00ff99"/>{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INTRO SCREEN ── */}
        {isPaid && introVisible && (
          <div className="intro-screen">
            <div className="ai-avatar">
              <Bot size={32} color="#00ff99" strokeWidth={1.5}/>
            </div>
            <h1>Fatila AI Assistant</h1>
            <p>Powered by GPT-4  ·  Expert in B2B lead generation  ·  Built by FTI Solutions</p>

            {/* Msg limit badge */}
            {msgMax !== Infinity && (
              <div className="msg-limit-badge">
                <Zap size={12} color={planCfg.color}/>
                <span style={{color:planCfg.color}}>{msgMax} messages/month</span>
                <span className="sep">·</span>
                <a href="/billing">Upgrade for more</a>
              </div>
            )}
            {msgMax === Infinity && (
              <div className="msg-limit-badge">
                <Zap size={12} color="#a78bfa"/>
                <span style={{color:"#a78bfa"}}>Unlimited messages</span>
              </div>
            )}

            <div className="quick-grid">
              {QUICK_PROMPTS.map((qp,i)=>(
                <button key={i} className="quick-btn" onClick={()=>handleSend(qp.text)}>
                  <Search size={12} color="#8899bb"/>
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {isPaid && (
          <div className="messages-area">
            {chat.map((msg,i)=>(
              <div key={i} className={`msg-wrap ${msg.role}`}>
                <div className={`bubble ${msg.role}`}>
                  {msg.role==="ai" && (
                    <div className="ai-hdr">
                      <div className="ai-avatar-sm"><Bot size={13} color="#00ff99" strokeWidth={1.8}/></div>
                      <span className="ai-name">Fatila AI</span>
                      <span className="msg-time">{fmtTime(msg.timestamp)}</span>
                    </div>
                  )}
                  <div className={`msg-body ${msg.role}`}>
                    {msg.role==="ai"
                      ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                      : msg.content
                    }
                  </div>
                  {msg.role==="user" && <span className="user-time">{fmtTime(msg.timestamp)}</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg-wrap ai">
                <div className="bubble ai">
                  <div className="ai-hdr">
                    <div className="ai-avatar-sm"><Bot size={13} color="#00ff99" strokeWidth={1.8}/></div>
                    <span className="ai-name">Fatila AI</span>
                  </div>
                  <div className="typing"><span/><span/><span/></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
        )}

        {/* ── INPUT AREA ── */}
        {isPaid && (
          <div className="input-area">

            {/* Limit warning */}
            {msgMax !== Infinity && (
              <div className="limit-bar">
                <div className="limit-track">
                  <div className="limit-fill" style={{
                    width:`${Math.min((msgsUsed/msgMax)*100,100)}%`,
                    background: msgsUsed/msgMax >= .9 ? "#ff6b6b" : planCfg.color,
                  }}/>
                </div>
                <span className="limit-txt" style={{color: atLimit?"#ff6b6b":"#8899bb"}}>
                  {msgsUsed}/{msgMax === Infinity ? "∞" : msgMax} msgs this session
                </span>
              </div>
            )}

            {atLimit && (
              <div className="limit-gate">
                <AlertTriangle size={13} color="#ff6b6b"/>
                <span>Message limit reached for this plan.</span>
                <a href="/billing">Upgrade</a>
              </div>
            )}

            <div className="input-row">
              {chat.length > 0 && (
                <button className="clear-btn" onClick={clearChat} title="Clear chat">
                  <Trash2 size={15}/>
                </button>
              )}
              <div className={`input-box ${atLimit?"disabled":""}`}>
                <textarea
                  ref={textareaRef}
                  placeholder={atLimit ? "Message limit reached — upgrade to continue" : "Ask about leads, platform features, or FTI Solutions..."}
                  value={prompt}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={atLimit}
                />
                <button className="send-btn" onClick={()=>handleSend()} disabled={loading || !prompt.trim() || atLimit}>
                  {loading ? <span className="spinner"/> : <Send size={16}/>}
                </button>
              </div>
            </div>
            <p className="input-hint">Press Enter to send  ·  Shift+Enter for new line</p>
          </div>
        )}
      </div>

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow:hidden;}

        /* Sidebar */
        .sidebar{position:fixed;left:0;top:0;width:240px;height:100%;background:#06102a;padding:22px 14px;transition:.3s;z-index:1000;border-right:1px solid rgba(0,255,153,.07);display:flex;flex-direction:column;}
        .sb-logo{display:flex;align-items:center;gap:9px;margin-bottom:24px;padding:0 4px;}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#00ff99;box-shadow:0 0 8px #00ff99;}
        .logo-text{color:#00ff99;font-size:17px;font-weight:700;}
        nav{display:flex;flex-direction:column;gap:2px;flex:1;}
        nav a{display:flex;align-items:center;gap:9px;color:#8899bb;text-decoration:none;font-size:13px;padding:9px 10px;border-radius:8px;transition:.2s;}
        nav a:hover,nav a.active{color:#00ff99;background:rgba(0,255,153,.08);}
        .sb-footer{border-top:1px solid rgba(255,255,255,.06);padding-top:12px;display:flex;align-items:center;justify-content:space-between;}
        .sb-upgrade{font-size:11px;background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.25);padding:3px 10px;border-radius:20px;text-decoration:none;}

        .menu-btn{display:none;position:fixed;top:15px;left:15px;z-index:1100;background:#06102a;border:1px solid rgba(0,255,153,.15);color:white;padding:8px 10px;border-radius:8px;cursor:pointer;}

        /* Chat layout */
        .chat-layout{position:fixed;left:240px;right:0;top:0;bottom:0;display:flex;flex-direction:column;}

        /* Free gate overlay */
        .gate-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:10;background:rgba(2,8,23,.6);backdrop-filter:blur(6px);}
        .gate-box{text-align:center;max-width:440px;padding:40px 32px;background:#06102a;border:1px solid rgba(0,255,153,.15);border-radius:20px;}
        .gate-icon-wrap{width:62px;height:62px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
        .gate-box h3{font-size:19px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:13px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:11px 24px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}
        .gate-perks{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:16px;}
        .perk{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.06);border:1px solid rgba(0,255,153,.14);color:#ccc;font-size:12px;padding:4px 11px;border-radius:20px;}

        /* Intro */
        .intro-screen{position:absolute;top:50%;left:50%;transform:translate(-50%,-58%);text-align:center;width:90%;max-width:580px;z-index:1;}
        .ai-avatar{width:64px;height:64px;border-radius:50%;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.25);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
        .intro-screen h1{font-size:23px;font-weight:600;margin-bottom:7px;}
        .intro-screen p{color:#8899bb;font-size:13px;margin-bottom:16px;}

        .msg-limit-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:5px 14px;border-radius:20px;font-size:12px;margin-bottom:22px;}
        .msg-limit-badge .sep{color:#8899bb;}
        .msg-limit-badge a{color:#00ff99;}

        .quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
        .quick-btn{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:11px 14px;border-radius:10px;cursor:pointer;font-size:13px;text-align:left;transition:.2s;font-family:'Inter',sans-serif;}
        .quick-btn:hover{background:rgba(0,255,153,.08);border-color:rgba(0,255,153,.25);color:#00ff99;}

        /* Messages */
        .messages-area{flex:1;overflow-y:auto;padding:20px 40px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth;}
        .messages-area::-webkit-scrollbar{width:4px;}
        .messages-area::-webkit-scrollbar-thumb{background:rgba(0,255,153,.2);border-radius:4px;}

        .msg-wrap{display:flex;}
        .msg-wrap.user{justify-content:flex-end;}
        .msg-wrap.ai{justify-content:flex-start;}

        .bubble{max-width:70%;}
        .bubble.user{background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);border-radius:18px 18px 4px 18px;padding:12px 16px;}
        .bubble.ai{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px 18px 18px 4px;padding:12px 16px;}

        .ai-hdr{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
        .ai-avatar-sm{width:24px;height:24px;border-radius:50%;background:rgba(0,255,153,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ai-name{font-size:12px;font-weight:600;color:#00ff99;}
        .msg-time{font-size:11px;color:#8899bb;margin-left:auto;}
        .user-time{display:block;text-align:right;font-size:11px;color:#8899bb;margin-top:4px;}

        .msg-body{font-size:14px;line-height:1.7;color:#e0e8f0;}
        .msg-body :global(h2){font-size:15px;color:#00ff99;margin:10px 0 4px;}
        .msg-body :global(h3){font-size:14px;color:#00ff99;margin:8px 0 4px;}
        .msg-body :global(p){margin:5px 0;}
        .msg-body :global(ul),.msg-body :global(ol){padding-left:18px;margin:5px 0;}
        .msg-body :global(li){margin:3px 0;}
        .msg-body :global(code){background:rgba(0,255,153,.1);color:#00ff99;padding:2px 6px;border-radius:4px;font-size:12px;}
        .msg-body :global(strong){color:#fff;}
        .msg-body.user{color:#e0ffe0;}

        .typing{display:flex;gap:5px;padding:4px 0;}
        .typing span{width:7px;height:7px;background:#00ff99;border-radius:50%;animation:bounce .6s infinite alternate;}
        .typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
        @keyframes bounce{to{transform:translateY(-6px);opacity:.4}}

        /* Input */
        .input-area{padding:12px 40px 18px;background:rgba(2,8,23,.85);backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,.07);}

        .limit-bar{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
        .limit-track{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;}
        .limit-fill{height:100%;border-radius:3px;transition:width .4s ease;}
        .limit-txt{font-size:11px;white-space:nowrap;}

        .limit-gate{display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#ff6b6b;}
        .limit-gate a{color:#ff6b6b;margin-left:4px;font-weight:600;}

        .input-row{display:flex;align-items:flex-end;gap:8px;}
        .clear-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#8899bb;padding:9px;border-radius:9px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;transition:.2s;}
        .clear-btn:hover{color:#ff6b6b;border-color:rgba(255,107,107,.3);}

        .input-box{flex:1;display:flex;align-items:flex-end;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px 8px 8px 14px;transition:.2s;}
        .input-box:focus-within{border-color:rgba(0,255,153,.4);}
        .input-box.disabled{opacity:.5;pointer-events:none;}
        .input-box textarea{flex:1;background:none;border:none;color:white;font-size:14px;line-height:1.6;resize:none;outline:none;min-height:42px;max-height:140px;padding:6px 0;font-family:'Inter',sans-serif;}
        .input-box textarea::placeholder{color:#8899bb;}

        .send-btn{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#00ff99,#00cc66);border:none;color:#020817;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s;}
        .send-btn:hover:not(:disabled){transform:scale(1.05);}
        .send-btn:disabled{opacity:.5;cursor:not-allowed;}
        .input-hint{font-size:11px;color:#8899bb;margin-top:6px;text-align:center;}

        .spinner{width:15px;height:15px;border:2px solid rgba(2,8,23,.3);border-top-color:#020817;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:900px){
          .menu-btn{display:flex;}.sidebar{left:-240px;}.sidebar.active{left:0;}
          .chat-layout{left:0;}
          .messages-area{padding:14px;}
          .input-area{padding:10px 14px 14px;}
          .bubble{max-width:90%;}
          .quick-grid{grid-template-columns:1fr;}
        }
      `}</style>
    </>
  );
}
