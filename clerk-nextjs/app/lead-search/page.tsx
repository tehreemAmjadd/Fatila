"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, Bot, Search, Bookmark, BarChart2,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Menu, X, MapPin, Building2, Globe, Star, Lock,
  ChevronRight,ExternalLink, Save, AlertTriangle, Zap,
  RefreshCw, Filter,
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", leadsMax:0    },
  trial:    { label:"Trial",        color:"#ffd700", leadsMax:50   },
  starter:  { label:"Starter",      color:"#00ff99", leadsMax:100  },
  pro:      { label:"Professional", color:"#3b9eff", leadsMax:1000 },
  business: { label:"Business",     color:"#a78bfa", leadsMax:Infinity },
  expired:  { label:"Expired",      color:"#ff6b6b", leadsMax:0    },
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

const INDUSTRIES = [
  "Technology","Healthcare","Finance","Retail","Education",
  "Real Estate","Food & Beverage","Automotive","Hospitality",
  "Legal","Fitness","Beauty","Manufacturing",
];

const PRIORITY_COLOR: Record<string,string> = { High:"#ff4d4d", Medium:"#ffd700", Low:"#00ff99" };

interface LeadResult {
  placeId: string;
  company: string;
  address: string;
  phone: string;
  email: string | null;
  website: string;
  industry: string;
  rating: number | null;
  reviewCount: number;
  score: number;
  priority: string;
  aiInsight: string;
  linkedinUrl: string;
  fromCache?: boolean;
}

export default function LeadSearchPage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);

  // Filters
  const [industry,    setIndustry]    = useState("");
  const [location,    setLocation]    = useState("");
  const [keyword,     setKeyword]     = useState("");
  const [companySize, setCompanySize] = useState("");

  // Results
  const [results,   setResults]   = useState<LeadResult[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);
  const [savedIds,  setSavedIds]  = useState<Set<string>>(new Set());
  const [savingId,  setSavingId]  = useState<string|null>(null);
  const [saveError, setSaveError] = useState("");

  // Plan
  const [dbUser, setDbUser] = useState<any>(null);
  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r => r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  // ── Canvas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const nodes: any[] = Array.from({length:60}, () => ({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.6, vy:(Math.random()-.5)*.6,
    }));
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>canvas.width)n.vx*=-1;if(n.y<0||n.y>canvas.height)n.vy*=-1;ctx.beginPath();ctx.arc(n.x,n.y,1.5,0,Math.PI*2);ctx.fillStyle="#00ff99";ctx.fill();});
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<120){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle=`rgba(0,255,153,${.1*(1-d/120)})`;ctx.stroke();}}
      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const h=(e:MouseEvent)=>{const s=document.getElementById("sidebar");if(sidebarActive&&s&&!s.contains(e.target as Node))setSidebarActive(false);};
    document.addEventListener("click",h); return()=>document.removeEventListener("click",h);
  }, [sidebarActive]);

  // ── Derived plan info ─────────────────────────────────────────────────────
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey) || "free");
  const planCfg       = PLAN_CONFIG[effectivePlan] || PLAN_CONFIG.free;
  const canSearch     = effectivePlan !== "free" && effectivePlan !== "expired";
  const leadsUsed     = dbUser?.totalLeads ?? 0;
  const leadsMax      = planCfg.leadsMax;
  const atLimit       = leadsMax !== Infinity && leadsUsed >= leadsMax;

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!canSearch || atLimit) return;
    if (!location && !keyword && !industry) {
      alert("Please enter at least a location or keyword.");
      return;
    }
    setLoading(true);
    setSearched(true);
    setSaveError("");
    try {
      const res = await fetch("/api/leads/search", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ industry, location, keyword, email }),
      });
      const data = await res.json();
      setResults(data.leads || []);
    } catch(err) { console.error(err); setResults([]); }
    finally { setLoading(false); }
  };

  // ── Save lead ─────────────────────────────────────────────────────────────
  const handleSave = async (lead: LeadResult) => {
    if (!email) return;
    setSavingId(lead.placeId);
    setSaveError("");
    try {
      const res = await fetch("/api/leads/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ ...lead, email }),
      });
      const data = await res.json();
      if (data.error) { setSaveError(data.error); }
      else { setSavedIds(prev => new Set([...prev, lead.placeId])); }
    } catch { setSaveError("Save failed. Try again."); }
    finally { setSavingId(null); }
  };

  const priorityBg = (p:string) => p==="High"?"rgba(255,77,77,.12)":p==="Medium"?"rgba(255,215,0,.12)":"rgba(0,255,153,.12)";

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:-10,pointerEvents:"none"}} />

      {/* ── Sidebar ── */}
      <div id="sidebar" className={`sidebar ${sidebarActive?"active":""}`}>
        <div className="sb-logo"><div className="logo-dot"/><span>Fatila</span></div>
        <nav>
          {NAV.map(({href,label,Icon})=>(
            <a key={href} href={href} className={href==="/lead-search"?"active":""}>
              <Icon size={15} strokeWidth={1.8}/>{label}
            </a>
          ))}
        </nav>
        <div className="sb-footer">
          <span style={{color:planCfg.color,fontSize:11,fontWeight:700}}>{planCfg.label} Plan</span>
          <a href="/billing" className="sb-upgrade">Upgrade</a>
        </div>
      </div>
      <button className="menu-btn" onClick={(e)=>{e.stopPropagation();setSidebarActive(p=>!p);}}>
        {sidebarActive?<X size={20}/>:<Menu size={20}/>}
      </button>

      <div className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Lead Search</h1>
            <p>Find businesses using Google Places + AI scoring</p>
          </div>
          <div className="header-right">
            {searched && results.length > 0 && (
              <span className="result-badge">
                <Search size={13}/>{results.length} results
              </span>
            )}
            <span className="plan-chip" style={{color:planCfg.color,borderColor:`${planCfg.color}44`,background:`${planCfg.color}11`}}>
              {planCfg.label}
            </span>
          </div>
        </div>

        {/* ── FREE / EXPIRED GATE ── */}
        {!canSearch && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>{effectivePlan === "expired" ? "Your trial has expired" : "Lead Search is a Paid Feature"}</h3>
            <p>
              {effectivePlan === "expired"
                ? "Your 7-day trial has ended. Upgrade to keep searching for leads."
                : "Upgrade to start finding and saving high-quality business leads powered by Google Places + AI."}
            </p>
            <a href="/billing" className="gate-cta">
              {effectivePlan === "expired" ? "Choose a Plan" : "Start Free Trial or Upgrade"}
            </a>
          </div>
        )}

        {/* ── LIMIT WARNING ── */}
        {canSearch && atLimit && (
          <div className="limit-banner">
            <AlertTriangle size={15} color="#ff6b6b"/>
            <span>You've reached your <strong>{leadsMax} lead limit</strong> for this plan.</span>
            <a href="/billing">Upgrade now</a>
          </div>
        )}

        {/* ── SEARCH FILTERS ── */}
        {canSearch && (
          <div className="filters-panel">
            <div className="filters-title">
              <Filter size={15} color="#00ff99"/>
              <h3>Search Filters</h3>
            </div>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Industry</label>
                <select value={industry} onChange={e=>setIndustry(e.target.value)}>
                  <option value="">All Industries</option>
                  {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Location <span className="req">*</span></label>
                <input value={location} onChange={e=>setLocation(e.target.value)}
                  placeholder="e.g. Dubai, London, Lahore"
                  onKeyDown={e=>e.key==="Enter"&&handleSearch()} />
              </div>
              <div className="filter-group">
                <label>Keyword</label>
                <input value={keyword} onChange={e=>setKeyword(e.target.value)}
                  placeholder="e.g. dental clinic, software house"
                  onKeyDown={e=>e.key==="Enter"&&handleSearch()} />
              </div>
              <div className="filter-group">
                <label>Company Size</label>
                <select value={companySize} onChange={e=>setCompanySize(e.target.value)}>
                  <option value="">Any Size</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="10-50">10–50 employees</option>
                  <option value="50-200">50–200 employees</option>
                  <option value="200+">200+ employees</option>
                </select>
              </div>
            </div>

            {/* Lead usage bar */}
            {leadsMax !== Infinity && (
              <div className="usage-row">
                <span className="usage-lbl">
                  Lead usage: <strong style={{color:atLimit?"#ff6b6b":planCfg.color}}>{leadsUsed} / {leadsMax}</strong>
                </span>
                <div className="usage-track">
                  <div className="usage-fill" style={{
                    width:`${Math.min((leadsUsed/leadsMax)*100,100)}%`,
                    background:atLimit?"#ff6b6b":leadsUsed/leadsMax>=.7?"#ffd700":"#00ff99",
                  }}/>
                </div>
              </div>
            )}

            <button className="search-btn" onClick={handleSearch} disabled={loading||atLimit}>
              {loading
                ? <><RefreshCw size={15} className="spin"/>Searching...</>
                : <><Search size={15}/>Search Leads</>
              }
            </button>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="error-banner">
            <AlertTriangle size={14} color="#ff6b6b"/>{saveError}
            <a href="/saved-leads">Check Saved Leads</a>
          </div>
        )}

        {/* ── RESULTS ── */}
        {searched && canSearch && (
          <div className="results-section">
            <div className="results-hdr">
              <h2>
                {loading
                  ? "Searching..."
                  : `${results.length} result${results.length!==1?"s":""} found`}
              </h2>
              {savedIds.size > 0 && (
                <a href="/saved-leads" className="saved-pill">
                  <Bookmark size={13}/>{savedIds.size} saved — View all
                </a>
              )}
            </div>

            {loading ? (
              <div className="skeleton-grid">
                {[...Array(4)].map((_,i)=><div key={i} className="skeleton-card"/>)}
              </div>
            ) : results.length === 0 ? (
              <div className="no-results">
                <Search size={32} color="#8899bb" strokeWidth={1.4}/>
                <p>No results found. Try a different location or keyword.</p>
              </div>
            ) : (
              <div className="results-grid">
                {results.map(lead => {
                  const isSaved   = savedIds.has(lead.placeId);
                  const isSaving  = savingId === lead.placeId;
                  return (
                    <div key={lead.placeId} className={`lead-card ${isSaved?"saved":""}`}>

                      {/* Card header */}
                      <div className="card-top">
                        <div className="company-avatar">{lead.company.charAt(0).toUpperCase()}</div>
                        <div className="company-info">
                          <h3 className="company-name">{lead.company}</h3>
                          <span className="industry-tag">{lead.industry}</span>
                        </div>
                        <div className="score-wrap">
                          <div className="score-circle">{lead.score}</div>
                          <span className="score-lbl">score</span>
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="priority-row">
                        <span className="priority-badge"
                          style={{color:PRIORITY_COLOR[lead.priority],background:priorityBg(lead.priority),border:`1px solid ${PRIORITY_COLOR[lead.priority]}33`}}>
                          {lead.priority} Priority
                        </span>
                        {lead.rating && (
                          <span className="rating">
                            <Star size={12} color="#ffd700"/>{lead.rating}
                            <span className="review-count">({lead.reviewCount})</span>
                          </span>
                        )}
                        {lead.fromCache && (
                          <span className="cache-tag"><Zap size={10} color="#ffd700"/>Cached</span>
                        )}
                      </div>

                      {/* Contact details */}
                      <div className="contact-list">
                        {lead.address && (
                          <div className="contact-row">
                            <MapPin size={13} color="#8899bb" strokeWidth={1.8}/>
                            <span>{lead.address.split(",").slice(-2).join(",").trim()}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="contact-row">
                            <Phone size={13} color="#8899bb" strokeWidth={1.8}/>
                            <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                          </div>
                        )}
                        {lead.email && (
                          <div className="contact-row">
                            <Mail size={13} color="#8899bb" strokeWidth={1.8}/>
                            <a href={`mailto:${lead.email}`}>{lead.email}</a>
                          </div>
                        )}
                        {lead.website && (
                          <div className="contact-row">
                            <Globe size={13} color="#8899bb" strokeWidth={1.8}/>
                            <a href={lead.website.startsWith("http")?lead.website:"https://"+lead.website} target="_blank" rel="noreferrer">
                              {lead.website.replace(/https?:\/\//,"").split("/")[0]}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* AI Insight */}
                      {lead.aiInsight && (
                        <div className="ai-insight">
                          <div className="insight-label"><Bot size={12} color="#00ff99"/>AI Insight</div>
                          <p>{lead.aiInsight.split("\n")[0]}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="card-actions">
                        <button
                          className={`save-btn ${isSaved?"saved":""}`}
                          onClick={()=>!isSaved&&handleSave(lead)}
                          disabled={isSaved||isSaving}
                        >
                          <Bookmark size={14} strokeWidth={1.8}/>
                          {isSaving?"Saving...":isSaved?"Saved":"Save Lead"}
                        </button>
                        {lead.linkedinUrl && (
                          <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="li-btn">
                            <ExternalLink size={13}/>LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        /* Sidebar */
        .sidebar{position:fixed;left:0;top:0;width:240px;height:100%;background:#06102a;padding:22px 14px;transition:.3s;z-index:1000;border-right:1px solid rgba(0,255,153,.07);display:flex;flex-direction:column;}
        .sb-logo{display:flex;align-items:center;gap:9px;margin-bottom:24px;padding:0 4px;color:#00ff99;font-size:17px;font-weight:700;}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#00ff99;box-shadow:0 0 8px #00ff99;}
        nav{display:flex;flex-direction:column;gap:2px;flex:1;}
        nav a{display:flex;align-items:center;gap:9px;color:#8899bb;text-decoration:none;font-size:13px;padding:9px 10px;border-radius:8px;transition:.2s;}
        nav a:hover,nav a.active{color:#00ff99;background:rgba(0,255,153,.08);}
        .sb-footer{border-top:1px solid rgba(255,255,255,.06);padding-top:12px;display:flex;align-items:center;justify-content:space-between;}
        .sb-upgrade{font-size:11px;background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.25);padding:3px 10px;border-radius:20px;text-decoration:none;}
        .menu-btn{display:none;position:fixed;top:15px;left:15px;z-index:1100;background:#06102a;border:1px solid rgba(0,255,153,.15);color:white;padding:8px 10px;border-radius:8px;cursor:pointer;}

        /* Main */
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .header-right{display:flex;align-items:center;gap:10px;}
        .result-badge{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;}
        .plan-chip{font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;border:1px solid;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}

        /* Limit banner */
        .limit-banner{display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#ff6b6b;}
        .limit-banner a{margin-left:6px;color:#ff6b6b;font-weight:600;}
        .limit-banner strong{color:#fff;}

        /* Filters */
        .filters-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:22px 24px;margin-bottom:24px;}
        .filters-title{display:flex;align-items:center;gap:8px;margin-bottom:18px;}
        .filters-title h3{font-size:14px;font-weight:600;}
        .filters-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;}
        .filter-group{display:flex;flex-direction:column;gap:6px;}
        .filter-group label{font-size:12px;color:#8899bb;font-weight:500;}
        .req{color:#ff6b6b;}
        .filter-group input,.filter-group select{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:9px 12px;border-radius:9px;font-size:13px;font-family:'Inter',sans-serif;transition:.2s;}
        .filter-group input:focus,.filter-group select:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .filter-group select option{background:#081633;}

        .usage-row{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
        .usage-lbl{font-size:12px;color:#8899bb;white-space:nowrap;}
        .usage-track{flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden;}
        .usage-fill{height:100%;border-radius:5px;transition:width .4s ease;}

        .search-btn{display:flex;align-items:center;gap:8px;background:#00ff99;color:#020817;border:none;padding:11px 24px;border-radius:30px;font-size:14px;font-weight:700;cursor:pointer;transition:.2s;}
        .search-btn:hover:not(:disabled){background:#00cc66;}
        .search-btn:disabled{opacity:.6;cursor:not-allowed;}
        .spin{animation:spin .7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Error */
        .error-banner{display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:10px;padding:11px 15px;margin-bottom:16px;font-size:13px;color:#ff6b6b;}
        .error-banner a{margin-left:6px;color:#ff6b6b;font-weight:600;}

        /* Results */
        .results-section{margin-top:8px;}
        .results-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}
        .results-hdr h2{font-size:16px;font-weight:600;}
        .saved-pill{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;font-size:12px;padding:5px 12px;border-radius:20px;text-decoration:none;}

        .skeleton-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
        .skeleton-card{height:280px;border-radius:14px;background:rgba(255,255,255,.04);animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}

        .no-results{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#8899bb;font-size:14px;}

        .results-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
        @media(min-width:1200px){.results-grid{grid-template-columns:repeat(3,1fr);}}

        /* Lead Card */
        .lead-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:14px;transition:.2s;}
        .lead-card:hover{border-color:rgba(0,255,153,.2);background:rgba(0,255,153,.03);}
        .lead-card.saved{border-color:rgba(0,255,153,.3);background:rgba(0,255,153,.04);}

        .card-top{display:flex;align-items:flex-start;gap:12px;}
        .company-avatar{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
        .company-info{flex:1;min-width:0;}
        .company-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .industry-tag{font-size:11px;background:rgba(255,255,255,.07);color:#8899bb;padding:2px 8px;border-radius:8px;display:inline-block;margin-top:3px;}
        .score-wrap{text-align:center;flex-shrink:0;}
        .score-circle{width:38px;height:38px;border-radius:50%;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.25);color:#00ff99;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .score-lbl{font-size:10px;color:#8899bb;margin-top:2px;display:block;}

        .priority-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .priority-badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;}
        .rating{display:flex;align-items:center;gap:4px;font-size:12px;color:#ffd700;}
        .review-count{color:#8899bb;font-size:11px;}
        .cache-tag{display:flex;align-items:center;gap:3px;font-size:10px;color:#ffd700;background:rgba(255,215,0,.1);padding:2px 7px;border-radius:10px;}

        .contact-list{display:flex;flex-direction:column;gap:6px;}
        .contact-row{display:flex;align-items:center;gap:7px;font-size:12px;color:#8899bb;}
        .contact-row a{color:#3b9eff;text-decoration:none;}
        .contact-row a:hover{text-decoration:underline;}

        .ai-insight{background:rgba(0,255,153,.04);border:1px solid rgba(0,255,153,.1);border-radius:9px;padding:10px 12px;}
        .insight-label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#00ff99;margin-bottom:5px;}
        .ai-insight p{font-size:12px;color:#8899bb;line-height:1.5;}

        .card-actions{display:flex;gap:8px;margin-top:auto;}
        .save-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:9px;border:1px solid rgba(0,255,153,.25);background:rgba(0,255,153,.08);color:#00ff99;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;}
        .save-btn:hover:not(:disabled){background:rgba(0,255,153,.15);}
        .save-btn.saved{background:rgba(0,255,153,.15);color:#00ff99;cursor:default;}
        .save-btn:disabled{opacity:.7;}
        .li-btn{display:flex;align-items:center;gap:5px;padding:9px 14px;border-radius:9px;border:1px solid rgba(0,119,181,.3);background:rgba(0,119,181,.1);color:#0077b5;font-size:13px;font-weight:600;text-decoration:none;transition:.2s;}
        .li-btn:hover{background:rgba(0,119,181,.2);}

        /* Responsive */
        @media(max-width:1100px){.filters-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:900px){
          .menu-btn{display:flex;}.sidebar{left:-240px;}.sidebar.active{left:0;}
          .main{margin-left:0;padding:16px;}
          .results-grid{grid-template-columns:1fr;}
          .filters-grid{grid-template-columns:1fr;}
        }
      `}</style>
    </>
  );
}
