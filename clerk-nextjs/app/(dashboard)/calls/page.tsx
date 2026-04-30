"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, PhoneIncoming,
  MessageSquare, ClipboardList, Lock, AlertTriangle,
  TrendingUp, Users, ChevronDown, Send, ExternalLink, Mail,Search,X
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb" },
  trial:    { label:"Trial",        color:"#ffd700" },
  starter:  { label:"Starter",      color:"#00ff99" },
  pro:      { label:"Professional", color:"#3b9eff" },
  business: { label:"Business",     color:"#a78bfa" },
  expired:  { label:"Expired",      color:"#ff6b6b" },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

interface SavedLead {
  id: string; company: string; phone: string | null;
  email: string | null; industry: string | null;
  address: string | null; score: number; priority: string;
}
interface CallLog {
  id: string; phone: string; company: string | null;
  contactName: string | null; status: string;
  notes: string | null; calledAt: string;
}
interface CallStats { total:number; connected:number; missed:number; noAnswer:number; }

const STATUS_CFG: Record<string,{label:string;color:string;bg:string;Icon:any}> = {
  connected: { label:"Connected", color:"#00ff99", bg:"rgba(0,255,153,.12)", Icon:PhoneCall   },
  missed:    { label:"Missed",    color:"#ff4d4d", bg:"rgba(255,77,77,.12)",  Icon:PhoneMissed },
  no_answer: { label:"No Answer", color:"#ffd700", bg:"rgba(255,215,0,.12)",  Icon:PhoneOff    },
  initiated: { label:"Initiated", color:"#3b9eff", bg:"rgba(59,158,255,.12)", Icon:PhoneIncoming},
  scheduled: { label:"Scheduled", color:"#a78bfa", bg:"rgba(167,139,250,.12)",Icon:ClipboardList},
};
const PRIORITY_COLOR: Record<string,string> = { High:"#ff4d4d", Medium:"#ffd700", Low:"#00ff99" };

export default function CallsPage() {
  const { user } = useUser();
  const [activeTab,     setActiveTab]     = useState<"leads"|"history">("leads");
  const [dbUser,        setDbUser]        = useState<any>(null);

  // Leads
  const [savedLeads,   setSavedLeads]   = useState<SavedLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [search,       setSearch]       = useState("");

  // Call modal
  const [callModal,  setCallModal]  = useState<SavedLead|null>(null);
  const [callStatus, setCallStatus] = useState("connected");
  const [callNotes,  setCallNotes]  = useState("");
  const [savingLog,  setSavingLog]  = useState(false);

  // Call history
  const [callLogs,    setCallLogs]    = useState<CallLog[]>([]);
  const [callStats,   setCallStats]   = useState<CallStats>({total:0,connected:0,missed:0,noAnswer:0});
  const [logsLoading, setLogsLoading] = useState(false);

  // Bulk WhatsApp
  const [bulkWaMode,       setBulkWaMode]       = useState(false);
  const [selectedWaLeads,  setSelectedWaLeads]  = useState<SavedLead[]>([]);
  const [showWaModal,      setShowWaModal]       = useState(false);
  const [waMessage,        setWaMessage]         = useState(`Hi, I came across {{company}} and would love to discuss a potential collaboration. Are you available for a quick call?`);
  const [waSending,        setWaSending]         = useState(false);
  const [waDone,           setWaDone]            = useState(false);
  const [waSentCount,      setWaSentCount]       = useState(0);

  const userEmail = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userEmail) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail }) })
      .then(r=>r.json()).then(setDbUser).catch(console.error);
  }, [userEmail]);

  // ── Fetch leads ───────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!userEmail) return;
    setLeadsLoading(true);
    try {
      const res  = await fetch("/api/leads/saved", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail, page:1, limit:100 }) });
      const data = await res.json();
      setSavedLeads(data.leads || []);
    } catch(e){console.error(e);}
    finally{setLeadsLoading(false);}
  },[userEmail]);

  useEffect(()=>{fetchLeads();},[fetchLeads]);

  // ── Fetch call logs ───────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    if (!userEmail) return;
    setLogsLoading(true);
    try {
      const res  = await fetch("/api/calls", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:userEmail }) });
      const data = await res.json();
      setCallLogs(data.logs || []);
      setCallStats(data.stats || {total:0,connected:0,missed:0,noAnswer:0});
    } catch(e){console.error(e);}
    finally{setLogsLoading(false);}
  },[userEmail]);

  useEffect(()=>{if(activeTab==="history")fetchLogs();},[activeTab,fetchLogs]);

  // ── Save call log ─────────────────────────────────────────────────────────
  const handleSaveLog = async () => {
    if (!callModal||!userEmail) return;
    setSavingLog(true);
    try {
      await fetch("/api/calls", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"log", email:userEmail, phone:callModal.phone, company:callModal.company, status:callStatus, notes:callNotes }) });
      setCallModal(null); setCallNotes(""); setCallStatus("connected");
    } catch(e){console.error(e);}
    finally{setSavingLog(false);}
  };

  // ── Bulk WhatsApp ─────────────────────────────────────────────────────────
  const toggleWaLead = (lead:SavedLead) => {
    if (!lead.phone) return;
    setSelectedWaLeads(prev => prev.find(l=>l.id===lead.id) ? prev.filter(l=>l.id!==lead.id) : [...prev,lead]);
  };
  const selectAllWa = () => {
    const withPhone = savedLeads.filter(l=>l.phone);
    setSelectedWaLeads(selectedWaLeads.length===withPhone.length?[]:withPhone);
  };
  const handleBulkWaSend = async () => {
    if (!selectedWaLeads.length||waSending) return;
    setWaSending(true); setWaDone(false); setWaSentCount(0);
    for (let i=0;i<selectedWaLeads.length;i++) {
      const lead = selectedWaLeads[i];
      if (!lead.phone) continue;
      const msg = waMessage.replace(/{{company}}/g, lead.company);
      const cleaned = cleanPhone(lead.phone);
      const wa = `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
      window.open(wa,"_blank");
      setWaSentCount(i+1);
      await new Promise(r=>setTimeout(r,1500));
    }
    setWaDone(true); setWaSending(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAdmin       = dbUser?.role === "admin";
  const isTest        = dbUser?.role === "test";
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey)||"free");
  const planCfg       = PLAN_CONFIG[effectivePlan]||PLAN_CONFIG.free;
  const canAccess     = isAdmin || isTest || (effectivePlan!=="free" && effectivePlan!=="expired");

  const fmtDate = (d:string) => { try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return "";} };

  // Fix phone: if starts with 0 (local PK number), replace with 92
  const cleanPhone = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) return "92" + digits.slice(1);
    return digits;
  };
  const filtered = savedLeads.filter(l => l.company.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search));

  return (
    <>
      <div className="main">

        {/* ── FREE / EXPIRED GATE ── */}
        {!canAccess && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>{effectivePlan==="expired"?"Your trial has expired":"Calls is a Paid Feature"}</h3>
            <p>{effectivePlan==="expired"
              ?"Upgrade to continue logging calls and tracking your outreach."
              :"Upgrade to log calls, track outcomes, and send bulk WhatsApp messages to your leads."}</p>
            <a href="/billing" className="gate-cta">
              {effectivePlan==="expired"?"Choose a Plan":"Start Free Trial or Upgrade"}
            </a>
            <div className="gate-perks">
              {["Call logging & history","Bulk WhatsApp sender","Call outcome tracking","Lead call stats"].map(f=>(
                <span key={f} className="perk"><Phone size={11} color="#00ff99"/>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {canAccess && (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Calls</h1>
                <p>Log calls, track outcomes, and send WhatsApp messages to your leads</p>
              </div>
              <span className="plan-chip" style={{color:planCfg.color,borderColor:`${planCfg.color}44`,background:`${planCfg.color}11`}}>
                {planCfg.label}
              </span>
            </div>

            {/* Tabs */}
            <div className="tabs-row">
              {[
                {id:"leads",   label:"Lead Calls",    Icon:Users},
                {id:"history", label:"Call History",  Icon:ClipboardList},
              ].map(({id,label,Icon})=>(
                <button key={id} className={`tab-btn ${activeTab===id?"active":""}`} onClick={()=>setActiveTab(id as any)}>
                  <Icon size={14} strokeWidth={1.8}/>{label}
                </button>
              ))}
            </div>

            {/* ── LEADS TAB ── */}
            {activeTab==="leads" && (
              <>
                {/* Stats */}
                <div className="stats-row">
                  {[
                    {Icon:Users,       label:"Total Leads",   value:savedLeads.length,       color:"#00ff99"},
                    {Icon:PhoneCall,   label:"With Phone",    value:savedLeads.filter(l=>l.phone).length, color:"#3b9eff"},
                    {Icon:PhoneMissed, label:"No Phone",      value:savedLeads.filter(l=>!l.phone).length,color:"#ffd700"},
                    {Icon:TrendingUp,  label:"Calls Logged",  value:callStats.total,          color:"#a78bfa"},
                  ].map(({Icon,label,value,color})=>(
                    <div key={label} className="stat-card">
                      <div className="stat-icon" style={{background:`${color}14`,border:`1px solid ${color}28`}}>
                        <Icon size={17} color={color} strokeWidth={1.8}/>
                      </div>
                      <div><h3>{value}</h3><p>{label}</p></div>
                    </div>
                  ))}
                </div>

                {/* Bulk WA toolbar */}
                <div className="leads-table-wrap">
                  <div className="bulk-wa-bar">
                    <div className="bulk-wa-left">
                      <button className={`bulk-wa-toggle ${bulkWaMode?"active":""}`} onClick={()=>{setBulkWaMode(p=>!p);setSelectedWaLeads([]);}}>
                        <MessageSquare size={13}/>Bulk WhatsApp
                      </button>
                      {bulkWaMode && (
                        <>
                          <button className="select-all-wa" onClick={selectAllWa}>
                            {selectedWaLeads.length===savedLeads.filter(l=>l.phone).length?"Deselect All":"Select All"}
                          </button>
                          <span className="wa-count">{selectedWaLeads.length} selected</span>
                        </>
                      )}
                    </div>
                    {bulkWaMode && selectedWaLeads.length > 0 && (
                      <button className="send-bulk-wa-btn" onClick={()=>setShowWaModal(true)}>
                        <Send size={13}/>Send WhatsApp ({selectedWaLeads.length})
                      </button>
                    )}
                  </div>

                  {/* Search */}
                  <div className="search-bar">
                    <Search size={14} color="#8899bb" className="search-icon"/>
                    <input className="search-input" placeholder="Search leads by name or phone..."
                      value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>

                  {leadsLoading ? (
                    <div className="loading-rows">{[...Array(5)].map((_,i)=><div key={i} className="skeleton-row"/>)}</div>
                  ) : (
                    <>
                      {/* With phone */}
                      <div className="section-label"><Phone size={12}/>Leads with Phone Numbers ({filtered.filter(l=>l.phone).length})</div>
                      <div className="table-scroll">
                      <table className="leads-table">
                        <thead><tr>
                          {bulkWaMode&&<th/>}
                          <th>Company</th><th>Phone</th><th>Industry</th><th>Priority</th><th>Score</th><th>Actions</th>
                        </tr></thead>
                        <tbody>
                          {filtered.filter(l=>l.phone).map(lead=>{
                            const isWaSelected = selectedWaLeads.find(l=>l.id===lead.id);
                            return (
                              <tr key={lead.id} className={isWaSelected?"wa-selected-row":""} onClick={()=>bulkWaMode&&toggleWaLead(lead)}>
                                {bulkWaMode&&(
                                  <td><div className={`wa-checkbox ${isWaSelected?"checked":""}`}>{isWaSelected&&"✓"}</div></td>
                                )}
                                <td>
                                  <div className="company-cell">
                                    <div className="company-av">{lead.company.charAt(0).toUpperCase()}</div>
                                    <div>
                                      <span className="company-name">{lead.company}</span>
                                      {lead.address&&<span className="company-addr">{lead.address.split(",").slice(-2).join(",").trim()}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td><a href={`tel:${lead.phone}`} className="phone-link"><Phone size={12}/>{lead.phone}</a></td>
                                <td><span className="tag">{lead.industry||"—"}</span></td>
                                <td><span className="priority-tag" style={{color:PRIORITY_COLOR[lead.priority],background:PRIORITY_COLOR[lead.priority]+"18"}}>{lead.priority}</span></td>
                                <td><span className="score-tag">{lead.score}</span></td>
                                <td>
                                  {!bulkWaMode&&(
                                    <div className="action-btns">
                                      <a href={`tel:${lead.phone}`} className="call-btn"><PhoneCall size={13}/>Call</a>
                                      <a href={`https://wa.me/${cleanPhone(lead.phone)}`} target="_blank" rel="noreferrer" className="wa-btn">
                                        <MessageSquare size={13}/>WhatsApp
                                      </a>
                                      <button className="log-btn" onClick={()=>{setCallModal(lead);setCallStatus("connected");setCallNotes("");}}>
                                        <ClipboardList size={13}/>Log
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>{/* end table-scroll */}

                      {/* Without phone */}
                      {filtered.filter(l=>!l.phone).length > 0 && (
                        <div className="no-phone-section">
                          <div className="section-label warning"><PhoneOff size={12}/>No Phone Number ({filtered.filter(l=>!l.phone).length})</div>
                          <div className="no-phone-grid">
                            {filtered.filter(l=>!l.phone).map(lead=>(
                              <div key={lead.id} className="no-phone-card">
                                <div className="company-av sm">{lead.company.charAt(0).toUpperCase()}</div>
                                <div className="no-phone-info">
                                  <span className="company-name">{lead.company}</span>
                                  <span className="no-phone-msg">No phone listed</span>
                                </div>
                                <a href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(lead.company)}`}
                                  target="_blank" rel="noreferrer" className="li-btn">
                                  <ExternalLink size={12}/>Find
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab==="history" && (
              <>
                <div className="stats-row">
                  {[
                    {Icon:PhoneCall,   label:"Total Calls",  value:callStats.total,     color:"#00ff99"},
                    {Icon:PhoneCall,   label:"Connected",    value:callStats.connected,  color:"#3b9eff"},
                    {Icon:PhoneMissed, label:"Missed",       value:callStats.missed,     color:"#ff4d4d"},
                    {Icon:PhoneOff,    label:"No Answer",    value:callStats.noAnswer,   color:"#ffd700"},
                  ].map(({Icon,label,value,color})=>(
                    <div key={label} className="stat-card">
                      <div className="stat-icon" style={{background:`${color}14`,border:`1px solid ${color}28`}}>
                        <Icon size={17} color={color} strokeWidth={1.8}/>
                      </div>
                      <div><h3>{value}</h3><p>{label}</p></div>
                    </div>
                  ))}
                </div>

                <div className="history-table-wrap">
                  {logsLoading ? (
                    <div className="loading-rows">{[...Array(5)].map((_,i)=><div key={i} className="skeleton-row"/>)}</div>
                  ) : callLogs.length===0 ? (
                    <div className="empty-state">
                      <ClipboardList size={40} color="#8899bb" strokeWidth={1.2}/>
                      <p>No call logs yet. Log your first call from the Lead Calls tab.</p>
                    </div>
                  ) : (
                    <div className="table-scroll">
                    <table className="leads-table">
                      <thead><tr>
                        <th>Company</th><th>Phone</th><th>Status</th><th>Notes</th><th>Date</th>
                      </tr></thead>
                      <tbody>
                        {callLogs.map(log=>{
                          const cfg = STATUS_CFG[log.status]||STATUS_CFG.initiated;
                          const StatusIcon = cfg.Icon;
                          return (
                            <tr key={log.id}>
                              <td>
                                <div className="company-cell">
                                  <div className="company-av sm">{(log.company||"?").charAt(0).toUpperCase()}</div>
                                  <span className="company-name">{log.company||"Unknown"}</span>
                                </div>
                              </td>
                              <td><a href={`tel:${log.phone}`} className="phone-link"><Phone size={12}/>{log.phone}</a></td>
                              <td>
                                <span className="status-tag" style={{color:cfg.color,background:cfg.bg}}>
                                  <StatusIcon size={11}/>{cfg.label}
                                </span>
                              </td>
                              <td><span className="notes-cell">{log.notes||"—"}</span></td>
                              <td><span className="date-cell">{fmtDate(log.calledAt)}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── CALL LOG MODAL ── */}
      {callModal && (
        <div className="modal-overlay" onClick={()=>setCallModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Log Call — {callModal.company}</h3>
                <p>{callModal.phone}</p>
              </div>
              <button onClick={()=>setCallModal(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Quick Actions</label>
                <div className="quick-actions">
                  <a href={`tel:${callModal.phone}`} className="quick-call-btn"><PhoneCall size={14}/>Call Now</a>
                  <a href={`https://wa.me/${cleanPhone(callModal.phone)}`} target="_blank" rel="noreferrer" className="quick-wa-btn">
                    <MessageSquare size={14}/>WhatsApp
                  </a>
                  {callModal.email&&<a href={`mailto:${callModal.email}`} className="quick-email-btn"><Mail size={14}/>Email</a>}
                </div>
              </div>
              <div className="field-group">
                <label>Call Outcome</label>
                <div className="status-options">
                  {Object.entries(STATUS_CFG).map(([key,cfg])=>{
                    const SIcon = cfg.Icon;
                    return (
                      <button key={key} className={`status-opt ${callStatus===key?"selected":""}`}
                        style={callStatus===key?{background:cfg.bg,color:cfg.color,borderColor:cfg.color}:{}}
                        onClick={()=>setCallStatus(key)}>
                        <SIcon size={12}/>{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="field-group">
                <label>Notes</label>
                <textarea rows={3} placeholder="Add call notes..." value={callNotes} onChange={e=>setCallNotes(e.target.value)}/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="cancel-btn" onClick={()=>setCallModal(null)}>Cancel</button>
              <button className="save-btn" onClick={handleSaveLog} disabled={savingLog}>
                {savingLog?"Saving...":"Save Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP BULK MODAL ── */}
      {showWaModal && (
        <div className="modal-overlay" onClick={()=>!waSending&&setShowWaModal(false)}>
          <div className="modal-box wa-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Bulk WhatsApp</h3>
                <p>{selectedWaLeads.length} leads selected</p>
              </div>
              <button onClick={()=>!waSending&&setShowWaModal(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Selected Leads</label>
                <div className="wa-leads-preview">
                  {selectedWaLeads.slice(0,5).map(l=><span key={l.id} className="wa-lead-chip">{l.company}</span>)}
                  {selectedWaLeads.length>5&&<span className="wa-lead-chip more">+{selectedWaLeads.length-5} more</span>}
                </div>
              </div>
              <div className="field-group">
                <label>Message Template</label>
                <textarea rows={4} value={waMessage} onChange={e=>setWaMessage(e.target.value)} disabled={waSending}/>
                <p className="wa-tip">Use {"{{company}}"} — it will be replaced with each company's name.</p>
              </div>
              <div className="field-group">
                <label>Preview</label>
                <div className="wa-preview-box">
                  <span className="wa-preview-label">Message to: {selectedWaLeads[0]?.company}</span>
                  <span className="wa-preview-text">{waMessage.replace(/{{company}}/g,selectedWaLeads[0]?.company||"Company")}</span>
                </div>
              </div>
              {waSending&&(
                <div className="wa-progress">
                  <div className="wa-progress-bar-track"><div className="wa-progress-bar-fill" style={{width:`${(waSentCount/selectedWaLeads.length)*100}%`}}/></div>
                  <p className="wa-progress-text"><MessageSquare size={13}/>Sending {waSentCount} of {selectedWaLeads.length}...</p>
                </div>
              )}
              {waDone&&<div className="wa-done-banner"><MessageSquare size={14}/> Done! {waSentCount} WhatsApp windows opened.</div>}
            </div>
            <div className="modal-foot">
              <button className="cancel-btn" onClick={()=>setShowWaModal(false)} disabled={waSending}>Cancel</button>
              {!waDone&&(
                <button className="save-btn" onClick={handleBulkWaSend} disabled={waSending}>
                  {waSending?<><span className="spinner"/>Sending...</>:<><Send size={14}/>Send All</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}
        .gate-perks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;}
        .perk{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.06);border:1px solid rgba(0,255,153,.14);color:#ccc;font-size:12px;padding:5px 12px;border-radius:20px;}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .plan-chip{font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;border:1px solid;}

        /* Tabs */
        .tabs-row{display:flex;gap:6px;margin-bottom:20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:5px;}
        .tab-btn{display:flex;align-items:center;gap:7px;flex:1;justify-content:center;padding:9px 16px;border-radius:7px;border:none;background:none;color:#8899bb;font-size:13px;font-weight:500;cursor:pointer;transition:.2s;}
        .tab-btn.active{background:rgba(0,255,153,.1);color:#00ff99;}

        /* Stats */
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}
        .stat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;}
        .stat-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .stat-card h3{font-size:20px;font-weight:700;}
        .stat-card p{font-size:12px;color:#8899bb;margin-top:2px;}

        /* Table wrapper */
        .leads-table-wrap,.history-table-wrap{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-bottom:20px;}
        /* Scroll container sits inside the wrapper, below bulk-wa-bar & search */
        .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .leads-table{width:100%;border-collapse:collapse;min-width:620px;}
        .leads-table th{padding:11px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#8899bb;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.07);white-space:nowrap;}
        .leads-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle;}
        .leads-table tr:last-child td{border-bottom:none;}
        .leads-table tr:hover td{background:rgba(0,255,153,.02);}

        /* Bulk WA bar */
        .bulk-wa-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.07);flex-wrap:wrap;gap:10px;}
        .bulk-wa-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .bulk-wa-toggle{display:flex;align-items:center;gap:6px;background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.2);color:#25d366;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:.2s;}
        .bulk-wa-toggle.active{background:rgba(37,211,102,.18);border-color:rgba(37,211,102,.5);}
        .select-all-wa{background:none;border:1px solid rgba(37,211,102,.25);color:#25d366;padding:5px 10px;border-radius:8px;cursor:pointer;font-size:11px;}
        .wa-count{font-size:12px;color:#25d366;font-weight:600;}
        .send-bulk-wa-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;color:white;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;transition:.2s;}
        .send-bulk-wa-btn:hover{transform:translateY(-1px);}

        /* Search */
        .search-bar{position:relative;display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.07);}
        .search-icon{position:absolute;left:28px;pointer-events:none;}
        .search-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:8px 12px 8px 34px;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;}
        .search-input:focus{outline:none;border-color:rgba(0,255,153,.4);}

        /* Section labels */
        .section-label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#8899bb;text-transform:uppercase;letter-spacing:.5px;padding:8px 16px;background:rgba(0,255,153,.04);border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);}
        .section-label.warning{background:rgba(255,215,0,.04);color:#ffd700;}

        /* Cells */
        .company-cell{display:flex;align-items:center;gap:10px;}
        .company-av{width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
        .company-av.sm{width:28px;height:28px;font-size:12px;border-radius:6px;}
        .company-name{font-weight:500;display:block;}
        .company-addr{font-size:11px;color:#8899bb;display:block;margin-top:1px;}
        .tag{background:rgba(255,255,255,.07);color:#ccc;padding:3px 9px;border-radius:9px;font-size:11px;}
        .priority-tag{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;}
        .score-tag{background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.2);padding:3px 9px;border-radius:9px;font-size:12px;font-weight:700;}
        .phone-link{display:flex;align-items:center;gap:5px;color:#3b9eff;text-decoration:none;font-weight:500;font-size:12px;}
        .phone-link:hover{text-decoration:underline;}
        .status-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;}
        .notes-cell{color:#8899bb;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
        .date-cell{color:#8899bb;font-size:12px;white-space:nowrap;}

        /* Action buttons */
        .action-btns{display:flex;gap:6px;align-items:center;}
        .call-btn{display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#00ff99,#00cc66);border:none;color:#020817;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;transition:.2s;text-decoration:none;}
        .call-btn:hover{transform:translateY(-1px);}
        .wa-btn{display:flex;align-items:center;gap:5px;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.3);color:#25d366;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;text-decoration:none;transition:.2s;}
        .wa-btn:hover{background:rgba(37,211,102,.2);}
        .log-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;transition:.2s;}
        .log-btn:hover{background:rgba(255,255,255,.1);color:white;}

        /* WA checkbox */
        .wa-checkbox{width:18px;height:18px;border-radius:4px;border:1.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#020817;transition:.2s;flex-shrink:0;}
        .wa-checkbox.checked{background:#25d366;border-color:#25d366;}
        .wa-selected-row td{background:rgba(37,211,102,.05)!important;cursor:pointer;}

        /* No phone section */
        .no-phone-section{padding:12px 16px;}
        .no-phone-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
        .no-phone-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;}
        .no-phone-info{flex:1;min-width:0;}
        .no-phone-msg{display:block;font-size:11px;color:#8899bb;margin-top:2px;}
        .li-btn{display:flex;align-items:center;gap:5px;background:rgba(0,119,181,.12);color:#0077b5;border:1px solid rgba(0,119,181,.3);padding:5px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;}

        /* Loading/Empty */
        .loading-rows{display:flex;flex-direction:column;gap:6px;padding:14px;}
        .skeleton-row{height:50px;background:rgba(255,255,255,.04);border-radius:8px;animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#8899bb;font-size:14px;}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;}
        .modal-box{background:#06102a;border:1px solid rgba(0,255,153,.15);border-radius:18px;width:480px;max-width:92%;overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}
        .wa-modal{max-width:520px;}
        .modal-head{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;}
        .modal-head h3{font-size:16px;font-weight:600;}
        .modal-head p{font-size:12px;color:#8899bb;margin-top:3px;}
        .modal-head button{background:none;border:none;color:#8899bb;cursor:pointer;}
        .modal-body{padding:18px 22px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;}
        .field-group{display:flex;flex-direction:column;gap:7px;}
        .field-group label{font-size:11px;color:#8899bb;text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
        .field-group textarea{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:10px 12px;border-radius:8px;font-size:13px;resize:vertical;font-family:'Inter',sans-serif;min-height:80px;max-height:180px;overflow-y:auto;}
        .field-group textarea:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .status-options{display:flex;gap:7px;flex-wrap:wrap;}
        .status-opt{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#8899bb;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:.2s;}
        .status-opt:hover{color:white;}
        .quick-actions{display:flex;gap:8px;flex-wrap:wrap;}
        .quick-call-btn{display:flex;align-items:center;gap:6px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.25);color:#00ff99;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;}
        .quick-wa-btn{display:flex;align-items:center;gap:6px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.25);color:#25d366;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;}
        .quick-email-btn{display:flex;align-items:center;gap:6px;background:rgba(59,158,255,.1);border:1px solid rgba(59,158,255,.25);color:#3b9eff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;}
        .modal-foot{padding:14px 22px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;gap:10px;}
        .cancel-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:8px 16px;border-radius:8px;cursor:pointer;}
        .save-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;}
        .save-btn:disabled{opacity:.6;cursor:not-allowed;}
        .spinner{width:14px;height:14px;border:2px solid rgba(2,8,23,.3);border-top-color:#020817;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* WA modal specific */
        .wa-leads-preview{display:flex;flex-wrap:wrap;gap:6px;}
        .wa-lead-chip{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.25);color:#25d366;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
        .wa-lead-chip.more{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12);color:#8899bb;}
        .wa-preview-box{background:rgba(37,211,102,.04);border:1px solid rgba(37,211,102,.15);border-radius:10px;padding:12px 14px;}
        .wa-preview-label{font-size:11px;color:#8899bb;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;}
        .wa-preview-text{font-size:13px;color:#c8efd8;line-height:1.6;white-space:pre-wrap;display:block;}
        .wa-progress{display:flex;flex-direction:column;gap:8px;}
        .wa-progress-bar-track{height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;}
        .wa-progress-bar-fill{height:100%;background:linear-gradient(90deg,#25d366,#128c7e);border-radius:4px;transition:width .4s ease;}
        .wa-progress-text{display:flex;align-items:center;gap:6px;font-size:12px;color:#8899bb;}
        .wa-done-banner{display:flex;align-items:center;gap:8px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.25);border-radius:10px;padding:12px;color:#25d366;font-size:13px;font-weight:600;}
        .wa-tip{font-size:11px;color:#8899bb;line-height:1.5;}

        @media(max-width:1100px){.stats-row{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}
          .stats-row{grid-template-columns:repeat(2,1fr);}
          .action-btns{flex-direction:column;}
          .page-header{flex-direction:column;}
        }
      `}</style>
    </>
  );
}
