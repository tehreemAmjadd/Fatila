"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Mail, Send, Sparkles, Settings, Lock, AlertTriangle,
  Clock, CheckCircle, XCircle, Inbox, PenLine, History,
  ChevronDown, RefreshCw, Zap,X
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
// Email Center is ONLY for Pro and Business
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", canEmail:false },
  trial:    { label:"Trial",        color:"#ffd700", canEmail:false },
  starter:  { label:"Starter",      color:"#00ff99", canEmail:false },
  pro:      { label:"Professional", color:"#3b9eff", canEmail:true  },
  business: { label:"Business",     color:"#a78bfa", canEmail:true  },
  expired:  { label:"Expired",      color:"#ff6b6b", canEmail:false },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

const TABS = [
  { id:"compose", label:"Compose",     Icon:PenLine  },
  { id:"bulk",    label:"Bulk Email",  Icon:Send     },
  { id:"logs",    label:"Sent Logs",   Icon:History  },
];

interface SavedLead {
  id:string; company:string; email:string|null;
  industry:string|null; score:number; priority:string;
}
interface EmailLog {
  id:string; to:string; subject:string; status:string;
  company:string|null; sentAt:string; error:string|null;
}

export default function EmailsPage() {
  const { user } = useUser();
  const [activeTab,     setActiveTab]     = useState("compose");
  const [dbUser,        setDbUser]        = useState<any>(null);

  // SMTP setup
  const [showSetup,    setShowSetup]    = useState(false);
  const [smtpEmail,    setSmtpEmail]    = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSaved,    setSmtpSaved]    = useState(false);

  // Compose
  const [toEmail,  setToEmail]  = useState("");
  const [subject,  setSubject]  = useState("");
  const [body,     setBody]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [sendResult, setSendResult] = useState<{type:"success"|"error";msg:string}|null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file
    const valid = files.filter(f => {
      if (f.size > MAX_SIZE) { alert(`${f.name} is too large (max 10MB)`); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // AI generation
  const [showAiPanel,     setShowAiPanel]     = useState(false);
  const [aiCompany,       setAiCompany]       = useState("");
  const [aiIndustry,      setAiIndustry]      = useState("");
  const [aiTone,          setAiTone]          = useState("professional");
  const [aiType,          setAiType]          = useState("outreach");
  const [aiSenderCompany, setAiSenderCompany] = useState("");
  const [aiSenderRole,    setAiSenderRole]    = useState("");
  const [aiLoading,       setAiLoading]       = useState(false);

  // Saved leads for compose sidebar
  const [savedLeads,       setSavedLeads]       = useState<SavedLead[]>([]);
  const [savedLeadsLoading,setSavedLeadsLoading] = useState(false);
  const [leadSearch,       setLeadSearch]       = useState("");

  // Bulk
  const [leads,          setLeads]          = useState<SavedLead[]>([]);
  const [leadsLoading,   setLeadsLoading]   = useState(false);
  const [selectedLeads,  setSelectedLeads]  = useState<SavedLead[]>([]);
  const [bulkSubject,    setBulkSubject]    = useState("");
  const [bulkBody,       setBulkBody]       = useState("");
  const [bulkSending,    setBulkSending]    = useState(false);
  const [bulkDone,       setBulkDone]       = useState(false);
  const [bulkProgress,   setBulkProgress]   = useState({sent:0,failed:0,total:0,current:""});
  const [aiPerLead,      setAiPerLead]      = useState(false);

  // Bulk attachments
  const [bulkAttachments,    setBulkAttachments]    = useState<File[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_SIZE = 10 * 1024 * 1024;
    const valid = files.filter(f => {
      if (f.size > MAX_SIZE) { alert(`${f.name} is too large (max 10MB)`); return false; }
      return true;
    });
    setBulkAttachments(prev => [...prev, ...valid]);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
  };

  const removeBulkAttachment = (index: number) => {
    setBulkAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Logs
  const [logs,        setLogs]        = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const userEmail = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userEmail) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail }) })
      .then(r=>r.json()).then(setDbUser).catch(console.error);
  }, [userEmail]);

  // ── Load SMTP from localStorage ───────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("smtp_email");
    if (saved) { setSmtpEmail(saved); setSmtpSaved(true); }
    const pass = localStorage.getItem("smtp_password");
    if (pass)  setSmtpPassword(pass);
  }, []);

  // ── Fetch leads for bulk ──────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    if (!userEmail) return;
    setLeadsLoading(true);
    try {
      const res  = await fetch("/api/leads/saved", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail, page:1, limit:200 }) });
      const data = await res.json();
      setLeads((data.leads||[]).filter((l:any)=>l.email));
    } catch(e){console.error(e);}
    finally{setLeadsLoading(false);}
  },[userEmail]);

  useEffect(()=>{if(activeTab==="bulk")loadLeads();},[activeTab,loadLeads]);

  // ── Fetch saved leads for compose sidebar ────────────────────────────────
  const loadSavedLeads = useCallback(async () => {
    if (!userEmail) return;
    setSavedLeadsLoading(true);
    try {
      const res  = await fetch("/api/leads/saved", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail, page:1, limit:200 }) });
      const data = await res.json();
      setSavedLeads((data.leads||[]).filter((l:any)=>l.email));
    } catch(e){console.error(e);}
    finally{setSavedLeadsLoading(false);}
  },[userEmail]);

  useEffect(()=>{if(userEmail)loadSavedLeads();},[userEmail,loadSavedLeads]);

  // ── Fetch logs ────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!userEmail) return;
    setLogsLoading(true);
    try {
      const res  = await fetch("/api/emails/logs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail }) });
      const data = await res.json();
      setLogs(data.logs||[]);
    } catch(e){console.error(e);}
    finally{setLogsLoading(false);}
  },[userEmail]);

  useEffect(()=>{if(activeTab==="logs")loadLogs();},[activeTab,loadLogs]);

  // ── Save SMTP ─────────────────────────────────────────────────────────────
  const saveSmtp = () => {
    localStorage.setItem("smtp_email",    smtpEmail);
    localStorage.setItem("smtp_password", smtpPassword);
    setSmtpSaved(true); setShowSetup(false);
  };

  // ── AI generate ───────────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiCompany) { alert("Company name required"); return; }
    setAiLoading(true);
    try {
      const res  = await fetch("/api/emails/generate", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ companyName:aiCompany, industry:aiIndustry, tone:aiTone, emailType:aiType,
          senderName:user?.fullName||"", senderEmail:userEmail||"", senderCompany:aiSenderCompany, senderRole:aiSenderRole }) });
      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.body)    setBody(data.body);
      setShowAiPanel(false);
    } catch(e){console.error(e);}
    finally{setAiLoading(false);}
  };

  // ── Send single email ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!toEmail||!subject||!body) { setSendResult({type:"error",msg:"To, Subject, and Body are required"}); return; }
    const storedEmail    = smtpEmail    || localStorage.getItem("smtp_email")    || "";
    const storedPassword = smtpPassword || localStorage.getItem("smtp_password") || "";
    if (!storedEmail||!storedPassword) { setShowSetup(true); return; }
    setSending(true); setSendResult(null);
    try {
      const formData = new FormData();
      formData.append("email", userEmail || "");
      formData.append("to", toEmail);
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("smtpEmail", storedEmail);
      formData.append("smtpPassword", storedPassword);
      attachments.forEach(file => formData.append("attachments", file));

      const res  = await fetch("/api/emails/send", { method:"POST", body:formData });
      const data = await res.json();
      if (data.success) {
        setSendResult({type:"success",msg:"Email sent successfully!"});
        setToEmail(""); setSubject(""); setBody(""); setAttachments([]);
      } else {
        setSendResult({type:"error",msg:data.error||"Send failed"});
      }
    } catch{ setSendResult({type:"error",msg:"Network error. Try again."}); }
    finally{setSending(false);}
  };

  // ── Bulk send ─────────────────────────────────────────────────────────────
  const handleBulkSend = async () => {
    if (!selectedLeads.length||!bulkSubject||!bulkBody) return;
    const storedEmail    = smtpEmail    || localStorage.getItem("smtp_email")    || "";
    const storedPassword = smtpPassword || localStorage.getItem("smtp_password") || "";
    if (!storedEmail||!storedPassword) { setShowSetup(true); return; }
    setBulkSending(true); setBulkDone(false);
    let sent=0,failed=0;
    for (const lead of selectedLeads) {
      if (!lead.email) { failed++; continue; }
      setBulkProgress({sent,failed,total:selectedLeads.length,current:lead.company});
      let finalSubject = bulkSubject.replace(/{{company}}/g,lead.company);
      let finalBody    = bulkBody.replace(/{{company}}/g,lead.company);
      if (aiPerLead) {
        try {
          const genRes  = await fetch("/api/emails/generate", { method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ companyName:lead.company, industry:lead.industry||"", tone:aiTone, emailType:aiType,
              senderName:user?.fullName||"", senderEmail:userEmail||"", senderCompany:aiSenderCompany, senderRole:aiSenderRole }) });
          const genData = await genRes.json();
          if (genData.subject) finalSubject = genData.subject;
          if (genData.body)    finalBody    = genData.body;
        } catch{}
      }
      try {
        const bulkForm = new FormData();
        bulkForm.append("email",        userEmail || "");
        bulkForm.append("to",           lead.email);
        bulkForm.append("subject",      finalSubject);
        bulkForm.append("body",         finalBody);
        bulkForm.append("companyName",  lead.company);
        bulkForm.append("smtpEmail",    storedEmail);
        bulkForm.append("smtpPassword", storedPassword);
        bulkAttachments.forEach(file => bulkForm.append("attachments", file));

        const res  = await fetch("/api/emails/send", { method:"POST", body:bulkForm });
        const data = await res.json();
        if (data.success) sent++; else failed++;
      } catch { failed++; }
      await new Promise(r=>setTimeout(r, aiPerLead?1200:800));
    }
    setBulkProgress({sent,failed,total:selectedLeads.length,current:"Done"});
    setBulkDone(true); setBulkSending(false);
    setSelectedLeads([]); loadLogs();
  };

  const toggleLead = (lead:SavedLead) => {
    setSelectedLeads(prev=>prev.find(l=>l.id===lead.id)?prev.filter(l=>l.id!==lead.id):[...prev,lead]);
  };
  const selectAll = () => { setSelectedLeads(selectedLeads.length===leads.length?[]:leads); };

  const isAdmin       = dbUser?.role === "admin";
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey)||"free");
  const planCfg       = PLAN_CONFIG[effectivePlan]||PLAN_CONFIG.free;
  const canEmail      = isAdmin || planCfg.canEmail;
  const fmtDate = (d:string) => { try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return "";} };

  return (
    <>
      <div className="main">

        {/* ── GATE: Free, Trial, Starter ── */}
        {!canEmail && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>
              {effectivePlan==="expired"?"Your trial has expired"
               :effectivePlan==="starter"?"Email Center requires Professional plan"
               :"Email Center is a Pro Feature"}
            </h3>
            <p>
              {effectivePlan==="starter"
               ?"You're on the Starter plan. Upgrade to Professional ($29/mo) to access the Email Center and send AI-written emails directly from Fatila."
               :effectivePlan==="expired"
               ?"Upgrade to continue sending emails and tracking your outreach."
               :"Upgrade to Professional or Business to send emails, use AI email generation, and run bulk email campaigns."}
            </p>
            <a href="/billing" className="gate-cta">
              {effectivePlan==="starter"?"Upgrade to Professional — $29/mo":"View Plans"}
            </a>
            <div className="gate-perks">
              {["AI email writer","Single & bulk send","Gmail integration","Sent email logs","Personalized per lead"].map(f=>(
                <span key={f} className="perk"><Mail size={11} color="#00ff99"/>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {canEmail && (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Email Center</h1>
                <p>Send AI-written emails and track your outreach</p>
              </div>
              <div className="header-right">
                <button className={`connect-badge ${smtpSaved?"connected":""}`} onClick={()=>setShowSetup(true)}>
                  {smtpSaved
                    ?<><CheckCircle size={13} color="#00ff99"/>Email Connected</>
                    :<><AlertTriangle size={13} color="#ffd700"/>Connect Email</>}
                </button>
                <span className="plan-chip" style={{color:planCfg.color,borderColor:`${planCfg.color}44`,background:`${planCfg.color}11`}}>
                  {planCfg.label}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs-row">
              {TABS.map(({id,label,Icon})=>(
                <button key={id} className={`tab-btn ${activeTab===id?"active":""}`} onClick={()=>setActiveTab(id)}>
                  <Icon size={14} strokeWidth={1.8}/>{label}
                </button>
              ))}
            </div>

            {/* ── COMPOSE TAB ── */}
            {activeTab==="compose" && (
              <div className="compose-layout">
                {/* Saved Leads Sidebar */}
                <div className="leads-sidebar">
                  <div className="sidebar-hdr">
                    <h3>Saved Leads</h3>
                    <span className="sidebar-count">{savedLeads.length} with email</span>
                  </div>
                  <input
                    className="leads-search"
                    placeholder="Search leads..."
                    value={leadSearch}
                    onChange={e=>setLeadSearch(e.target.value)}
                  />
                  {savedLeadsLoading?(
                    <div className="loading-rows">{[...Array(4)].map((_,i)=><div key={i} className="skeleton-row"/>)}</div>
                  ):savedLeads.filter(l=>l.company.toLowerCase().includes(leadSearch.toLowerCase())||(l.email||"").toLowerCase().includes(leadSearch.toLowerCase())).length===0?(
                    <div className="sidebar-empty"><Inbox size={24} color="#8899bb" strokeWidth={1.2}/><p>No saved leads with email</p></div>
                  ):(
                    <div className="sidebar-list">
                      {savedLeads.filter(l=>l.company.toLowerCase().includes(leadSearch.toLowerCase())||(l.email||"").toLowerCase().includes(leadSearch.toLowerCase())).map(lead=>(
                        <div key={lead.id}
                          className={`sidebar-lead ${toEmail===lead.email?"active":""}`}
                          onClick={()=>{setToEmail(lead.email||"");setAiCompany(lead.company);setAiIndustry(lead.industry||"");}}>
                          <div className="sidebar-av">{lead.company.charAt(0).toUpperCase()}</div>
                          <div className="sidebar-info">
                            <span className="sidebar-company">{lead.company}</span>
                            <span className="sidebar-email">{lead.email}</span>
                          </div>
                          <span className="sidebar-score" style={{color:lead.priority==="High"?"#ff4d4d":lead.priority==="Medium"?"#ffd700":"#00ff99"}}>{lead.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="compose-card">
                  <div className="compose-hdr">
                    <h2>New Email</h2>
                    <button className="ai-gen-btn" onClick={()=>setShowAiPanel(!showAiPanel)}>
                      <Sparkles size={14}/>{showAiPanel?"Hide AI":"Write with AI"}
                    </button>
                  </div>

                  {/* AI Panel */}
                  {showAiPanel && (
                    <div className="ai-panel">
                      <div className="ai-panel-hdr"><Sparkles size={14} color="#00ff99"/>AI Email Generator</div>
                      <div className="ai-grid">
                        <div className="field"><label>Company Name *</label><input value={aiCompany} onChange={e=>setAiCompany(e.target.value)} placeholder="e.g. TechNova LLC"/></div>
                        <div className="field"><label>Industry</label><input value={aiIndustry} onChange={e=>setAiIndustry(e.target.value)} placeholder="e.g. Healthcare"/></div>
                        <div className="field"><label>Your Company</label><input value={aiSenderCompany} onChange={e=>setAiSenderCompany(e.target.value)} placeholder="e.g. Fatila"/></div>
                        <div className="field"><label>Your Role</label><input value={aiSenderRole} onChange={e=>setAiSenderRole(e.target.value)} placeholder="e.g. Sales Manager"/></div>
                        <div className="field">
                          <label>Tone</label>
                          <select value={aiTone} onChange={e=>setAiTone(e.target.value)}>
                            {["professional","friendly","formal","casual","persuasive"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Email Type</label>
                          <select value={aiType} onChange={e=>setAiType(e.target.value)}>
                            {["outreach","follow-up","partnership","product demo","re-engagement"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                      <button className="generate-btn" onClick={handleAiGenerate} disabled={aiLoading}>
                        {aiLoading?<><RefreshCw size={13} className="spin"/>Generating...</>:<><Sparkles size={13}/>Generate Email</>}
                      </button>
                    </div>
                  )}

                  <div className="compose-fields">
                    <div className="field"><label>To</label><input value={toEmail} onChange={e=>setToEmail(e.target.value)} placeholder="recipient@example.com" type="email"/></div>
                    <div className="field"><label>Subject</label><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject..."/></div>
                    <div className="field"><label>Body</label><textarea rows={10} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your email here..."/></div>

                    {/* Attachments */}
                    <div className="field">
                      <label>Attachments <span className="hint">PDF, DOCX, XLSX, images — max 10MB each</span></label>
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {attachments.length > 0 && (
                          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                            {attachments.map((file, i) => (
                              <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(0,255,153,.06)",border:"1px solid rgba(0,255,153,.15)",borderRadius:"8px",padding:"7px 10px"}}>
                                <span style={{fontSize:"18px"}}>{file.type.includes("pdf")?"📄":file.type.includes("image")?"🖼️":file.type.includes("sheet")||file.name.endsWith(".xlsx")?"📊":"📎"}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:"12px",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{file.name}</div>
                                  <div style={{fontSize:"10px",color:"#8899bb"}}>{formatFileSize(file.size)}</div>
                                </div>
                                <button onClick={()=>removeAttachment(i)} style={{background:"none",border:"none",color:"#ff4d4d",cursor:"pointer",padding:"2px",display:"flex",alignItems:"center"}}>
                                  <X size={14}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip"
                          onChange={handleFileChange}
                          style={{display:"none"}}
                        />
                        <button
                          onClick={()=>fileInputRef.current?.click()}
                          style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,.05)",border:"1px dashed rgba(255,255,255,.2)",color:"#8899bb",padding:"9px 14px",borderRadius:"9px",fontSize:"12px",cursor:"pointer",transition:".2s",width:"fit-content"}}
                        >
                          📎 Attach Files {attachments.length > 0 && `(${attachments.length})`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {sendResult && (
                    <div className={`send-result ${sendResult.type}`}>
                      {sendResult.type==="success"?<CheckCircle size={14}/>:<XCircle size={14}/>}{sendResult.msg}
                    </div>
                  )}

                  <button className="send-btn" onClick={handleSend} disabled={sending||!smtpSaved}>
                    {sending?<><RefreshCw size={14} className="spin"/>Sending...</>:<><Send size={14}/>Send Email</>}
                  </button>
                  {!smtpSaved&&<p className="smtp-warn"><AlertTriangle size={12}/>Connect your email above before sending.</p>}
                </div>
              </div>
            )}

            {/* ── BULK TAB ── */}
            {activeTab==="bulk" && (
              <div className="bulk-layout">
                {/* Lead selector */}
                <div className="bulk-leads-panel">
                  <div className="bulk-panel-hdr">
                    <h3>Select Leads <span className="lead-count">({leads.length} with email)</span></h3>
                    <button className="select-all-btn" onClick={selectAll}>
                      {selectedLeads.length===leads.length?"Deselect All":"Select All"}
                    </button>
                  </div>
                  {leadsLoading?(
                    <div className="loading-rows">{[...Array(4)].map((_,i)=><div key={i} className="skeleton-row"/>)}</div>
                  ):leads.length===0?(
                    <div className="empty-state"><Inbox size={32} color="#8899bb" strokeWidth={1.2}/><p>No leads with email addresses found.</p></div>
                  ):(
                    <div className="lead-list">
                      {leads.map(lead=>{
                        const sel = selectedLeads.find(l=>l.id===lead.id);
                        return (
                          <div key={lead.id} className={`bulk-lead-row ${sel?"selected":""}`} onClick={()=>toggleLead(lead)}>
                            <div className={`bulk-checkbox ${sel?"checked":""}`}>{sel&&"✓"}</div>
                            <div className="bulk-lead-av">{lead.company.charAt(0).toUpperCase()}</div>
                            <div className="bulk-lead-info">
                              <span className="bulk-lead-name">{lead.company}</span>
                              <span className="bulk-lead-email">{lead.email}</span>
                            </div>
                            <span className="bulk-lead-score">{lead.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Compose bulk */}
                <div className="bulk-compose-panel">
                  <div className="bulk-panel-hdr">
                    <h3>Compose Bulk Email</h3>
                    <label className="ai-per-lead-toggle">
                      <input type="checkbox" checked={aiPerLead} onChange={e=>setAiPerLead(e.target.checked)}/>
                      <Sparkles size={12} color="#00ff99"/>AI per lead
                    </label>
                  </div>

                  <div className="field"><label>Subject <span className="hint">Use {"{{company}}"} for personalization</span></label>
                    <input value={bulkSubject} onChange={e=>setBulkSubject(e.target.value)} placeholder="Hi {{company}}, ..."/>
                  </div>
                  <div className="field"><label>Body</label>
                    <textarea rows={8} value={bulkBody} onChange={e=>setBulkBody(e.target.value)} placeholder={`Dear {{company}},\n\nI wanted to reach out...`}/>
                  </div>

                  {/* Bulk Attachments */}
                  <div className="field">
                    <label>Attachments <span className="hint">Same files sent to all leads — max 10MB each</span></label>
                    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                      {bulkAttachments.length > 0 && (
                        <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                          {bulkAttachments.map((file, i) => (
                            <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(0,255,153,.06)",border:"1px solid rgba(0,255,153,.15)",borderRadius:"8px",padding:"7px 10px"}}>
                              <span style={{fontSize:"18px"}}>{file.type.includes("pdf")?"📄":file.type.includes("image")?"🖼️":file.type.includes("sheet")||file.name.endsWith(".xlsx")?"📊":"📎"}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:"12px",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{file.name}</div>
                                <div style={{fontSize:"10px",color:"#8899bb"}}>{formatFileSize(file.size)}</div>
                              </div>
                              <button onClick={()=>removeBulkAttachment(i)} style={{background:"none",border:"none",color:"#ff4d4d",cursor:"pointer",padding:"2px",display:"flex",alignItems:"center"}}>
                                <X size={14}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input
                        ref={bulkFileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip"
                        onChange={handleBulkFileChange}
                        style={{display:"none"}}
                      />
                      <button
                        onClick={()=>bulkFileInputRef.current?.click()}
                        style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,.05)",border:"1px dashed rgba(255,255,255,.2)",color:"#8899bb",padding:"9px 14px",borderRadius:"9px",fontSize:"12px",cursor:"pointer",transition:".2s",width:"fit-content"}}
                      >
                        📎 Attach Files {bulkAttachments.length > 0 && `(${bulkAttachments.length})`}
                      </button>
                    </div>
                  </div>

                  {bulkSending&&(
                    <div className="bulk-progress">
                      <div className="progress-track"><div className="progress-fill" style={{width:`${(bulkProgress.sent+bulkProgress.failed)/bulkProgress.total*100}%`}}/></div>
                      <p className="progress-text"><Send size={12}/>Sending to: {bulkProgress.current} — {bulkProgress.sent} sent, {bulkProgress.failed} failed</p>
                    </div>
                  )}
                  {bulkDone&&(
                    <div className="bulk-done"><CheckCircle size={14} color="#00ff99"/>Done — {bulkProgress.sent} sent, {bulkProgress.failed} failed</div>
                  )}

                  <button className="send-btn" onClick={handleBulkSend}
                    disabled={bulkSending||!selectedLeads.length||!bulkSubject||!bulkBody||!smtpSaved}>
                    {bulkSending
                      ?<><RefreshCw size={14} className="spin"/>Sending...</>
                      :<><Send size={14}/>Send to {selectedLeads.length||0} Lead{selectedLeads.length!==1?"s":""}</>}
                  </button>
                  {!smtpSaved&&<p className="smtp-warn"><AlertTriangle size={12}/>Connect your email above before sending.</p>}
                </div>
              </div>
            )}

            {/* ── LOGS TAB ── */}
            {activeTab==="logs" && (
              <div className="logs-panel">
                <div className="logs-hdr">
                  <h3>Sent Emails</h3>
                  <button className="refresh-btn" onClick={loadLogs}><RefreshCw size={14}/>Refresh</button>
                </div>
                {logsLoading?(
                  <div className="loading-rows">{[...Array(5)].map((_,i)=><div key={i} className="skeleton-row"/>)}</div>
                ):logs.length===0?(
                  <div className="empty-state"><Mail size={36} color="#8899bb" strokeWidth={1.2}/><p>No emails sent yet.</p></div>
                ):(
                  <div className="logs-table-wrap">
                    <table className="logs-table">
                      <thead><tr><th>To</th><th>Subject</th><th>Company</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {logs.map(log=>(
                          <tr key={log.id}>
                            <td className="log-to">{log.to}</td>
                            <td className="log-subject">{log.subject}</td>
                            <td><span className="tag">{log.company||"—"}</span></td>
                            <td>
                              <span className="log-status" style={{
                                color:log.status==="sent"?"#00ff99":"#ff4d4d",
                                background:log.status==="sent"?"rgba(0,255,153,.1)":"rgba(255,77,77,.1)"
                              }}>
                                {log.status==="sent"?<CheckCircle size={11}/>:<XCircle size={11}/>}
                                {log.status}
                              </span>
                            </td>
                            <td className="log-date">{fmtDate(log.sentAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── SMTP SETUP MODAL ── */}
      {showSetup && (
        <div className="modal-overlay" onClick={()=>setShowSetup(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div><h3>Connect Email</h3><p>Use Gmail with App Password</p></div>
              <button onClick={()=>setShowSetup(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="field"><label>Gmail Address</label><input type="email" value={smtpEmail} onChange={e=>setSmtpEmail(e.target.value)} placeholder="you@gmail.com"/></div>
              <div className="field"><label>App Password</label><input type="password" value={smtpPassword} onChange={e=>setSmtpPassword(e.target.value)} placeholder="16-char app password"/></div>
              <p className="smtp-tip">
                Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Google App Passwords</a> to generate a password. Enable 2FA first.
              </p>
            </div>
            <div className="modal-foot">
              <button className="cancel-btn" onClick={()=>setShowSetup(false)}>Cancel</button>
              <button className="save-btn-modal" onClick={saveSmtp}><CheckCircle size={14}/>Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:480px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}
        .gate-perks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;}
        .perk{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.06);border:1px solid rgba(0,255,153,.14);color:#ccc;font-size:12px;padding:5px 12px;border-radius:20px;}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .header-right{display:flex;align-items:center;gap:10px;}
        .connect-badge{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#ccc;padding:7px 14px;border-radius:8px;font-size:12px;cursor:pointer;transition:.2s;}
        .connect-badge.connected{background:rgba(0,255,153,.08);border-color:rgba(0,255,153,.2);color:#00ff99;}
        .connect-badge:hover{background:rgba(255,255,255,.1);}
        .plan-chip{font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;border:1px solid;}

        /* Tabs */
        .tabs-row{display:flex;gap:5px;margin-bottom:20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:5px;}
        .tab-btn{display:flex;align-items:center;gap:7px;flex:1;justify-content:center;padding:9px 16px;border-radius:7px;border:none;background:none;color:#8899bb;font-size:13px;font-weight:500;cursor:pointer;transition:.2s;}
        .tab-btn.active{background:rgba(0,255,153,.1);color:#00ff99;}

        /* Compose */
        .compose-layout{display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start;}
        /* Leads Sidebar */
        .leads-sidebar{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 200px);overflow:hidden;}
        .sidebar-hdr{display:flex;justify-content:space-between;align-items:center;}
        .sidebar-hdr h3{font-size:13px;font-weight:600;}
        .sidebar-count{font-size:11px;color:#8899bb;background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px;}
        .leads-search{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:7px 11px;border-radius:8px;font-size:12px;font-family:'Inter',sans-serif;width:100%;}
        .leads-search:focus{outline:none;border-color:rgba(0,255,153,.35);}
        .leads-search::placeholder{color:#556;}
        .sidebar-list{display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;}
        .sidebar-lead{display:flex;align-items:center;gap:9px;padding:9px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:9px;cursor:pointer;transition:.18s;}
        .sidebar-lead:hover{border-color:rgba(0,255,153,.2);background:rgba(0,255,153,.04);}
        .sidebar-lead.active{border-color:rgba(0,255,153,.4);background:rgba(0,255,153,.07);}
        .sidebar-av{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
        .sidebar-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
        .sidebar-company{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sidebar-email{font-size:10px;color:#8899bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sidebar-score{font-size:10px;font-weight:700;flex-shrink:0;}
        .sidebar-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px 10px;color:#8899bb;font-size:12px;text-align:center;}

        .compose-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:22px;}
        .compose-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}
        .compose-hdr h2{font-size:16px;font-weight:600;}
        .ai-gen-btn{display:flex;align-items:center;gap:6px;background:rgba(0,255,153,.08);border:1px solid rgba(0,255,153,.2);color:#00ff99;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;}
        .ai-gen-btn:hover{background:rgba(0,255,153,.14);}

        /* AI Panel */
        .ai-panel{background:rgba(0,255,153,.04);border:1px solid rgba(0,255,153,.12);border-radius:12px;padding:16px;margin-bottom:16px;}
        .ai-panel-hdr{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#00ff99;margin-bottom:14px;}
        .ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}

        /* Fields */
        .field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
        .field:last-child{margin-bottom:0;}
        .field label{font-size:11px;color:#8899bb;font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;}
        .hint{font-size:10px;color:#8899bb;text-transform:none;letter-spacing:0;font-weight:400;}
        .field input,.field select,.field textarea{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:9px 12px;border-radius:9px;font-size:13px;font-family:'Inter',sans-serif;transition:.2s;}
        .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .field select option{background:#081633;}
        .field textarea{resize:vertical;}
        .compose-fields{display:flex;flex-direction:column;gap:0;}

        .generate-btn{display:flex;align-items:center;gap:6px;background:#00ff99;color:#020817;border:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;transition:.2s;}
        .generate-btn:disabled{opacity:.6;cursor:not-allowed;}
        .send-btn{display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:11px 22px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-top:14px;transition:.2s;}
        .send-btn:hover:not(:disabled){transform:translateY(-1px);}
        .send-btn:disabled{opacity:.6;cursor:not-allowed;}
        .smtp-warn{display:flex;align-items:center;gap:5px;font-size:12px;color:#ffd700;margin-top:8px;}
        .send-result{display:flex;align-items:center;gap:6px;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:10px;}
        .send-result.success{background:rgba(0,255,153,.08);color:#00ff99;border:1px solid rgba(0,255,153,.2);}
        .send-result.error{background:rgba(255,77,77,.08);color:#ff4d4d;border:1px solid rgba(255,77,77,.2);}

        /* Bulk */
        .bulk-layout{display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start;}
        .bulk-leads-panel,.bulk-compose-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;}
        .bulk-panel-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .bulk-panel-hdr h3{font-size:14px;font-weight:600;}
        .lead-count{color:#8899bb;font-weight:400;}
        .select-all-btn{font-size:12px;background:none;border:1px solid rgba(0,255,153,.2);color:#00ff99;padding:4px 10px;border-radius:7px;cursor:pointer;}
        .lead-list{display:flex;flex-direction:column;gap:6px;max-height:380px;overflow-y:auto;}
        .bulk-lead-row{display:flex;align-items:center;gap:10px;padding:9px 11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:9px;cursor:pointer;transition:.2s;}
        .bulk-lead-row:hover{border-color:rgba(0,255,153,.15);}
        .bulk-lead-row.selected{background:rgba(0,255,153,.06);border-color:rgba(0,255,153,.25);}
        .bulk-checkbox{width:17px;height:17px;border-radius:4px;border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#020817;flex-shrink:0;}
        .bulk-checkbox.checked{background:#00ff99;border-color:#00ff99;}
        .bulk-lead-av{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
        .bulk-lead-info{flex:1;min-width:0;}
        .bulk-lead-name{font-size:13px;font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .bulk-lead-email{font-size:11px;color:#8899bb;display:block;}
        .bulk-lead-score{font-size:11px;color:#00ff99;font-weight:600;}
        .ai-per-lead-toggle{display:flex;align-items:center;gap:5px;font-size:12px;color:#8899bb;cursor:pointer;}
        .ai-per-lead-toggle input{width:14px;height:14px;accent-color:#00ff99;}

        .bulk-progress{margin:12px 0;}
        .progress-track{height:5px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden;margin-bottom:6px;}
        .progress-fill{height:100%;background:linear-gradient(90deg,#00ff99,#00cc66);border-radius:5px;transition:width .4s ease;}
        .progress-text{display:flex;align-items:center;gap:6px;font-size:12px;color:#8899bb;}
        .bulk-done{display:flex;align-items:center;gap:7px;background:rgba(0,255,153,.08);border:1px solid rgba(0,255,153,.2);border-radius:9px;padding:10px 14px;font-size:13px;color:#00ff99;font-weight:600;margin-top:10px;}

        /* Logs */
        .logs-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;}
        .logs-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
        .logs-hdr h3{font-size:14px;font-weight:600;}
        .refresh-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;}
        .logs-table-wrap{overflow-x:auto;}
        .logs-table{width:100%;border-collapse:collapse;}
        .logs-table th{padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#8899bb;border-bottom:1px solid rgba(255,255,255,.07);}
        .logs-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;}
        .logs-table tr:last-child td{border-bottom:none;}
        .log-to{color:#3b9eff;font-size:12px;}
        .log-subject{color:#ccc;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
        .tag{background:rgba(255,255,255,.07);color:#ccc;padding:2px 8px;border-radius:8px;font-size:11px;}
        .log-status{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;}
        .log-date{color:#8899bb;font-size:11px;white-space:nowrap;}

        /* Loading/Empty */
        .loading-rows{display:flex;flex-direction:column;gap:6px;padding:6px 0;}
        .skeleton-row{height:48px;background:rgba(255,255,255,.04);border-radius:8px;animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:10px;padding:50px;color:#8899bb;font-size:13px;}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;}
        .modal-box{background:#06102a;border:1px solid rgba(0,255,153,.15);border-radius:18px;width:440px;max-width:92%;overflow:hidden;}
        .modal-head{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:flex-start;}
        .modal-head h3{font-size:16px;font-weight:600;}
        .modal-head p{font-size:12px;color:#8899bb;margin-top:3px;}
        .modal-head button{background:none;border:none;color:#8899bb;cursor:pointer;}
        .modal-body{padding:18px 22px;display:flex;flex-direction:column;gap:14px;}
        .smtp-tip{font-size:12px;color:#8899bb;line-height:1.5;}
        .smtp-tip a{color:#3b9eff;}
        .modal-foot{padding:14px 22px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;gap:10px;}
        .cancel-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:8px 16px;border-radius:8px;cursor:pointer;}
        .save-btn-modal{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;}

        .spin{animation:spin .7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:1100px){.bulk-layout{grid-template-columns:1fr;}.ai-grid{grid-template-columns:1fr;}.compose-layout{grid-template-columns:220px 1fr;}}
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}
          .page-header{flex-direction:column;}
          .compose-layout{grid-template-columns:1fr;}
          .leads-sidebar{max-height:220px;}
        }
      `}</style>
    </>
  );
}
