"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Search, Bookmark, Trash2, ExternalLink, Globe, Lock,
  ChevronLeft, ChevronRight, Star, Filter, Download, Phone,
  Briefcase, Clock, MapPin, Building2,
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", canExport:false },
  trial:    { label:"Trial",        color:"#ffd700", canExport:false },
  starter:  { label:"Starter",      color:"#00ff99", canExport:false },
  pro:      { label:"Professional", color:"#3b9eff", canExport:true  },
  business: { label:"Business",     color:"#a78bfa", canExport:true  },
  expired:  { label:"Expired",      color:"#ff6b6b", canExport:false },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

const PRIORITY_COLOR: Record<string,string> = { High:"#ff4d4d", Medium:"#ffd700", Low:"#00ff99" };
const STATUS_COLOR:   Record<string,string> = { new:"#00ff99", contacted:"#3b9eff", qualified:"#ffd700", converted:"#00e676", lost:"#ff6b6b" };

interface Lead {
  id: string;
  company: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  score: number;
  priority: string;
  status: string;
  aiInsights: string | null;
  source: string | null;
  linkedinUrl: string | null;
  createdAt: string;
}

interface SavedJob {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  type: string;
  postedAt: string;
  description: string;
  applyUrl: string;
  source: string;
  salary?: string;
  createdAt: string;
}

export default function SavedLeadsPage() {
  const { user } = useUser();
  const [leads,          setLeads]          = useState<Lead[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [total,          setTotal]          = useState(0);
  const [deletingId,     setDeletingId]     = useState<string|null>(null);
  const [dbUser,         setDbUser]         = useState<any>(null);
  const [activeTab,      setActiveTab]      = useState<"leads"|"jobs">("leads");
  const [savedJobs,      setSavedJobs]      = useState<SavedJob[]>([]);
  const [jobsLoading,    setJobsLoading]    = useState(false);
  const [deletingJobId,  setDeletingJobId]  = useState<string|null>(null);

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r=>r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  // ── Fetch leads ───────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/leads/saved", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email, page, search, priority:priorityFilter, limit:15 }),
      });
      const data = await res.json();
      setLeads(data.leads || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, [email, page, search, priorityFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Fetch Saved Jobs ──────────────────────────────────────────────────────
  const fetchSavedJobs = useCallback(async () => {
    if (!email) return;
    setJobsLoading(true);
    try {
      const res = await fetch(`/api/jobs/save?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setSavedJobs(data.savedJobs || []);
    } catch(err) { console.error(err); }
    finally { setJobsLoading(false); }
  }, [email]);

  useEffect(() => { if (activeTab === "jobs") fetchSavedJobs(); }, [activeTab, fetchSavedJobs]);

  // ── Delete Saved Job ──────────────────────────────────────────────────────
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Remove this job from saved?")) return;
    setDeletingJobId(jobId);
    try {
      await fetch("/api/jobs/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, savedJobId: jobId }),
      });
      setSavedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch(err) { console.error(err); }
    finally { setDeletingJobId(null); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (leadId: string) => {
    if (!confirm("Remove this lead from saved?")) return;
    setDeletingId(leadId);
    try {
      await fetch("/api/leads/saved", {
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ leadId, email }),
      });
      setLeads(prev=>prev.filter(l=>l.id!==leadId));
      setTotal(prev=>prev-1);
    } catch(err){console.error(err);}
    finally{setDeletingId(null);}
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format: string) => {
    if (!email || !canExport) return;
    const res = await fetch("/api/export", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ email, format, filters:{ saved:true } }),
    });
    if (format === "pdf") {
      const html = await res.text();
      const w = window.open("","_blank");
      w?.document.write(html); w?.document.close();
    } else {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `leads.${format==="excel"?"xls":format}`;
      a.click(); URL.revokeObjectURL(url);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAdmin       = dbUser?.role === "admin";
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey) || "free");
  const planCfg       = PLAN_CONFIG[effectivePlan] || PLAN_CONFIG.free;
  const canAccess     = isAdmin || (effectivePlan !== "free" && effectivePlan !== "expired");
  const canExport     = isAdmin || planCfg.canExport;

  return (
    <>
      <div className="main">

        {/* ── FREE / EXPIRED GATE ── */}
        {!canAccess && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>{effectivePlan==="expired"?"Your trial has expired":"Saved Leads is a Paid Feature"}</h3>
            <p>
              {effectivePlan==="expired"
                ? "Upgrade to a plan to access your saved leads and continue building your pipeline."
                : "Upgrade to start saving and managing leads in your personal database."}
            </p>
            <a href="/billing" className="gate-cta">
              {effectivePlan==="expired"?"Choose a Plan":"Start Free Trial or Upgrade"}
            </a>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {canAccess && (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Saved Leads & Jobs</h1>
                <p>{total} leads · {savedJobs.length} jobs saved</p>
              </div>
              <div className="header-actions">
                {/* Export buttons — locked for starter/trial */}
                {canExport ? (
                  <>
                    <button className="export-btn" onClick={()=>handleExport("csv")}>
                      <Download size={13}/>CSV
                    </button>
                    <button className="export-btn" onClick={()=>handleExport("excel")}>
                      <Download size={13}/>Excel
                    </button>
                    <button className="export-btn" onClick={()=>handleExport("pdf")}>
                      <Download size={13}/>PDF
                    </button>
                  </>
                ) : (
                  <a href="/billing" className="export-locked-btn">
                    <Lock size={13}/>Export — Upgrade to Pro
                  </a>
                )}
                <a href="/lead-search" className="add-btn">
                  <Search size={13}/>New Search
                </a>
              </div>
            </div>

            {/* ── TABS ── */}
            <div className="tabs-bar">
              <button className={`tab-btn ${activeTab==="leads"?"tab-active":""}`} onClick={()=>setActiveTab("leads")}>
                <Bookmark size={14}/>Saved Leads <span className="tab-count">{total}</span>
              </button>
              <button className={`tab-btn ${activeTab==="jobs"?"tab-active":""}`} onClick={()=>setActiveTab("jobs")}>
                <Briefcase size={14}/>Saved Jobs <span className="tab-count">{savedJobs.length}</span>
              </button>
            </div>

            {/* ── LEADS TAB ── */}
            {activeTab === "leads" && (<>
            {/* Filters */}
            <div className="filter-bar">
              <div className="search-wrap">
                <Search size={14} color="#8899bb" className="search-icon"/>
                <input
                  className="search-input"
                  placeholder="Search by company, industry, phone..."
                  value={search}
                  onChange={e=>{setSearch(e.target.value);setPage(1);}}
                />
              </div>
              <div className="select-wrap">
                <Filter size={13} color="#8899bb"/>
                <select className="filter-select" value={priorityFilter} onChange={e=>{setPriorityFilter(e.target.value);setPage(1);}}>
                  <option value="">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="table-container">
              {loading ? (
                <div className="loading-state">
                  {[...Array(6)].map((_,i)=><div key={i} className="skeleton-row"/>)}
                </div>
              ) : leads.length === 0 ? (
                <div className="empty-state">
                  <Bookmark size={44} color="#8899bb" strokeWidth={1.2}/>
                  <h3>No saved leads yet</h3>
                  <p>{search||priorityFilter ? "No leads match your filters." : "Search for leads and save them to build your pipeline."}</p>
                  <a href="/lead-search" className="empty-cta"><Search size={14}/>Search Leads</a>
                </div>
              ) : (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Industry</th>
                          <th>Phone</th>
                          <th>Website</th>
                          <th>Score</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Links</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map(lead=>(
                          <tr key={lead.id}>
                            <td>
                              <div className="company-cell">
                                <div className="company-avatar">{lead.company.charAt(0).toUpperCase()}</div>
                                <div>
                                  <div className="company-name">{lead.company}</div>
                                  {lead.address && <div className="company-addr">{lead.address.split(",").slice(-2).join(",").trim()}</div>}
                                </div>
                              </div>
                            </td>
                            <td><span className="tag">{lead.industry||"—"}</span></td>
                            <td>
                              {lead.phone
                                ? <a href={`tel:${lead.phone}`} className="link-text"><Phone size={12}/>{lead.phone}</a>
                                : <span className="empty-cell">—</span>}
                            </td>
                            <td>
                              {lead.website
                                ? <a href={lead.website.startsWith("http")?lead.website:"https://"+lead.website} target="_blank" rel="noreferrer" className="link-text truncate">
                                    <Globe size={12}/>{lead.website.replace(/https?:\/\//,"").split("/")[0]}
                                  </a>
                                : <span className="empty-cell">—</span>}
                            </td>
                            <td>
                              <div className="score-pill">
                                <Star size={11} color="#ffd700"/>{lead.score}
                              </div>
                            </td>
                            <td>
                              <span className="priority-badge"
                                style={{color:PRIORITY_COLOR[lead.priority],background:PRIORITY_COLOR[lead.priority]+"22",border:`1px solid ${PRIORITY_COLOR[lead.priority]}44`}}>
                                {lead.priority}
                              </span>
                            </td>
                            <td>
                              <span className="status-badge"
                                style={{color:STATUS_COLOR[lead.status]||"#ccc",background:(STATUS_COLOR[lead.status]||"#ccc")+"22"}}>
                                {lead.status}
                              </span>
                            </td>
                            <td>
                              {lead.linkedinUrl && (
                                <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="li-btn">
                                  <ExternalLink size={12}/>
                                </a>
                              )}
                            </td>
                            <td>
                              <button
                                className="delete-btn"
                                onClick={()=>handleDelete(lead.id)}
                                disabled={deletingId===lead.id}
                              >
                                {deletingId===lead.id
                                  ? <span className="spinner"/>
                                  : <Trash2 size={14}/>}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>
                        <ChevronLeft size={15}/>Prev
                      </button>
                      {[...Array(Math.min(totalPages,7))].map((_,i)=>(
                        <button key={i} className={page===i+1?"active":""} onClick={()=>setPage(i+1)}>{i+1}</button>
                      ))}
                      <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>
                        Next<ChevronRight size={15}/>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Export locked note for starter/trial */}
            </>)}

            {/* ── JOBS TAB ── */}
            {activeTab === "jobs" && (
              <div className="table-container" style={{marginTop:"16px"}}>
                {jobsLoading ? (
                  <div className="loading-state">
                    {[...Array(4)].map((_,i)=><div key={i} className="skeleton-row"/>)}
                  </div>
                ) : savedJobs.length === 0 ? (
                  <div className="empty-state">
                    <Briefcase size={44} color="#8899bb" strokeWidth={1.2}/>
                    <h3>No saved jobs yet</h3>
                    <p>Search for jobs and save them to track your applications.</p>
                    <a href="/lead-search" className="empty-cta"><Search size={14}/>Search Jobs</a>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Job Title</th>
                          <th>Company</th>
                          <th>Location</th>
                          <th>Type</th>
                          <th>Salary</th>
                          <th>Posted</th>
                          <th>Source</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedJobs.map(job => (
                          <tr key={job.id}>
                            <td>
                              <div style={{fontWeight:500,fontSize:"13px"}}>{job.title}</div>
                              <div style={{fontSize:"11px",color:"#8899bb",marginTop:"2px",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.description}</div>
                            </td>
                            <td>
                              <div className="company-cell">
                                <div className="company-avatar" style={{background:"linear-gradient(135deg,#3b9eff,#0055cc)"}}>{job.company.charAt(0).toUpperCase()}</div>
                                <span className="company-name">{job.company}</span>
                              </div>
                            </td>
                            <td><span style={{fontSize:"12px",color:"#8899bb"}}>{job.location||"—"}</span></td>
                            <td>{job.type && <span className="tag">{job.type}</span>}</td>
                            <td><span style={{fontSize:"12px",color:"#00ff99",fontWeight:500}}>{job.salary||"—"}</span></td>
                            <td><span style={{fontSize:"12px",color:"#8899bb"}}>{job.postedAt}</span></td>
                            <td><span style={{fontSize:"12px",color:"#8899bb"}}>via {job.source}</span></td>
                            <td>
                              <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                                {job.applyUrl && job.applyUrl !== "#" && (
                                  <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                                    style={{display:"flex",alignItems:"center",gap:"4px",background:"rgba(59,158,255,.12)",border:"1px solid rgba(59,158,255,.25)",color:"#3b9eff",padding:"5px 10px",borderRadius:"7px",fontSize:"12px",textDecoration:"none",whiteSpace:"nowrap"}}>
                                    Apply <ExternalLink size={11}/>
                                  </a>
                                )}
                                <button className="delete-btn" onClick={()=>handleDeleteJob(job.id)} disabled={deletingJobId===job.id}>
                                  {deletingJobId===job.id ? <span className="spinner"/> : <Trash2 size={14}/>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "leads" && !canExport && (
              <div className="export-note">
                <Lock size={13} color="#8899bb"/>
                <span>Export (CSV, Excel, PDF) is available on <strong>Professional</strong> and <strong>Business</strong> plans.</span>
                <a href="/billing">Upgrade — $29/mo</a>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        /* Main */
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .header-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

        .export-btn{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;transition:.2s;}
        .export-btn:hover{background:rgba(255,255,255,.1);color:white;}
        .export-locked-btn{display:flex;align-items:center;gap:6px;background:rgba(136,153,187,.08);border:1px solid rgba(136,153,187,.2);color:#8899bb;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none;transition:.2s;}
        .export-locked-btn:hover{background:rgba(0,255,153,.08);border-color:rgba(0,255,153,.2);color:#00ff99;}
        .add-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;}

        /* Filter bar */
        .filter-bar{display:flex;gap:10px;margin-bottom:18px;}
        .search-wrap{flex:1;position:relative;display:flex;align-items:center;}
        .search-icon{position:absolute;left:12px;pointer-events:none;}
        .search-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:10px 12px 10px 36px;border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;}
        .search-input:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .select-wrap{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:0 12px;}
        .filter-select{background:none;border:none;color:white;padding:10px 0;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;outline:none;min-width:130px;}
        .filter-select option{background:#081633;}

        /* Table */
        .table-container{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;}
        .table-wrapper{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;}
        th{padding:12px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8899bb;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);white-space:nowrap;}
        td{padding:13px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;}
        tr:hover td{background:rgba(0,255,153,.02);}
        tr:last-child td{border-bottom:none;}

        .company-cell{display:flex;align-items:center;gap:10px;}
        .company-avatar{width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
        .company-name{font-weight:500;white-space:nowrap;}
        .company-addr{font-size:11px;color:#8899bb;margin-top:2px;}

        .tag{background:rgba(255,255,255,.07);color:#ccc;padding:3px 9px;border-radius:9px;font-size:11px;white-space:nowrap;}
        .empty-cell{color:#4a5568;}
        .link-text{display:flex;align-items:center;gap:4px;color:#3b9eff;text-decoration:none;font-size:12px;}
        .link-text:hover{text-decoration:underline;}
        .truncate{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

        .score-pill{display:inline-flex;align-items:center;gap:4px;background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.2);padding:3px 9px;border-radius:9px;font-size:12px;font-weight:600;}
        .priority-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;}
        .status-badge{padding:3px 9px;border-radius:20px;font-size:11px;text-transform:capitalize;}

        .li-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:rgba(0,119,181,.12);border:1px solid rgba(0,119,181,.25);color:#0077b5;border-radius:7px;text-decoration:none;transition:.2s;}
        .li-btn:hover{background:rgba(0,119,181,.22);}
        .delete-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:rgba(255,77,77,.08);border:1px solid rgba(255,77,77,.2);color:#ff4d4d;border-radius:8px;cursor:pointer;transition:.2s;}
        .delete-btn:hover:not(:disabled){background:rgba(255,77,77,.18);}
        .delete-btn:disabled{opacity:.5;cursor:not-allowed;}
        .spinner{width:14px;height:14px;border:2px solid rgba(255,77,77,.3);border-top-color:#ff4d4d;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Empty */
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:70px;text-align:center;}
        .empty-state h3{font-size:18px;}
        .empty-state p{color:#8899bb;font-size:14px;}
        .empty-cta{display:flex;align-items:center;gap:6px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;padding:9px 18px;border-radius:9px;text-decoration:none;font-size:13px;font-weight:600;transition:.2s;}
        .empty-cta:hover{background:rgba(0,255,153,.18);}

        /* Loading */
        .loading-state{display:flex;flex-direction:column;gap:8px;padding:16px;}
        .skeleton-row{height:52px;background:rgba(255,255,255,.04);border-radius:8px;animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}

        /* Pagination */
        .pagination{display:flex;justify-content:center;align-items:center;gap:6px;padding:18px;flex-wrap:wrap;}
        .pagination button{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:7px 13px;border-radius:8px;cursor:pointer;font-size:13px;transition:.2s;}
        .pagination button:hover:not(:disabled){background:rgba(0,255,153,.1);color:#00ff99;border-color:rgba(0,255,153,.3);}
        .pagination button.active{background:rgba(0,255,153,.15);color:#00ff99;border-color:rgba(0,255,153,.4);}
        .pagination button:disabled{opacity:.4;cursor:not-allowed;}

        /* Export note */
        .export-note{display:flex;align-items:center;gap:8px;background:rgba(136,153,187,.05);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#8899bb;}
        .export-note strong{color:#ccc;}
        .export-note a{color:#00ff99;margin-left:6px;}

        /* Tabs */
        .tabs-bar{display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,.07);padding-bottom:0;}
        .tab-btn{display:flex;align-items:center;gap:7px;background:none;border:none;color:#8899bb;padding:10px 18px;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:.2s;font-family:'Inter',sans-serif;}
        .tab-btn:hover{color:white;}
        .tab-active{color:white!important;border-bottom-color:#00ff99!important;}
        .tab-count{background:rgba(255,255,255,.08);color:#8899bb;padding:2px 7px;border-radius:10px;font-size:11px;}
        .tab-active .tab-count{background:rgba(0,255,153,.12);color:#00ff99;}

        /* Responsive */
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}
          .page-header{flex-direction:column;}
          .filter-bar{flex-direction:column;}
        }
      `}</style>
    </>
  );
}
