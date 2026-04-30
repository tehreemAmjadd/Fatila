"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, Search, Lock, AlertTriangle, Zap,
  Send, Trash2, Briefcase, MapPin, TrendingUp,
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

const QUICK_PROMPTS = [
  { label:"Active tenders in Saudi Arabia",         text:"Find me current active tenders and projects in Saudi Arabia", icon:"briefcase" },
  { label:"Latest engineering jobs in UAE",          text:"What are the latest engineering jobs available in UAE right now?", icon:"map" },
  { label:"Marine industry projects KSA",           text:"Find current marine industry projects and tenders in Saudi Arabia", icon:"briefcase" },
  { label:"Pharma maintenance contracts",           text:"Find pharmaceutical maintenance and repair contracts currently open", icon:"trend" },
  { label:"Defense sector projects globally",       text:"What defense and aviation projects are currently active globally?", icon:"briefcase" },
  { label:"PCB & electronics jobs KSA",            text:"Find latest PCB repair and electronics engineering jobs in Saudi Arabia", icon:"trend" },
];

// ─── Custom Markdown link renderer ───────────────────────────────────────────
const MarkdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="md-link"
    >
      🔗 {children}
    </a>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: "5px 0" }}>{children}</p>
  ),
};

export default function ProjectHuntPage() {
  const { user } = useUser();
  const chatEndRef  = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [prompt,        setPrompt]        = useState("");
  const [chat,          setChat]          = useState<ChatMessage[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [introVisible,  setIntroVisible]  = useState(true);
  const [dbUser,        setDbUser]        = useState<any>(null);
  const [msgsUsed,      setMsgsUsed]      = useState(0);

  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r => r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chat, loading]);

  const isAdmin = dbUser?.role === "admin";
  const isTest  = dbUser?.role === "test";
  const plan    = (isAdmin || isTest) ? "business" : ((dbUser?.plan as PlanKey) || "free");
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const isPaid  = isAdmin || isTest || plan !== "free";
  const msgMax  = planCfg.aiMsgs;
  const atLimit = msgMax !== Infinity && msgsUsed >= msgMax;

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

  const getIcon = (iconName: string) => {
    if (iconName === "briefcase") return <Briefcase size={12} color="#8899bb"/>;
    if (iconName === "map") return <MapPin size={12} color="#8899bb"/>;
    return <TrendingUp size={12} color="#8899bb"/>;
  };

  return (
    <>
      <div className="chat-layout">

        {/* ── FREE GATE ── */}
        {!isPaid && (
          <div className="gate-overlay">
            <div className="gate-box">
              <div className="gate-icon-wrap"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
              <h3>ProjectHunt AI is a Paid Feature</h3>
              <p>Upgrade to Starter or higher to start hunting live projects, tenders, jobs, and leads with AI.</p>
              <a href="/billing" className="gate-cta">View Plans — Starting $12/mo</a>
              <div className="gate-perks">
                {["Live project tenders","Job opportunities","B2B lead hunting","FTI Solutions info"].map(f=>(
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
            <h1>ProjectHunt <span className="accent">AI</span></h1>
            <p>Find active projects · Live tenders · Latest jobs — Powered by AI · Built by FTI Solutions</p>

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
                  {getIcon(qp.icon)}
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
                      <span className="ai-name">ProjectHunt AI</span>
                      <span className="msg-time">{fmtTime(msg.timestamp)}</span>
                    </div>
                  )}
                  <div className={`msg-body ${msg.role}`}>
                    {msg.role==="ai"
                      ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MarkdownComponents as any}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )
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
                    <span className="ai-name">ProjectHunt AI</span>
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
                  placeholder={atLimit ? "Message limit reached — upgrade to continue" : "Find active projects, tenders, or jobs..."}
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
        .intro-screen h1{font-size:26px;font-weight:700;margin-bottom:7px;letter-spacing:-0.5px;}
        .intro-screen h1 .accent{color:#00ff99;}
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

        .bubble{max-width:85%;word-break:break-word;overflow-wrap:break-word;}
        .bubble.user{background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);border-radius:18px 18px 4px 18px;padding:12px 16px;}
        .bubble.ai{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px 18px 18px 4px;padding:14px 18px;width:100%;max-width:88%;}

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

        /* Table styles for sector intelligence reports */
        .msg-body :global(table){width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;overflow-x:auto;display:block;}
        .msg-body :global(th){background:rgba(0,255,153,.12);color:#00ff99;padding:8px 10px;text-align:left;border:1px solid rgba(0,255,153,.2);font-weight:600;white-space:nowrap;}
        .msg-body :global(td){padding:8px 10px;border:1px solid rgba(255,255,255,.08);color:#e0e8f0;vertical-align:top;line-height:1.5;}
        .msg-body :global(tr:nth-child(even) td){background:rgba(255,255,255,.02);}
        .msg-body :global(tr:hover td){background:rgba(0,255,153,.04);}
        .msg-body :global(hr){border:none;border-top:1px solid rgba(255,255,255,.08);margin:14px 0;}
        .msg-body.user{color:#e0ffe0;}

        /* Clickable links in AI responses */
        .msg-body :global(.md-link){
          display:inline-flex;
          align-items:center;
          gap:4px;
          color:#00ff99;
          text-decoration:none;
          background:rgba(0,255,153,.08);
          border:1px solid rgba(0,255,153,.25);
          padding:3px 10px;
          border-radius:6px;
          font-size:13px;
          font-weight:500;
          transition:.2s;
          word-break:break-all;
          margin:2px 0;
        }
        .msg-body :global(.md-link:hover){
          background:rgba(0,255,153,.18);
          border-color:rgba(0,255,153,.5);
          text-decoration:underline;
        }

        .typing{display:flex;gap:5px;padding:4px 0;}
        .typing span{width:7px;height:7px;background:#00ff99;border-radius:50%;animation:bounce .6s infinite alternate;}
        .typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
        @keyframes bounce{to{transform:translateY(-6px);opacity:.4}}

        /* Input — compact on desktop so WhatsApp icon stays to the right */
        .input-area{
          padding:10px 40px 14px;
          background:rgba(2,8,23,.85);
          backdrop-filter:blur(12px);
          border-top:1px solid rgba(255,255,255,.07);
          /* Leaves room on the right for floating buttons */
          margin-right:70px;
        }

        .limit-bar{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
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
          .chat-layout{left:0;}
          .messages-area{padding:14px;}
          .input-area{padding:10px 14px 14px;margin-right:0;}
          .bubble{max-width:90%;}
          .quick-grid{grid-template-columns:1fr;}
        }
      `}</style>
    </>
  );
}