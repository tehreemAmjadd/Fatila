"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, Bot, Search, Bookmark, BarChart2,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Menu, X, Download, FileText, FileSpreadsheet, Printer,
  Code2, Lock, Filter, Globe, Star, Check, ArrowRight,
  AlertTriangle, RefreshCw, Bot as BotIcon,
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
// Export is for Pro and Business only
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", canExport:false },
  trial:    { label:"Trial",        color:"#ffd700", canExport:false },
  starter:  { label:"Starter",      color:"#00ff99", canExport:false },
  pro:      { label:"Professional", color:"#3b9eff", canExport:true  },
  business: { label:"Business",     color:"#a78bfa", canExport:true  },
  expired:  { label:"Expired",      color:"#ff6b6b", canExport:false },
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

const FORMAT_INFO = [
  {
    id:"csv",
    Icon:FileText,
    label:"CSV",
    desc:"Works with Excel, Google Sheets, HubSpot, any CRM",
    color:"#00ff99",
  },
  {
    id:"excel",
    Icon:FileSpreadsheet,
    label:"Excel",
    desc:"Opens directly in Microsoft Excel (.xls format)",
    color:"#3b9eff",
  },
  {
    id:"pdf",
    Icon:Printer,
    label:"PDF",
    desc:"Print-ready report, opens in browser for printing",
    color:"#ff6b6b",
    proOnly:false,
  },
  {
    id:"json",
    Icon:Code2,
    label:"JSON",
    desc:"Raw data for developers or API integrations",
    color:"#a78bfa",
    businessOnly:true,
  },
] as const;

const PRIORITY_COLOR: Record<string,string> = { High:"#ff4d4d", Medium:"#ffd700", Low:"#00ff99" };

const EXPORTED_FIELDS = [
  "Company Name","Industry","Phone Number",
  "Email Address","Website","Address",
  "Lead Score","Priority","Status","AI Insights","LinkedIn URL",
];

export default function ExportPage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive,   setSidebarActive]   = useState(false);
  const [format,          setFormat]          = useState<"csv"|"excel"|"pdf"|"json">("csv");
  const [filterPriority,  setFilterPriority]  = useState("");
  const [filterStatus,    setFilterStatus]    = useState("");
  const [exporting,       setExporting]       = useState(false);
  const [lastExport,      setLastExport]      = useState<string|null>(null);
  const [savedCount,      setSavedCount]      = useState<number|null>(null);
  const [previewLeads,    setPreviewLeads]    = useState<any[]>([]);
  const [loadingPreview,  setLoadingPreview]  = useState(false);
  const [dbUser,          setDbUser]          = useState<any>(null);

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r=>r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  // ── Canvas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const nodes: any[] = Array.from({length:60},()=>({
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
    return()=>window.removeEventListener("resize",resize);
  },[]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{const s=document.getElementById("sidebar");if(sidebarActive&&s&&!s.contains(e.target as Node))setSidebarActive(false);};
    document.addEventListener("click",h);return()=>document.removeEventListener("click",h);
  },[sidebarActive]);

  // ── Load preview ──────────────────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!email) return;
    setLoadingPreview(true);
    try {
      const res  = await fetch("/api/leads/saved", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email, page:1, limit:5, search:"", priority:filterPriority }),
      });
      const data = await res.json();
      setSavedCount(data.total || 0);
      setPreviewLeads(data.leads || []);
    } catch(err){console.error(err);}
    finally{setLoadingPreview(false);}
  },[email, filterPriority]);

  useEffect(()=>{loadPreview();},[loadPreview]);

  // ── Export handler ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!email) return;
    if (savedCount === 0) { alert("No saved leads to export. Save some leads first from Lead Search."); return; }
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email, format,
          filters:{
            ...(filterPriority && { priority:filterPriority }),
            ...(filterStatus   && { status:filterStatus     }),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        alert("Export failed: "+(err.error||res.statusText)); return;
      }
      if (format==="pdf") {
        const html = await res.text();
        const w = window.open("","_blank");
        w?.document.write(html); w?.document.close();
      } else {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = `saved-leads-${new Date().toISOString().split("T")[0]}.${format==="excel"?"xls":format}`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
      setLastExport(new Date().toLocaleString());
    } catch(err:any){
      console.error(err); alert("Export error: "+err.message);
    } finally { setExporting(false); }
  };

  const get = (lead:any,...keys:string[]) => {
    for (const k of keys) { if(lead[k]!==null&&lead[k]!==undefined&&String(lead[k]).trim()) return String(lead[k]).trim(); }
    return null;
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey)||"free");
  const planCfg       = PLAN_CONFIG[effectivePlan]||PLAN_CONFIG.free;
  const canExport     = planCfg.canExport;

  // JSON only for Business
  const canUseJson = effectivePlan === "business";

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:-10,pointerEvents:"none"}} />

      {/* ── Sidebar ── */}
      <div id="sidebar" className={`sidebar ${sidebarActive?"active":""}`}>
        <div className="sb-logo"><div className="logo-dot"/><span>Fatila</span></div>
        <nav>
          {NAV.map(({href,label,Icon})=>(
            <a key={href} href={href} className={href==="/export"?"active":""}>
              <Icon size={15} strokeWidth={1.8}/>{label}
            </a>
          ))}
        </nav>
        <div className="sb-footer">
          <span style={{color:planCfg.color,fontSize:11,fontWeight:700}}>{planCfg.label} Plan</span>
          {!canExport&&<a href="/billing" className="sb-upgrade">Upgrade</a>}
        </div>
      </div>
      <button className="menu-btn" onClick={(e)=>{e.stopPropagation();setSidebarActive(p=>!p);}}>
        {sidebarActive?<X size={20}/>:<Menu size={20}/>}
      </button>

      <div className="main">

        {/* ── GATE: Free / Trial / Starter / Expired ── */}
        {!canExport && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>
              {effectivePlan==="expired"   ? "Your trial has expired"
               :effectivePlan==="starter"  ? "Export requires Professional plan"
               :                             "Export is a Pro Feature"}
            </h3>
            <p>
              {effectivePlan==="starter"
               ?"You're on Starter. Upgrade to Professional ($29/mo) to export leads as CSV, Excel, or PDF."
               :effectivePlan==="expired"
               ?"Upgrade to continue exporting your saved leads."
               :"Upgrade to Professional or Business to export your leads in CSV, Excel, PDF, or JSON format."}
            </p>
            <a href="/billing" className="gate-cta">
              {effectivePlan==="starter"?"Upgrade to Professional — $29/mo":"View Plans"}
            </a>
            <div className="gate-perks">
              {["Export CSV","Export Excel","Export PDF","Export JSON (Business)"].map(f=>(
                <span key={f} className="perk"><Download size={11} color="#00ff99"/>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {canExport && (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Export Leads</h1>
                <p>
                  {savedCount===null ? "Loading..." : savedCount===0
                    ? "No saved leads yet"
                    : <><strong>{savedCount}</strong> saved leads ready to export</>}
                </p>
              </div>
              <div className="header-right">
                {lastExport && (
                  <span className="last-export">
                    <Check size={12} color="#00ff99"/>Last export: {lastExport}
                  </span>
                )}
                <a href="/saved-leads" className="view-saved-link">
                  <Bookmark size={13}/>View Saved Leads
                </a>
              </div>
            </div>

            {/* Count banner */}
            {savedCount !== null && (
              <div className={`count-banner ${savedCount===0?"empty":""}`}>
                {savedCount===0
                  ? <><AlertTriangle size={15} color="#ffd700"/><span>No saved leads found. <a href="/lead-search" className="search-link">Search and save leads first</a></span></>
                  : <>
                      <Download size={15} color="#00ff99"/>
                      <span><strong>{savedCount}</strong> lead{savedCount!==1?"s":""} will be exported
                        {filterPriority&&<span className="filter-active"> · Filtered: {filterPriority} priority</span>}
                        {filterStatus&&<span className="filter-active"> · Status: {filterStatus}</span>}
                      </span>
                    </>}
              </div>
            )}

            <div className="export-layout">
              {/* ── Left col: config ── */}
              <div className="config-col">

                {/* Format selector */}
                <div className="panel">
                  <h3><FileText size={13}/>Format</h3>
                  <div className="format-grid">
                    {FORMAT_INFO.map(({id,Icon,label,desc,color,...rest})=>{
                      const isJsonLocked = id==="json" && !canUseJson;
                      const isSelected   = format===id && !isJsonLocked;
                      return (
                        <div
                          key={id}
                          className={`format-card ${isSelected?"selected":""} ${isJsonLocked?"locked":""}`}
                          onClick={()=>{ if(!isJsonLocked) setFormat(id as any); }}
                        >
                          <div className="fmt-icon-wrap" style={{background:`${color}14`,border:`1px solid ${color}28`}}>
                            <Icon size={18} color={isJsonLocked?"#4a5568":color} strokeWidth={1.8}/>
                          </div>
                          <div className="fmt-info">
                            <span className="fmt-label" style={{color:isJsonLocked?"#4a5568":"white"}}>
                              {label}
                              {isJsonLocked&&<span className="fmt-lock-tag"><Lock size={10}/>Business</span>}
                            </span>
                            <span className="fmt-desc">{desc}</span>
                          </div>
                          {isSelected && <Check size={16} color="#00ff99" strokeWidth={2.5}/>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filters */}
                <div className="panel">
                  <h3><Filter size={13}/>Filters</h3>
                  <div className="filter-row">
                    <div className="filter-group">
                      <label>Priority</label>
                      <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
                        <option value="">All Priorities</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Status</label>
                      <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Export button */}
                <button className="export-btn" onClick={handleExport}
                  disabled={exporting||savedCount===0||savedCount===null}>
                  {exporting
                    ?<><span className="spinner"/>Exporting...</>
                    :<><Download size={18} strokeWidth={2.5}/>Export {savedCount||0} Lead{savedCount!==1?"s":""} as {format.toUpperCase()}</>}
                </button>

              </div>

              {/* ── Right col: info + preview ── */}
              <div className="info-col">

                {/* Fields panel */}
                <div className="panel">
                  <h3><Check size={13}/>Exported Fields</h3>
                  <div className="fields-grid">
                    {EXPORTED_FIELDS.map(f=>(
                      <div key={f} className="field-item">
                        <Check size={12} color="#00ff99" strokeWidth={2.5}/>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview panel */}
                <div className="panel">
                  <div className="preview-hdr">
                    <h3><Search size={13}/>Preview</h3>
                    <button className="refresh-btn" onClick={loadPreview} disabled={loadingPreview}>
                      <RefreshCw size={13} className={loadingPreview?"spin":""}/>Refresh
                    </button>
                  </div>

                  {loadingPreview ? (
                    <div className="preview-loading">
                      {[...Array(3)].map((_,i)=><div key={i} className="preview-skeleton"/>)}
                    </div>
                  ) : previewLeads.length===0 ? (
                    <div className="preview-empty">
                      <Search size={28} color="#8899bb" strokeWidth={1.4}/>
                      <p>No saved leads yet.</p>
                      <a href="/lead-search" className="preview-link">
                        <ArrowRight size={13}/>Go to Lead Search
                      </a>
                    </div>
                  ) : (
                    <div className="preview-list">
                      {previewLeads.map((lead,i)=>{
                        const pColor = PRIORITY_COLOR[lead.priority]||"#8899bb";
                        return (
                          <div key={i} className="preview-row">
                            <div className="preview-avatar">
                              {(get(lead,"company")||"?").charAt(0).toUpperCase()}
                            </div>
                            <div className="preview-info">
                              <span className="preview-company">{get(lead,"company")||"—"}</span>
                              <span className="preview-meta">
                                {get(lead,"industry","tags")||"—"}
                                {get(lead,"phone")?` · ${get(lead,"phone")}` : ""}
                              </span>
                              {get(lead,"website")&&(
                                <span className="preview-website">
                                  <Globe size={10}/>{get(lead,"website")!.replace(/https?:\/\//,"").split("/")[0]}
                                </span>
                              )}
                              {get(lead,"aiInsights","summary")&&(
                                <span className="preview-ai">
                                  <BotIcon size={10}/>{get(lead,"aiInsights","summary")!.slice(0,80)}...
                                </span>
                              )}
                            </div>
                            <div className="preview-score">
                              <span className="score-val" style={{color:pColor}}>
                                <Star size={11} color={pColor}/>{lead.score}
                              </span>
                              <span className="preview-priority" style={{color:pColor}}>{lead.priority}</span>
                            </div>
                          </div>
                        );
                      })}
                      {(savedCount||0)>5&&(
                        <p className="preview-more">
                          <Download size={12} color="#8899bb"/>
                          +{(savedCount||0)-5} more leads will be exported
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
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
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap;gap:12px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .page-header strong{color:#00ff99;}
        .header-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
        .last-export{display:flex;align-items:center;gap:5px;font-size:12px;color:#8899bb;}
        .view-saved-link{display:flex;align-items:center;gap:6px;color:#00ff99;font-size:13px;text-decoration:none;padding:7px 14px;border:1px solid rgba(0,255,153,.25);border-radius:8px;transition:.2s;}
        .view-saved-link:hover{background:rgba(0,255,153,.08);}

        /* Count banner */
        .count-banner{display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:12px;margin-bottom:22px;font-size:14px;flex-wrap:wrap;background:rgba(0,255,153,.07);border:1px solid rgba(0,255,153,.2);}
        .count-banner.empty{background:rgba(255,200,0,.07);border-color:rgba(255,200,0,.25);color:#ffd700;}
        .count-banner strong{color:#00ff99;}
        .filter-active{color:#8899bb;font-size:13px;}
        .search-link{color:#00ff99;text-decoration:none;font-weight:600;}

        /* Layout */
        .export-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:22px;}
        .config-col,.info-col{display:flex;flex-direction:column;gap:16px;}

        /* Panel */
        .panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;}
        .panel h3{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#00ff99;margin-bottom:14px;text-transform:uppercase;letter-spacing:.5px;}

        /* Format cards */
        .format-grid{display:flex;flex-direction:column;gap:9px;}
        .format-card{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;cursor:pointer;transition:.2s;}
        .format-card:hover:not(.locked){background:rgba(0,255,153,.05);border-color:rgba(0,255,153,.2);}
        .format-card.selected{background:rgba(0,255,153,.08);border-color:rgba(0,255,153,.4);}
        .format-card.locked{opacity:.45;cursor:not-allowed;}
        .fmt-icon-wrap{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .fmt-info{display:flex;flex-direction:column;gap:2px;flex:1;}
        .fmt-label{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;}
        .fmt-lock-tag{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:#4a5568;background:rgba(255,255,255,.06);padding:2px 7px;border-radius:10px;}
        .fmt-desc{font-size:11px;color:#8899bb;line-height:1.4;}

        /* Filters */
        .filter-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .filter-group label{display:block;font-size:11px;color:#8899bb;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;}
        .filter-group select{width:100%;background:#081633;border:1px solid rgba(255,255,255,.1);color:white;padding:9px 12px;border-radius:9px;font-size:13px;font-family:'Inter',sans-serif;}
        .filter-group select option{background:#081633;}
        .filter-group select:focus{outline:none;border-color:rgba(0,255,153,.4);}

        /* Export button */
        .export-btn{display:flex;align-items:center;justify-content:center;gap:9px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;width:100%;transition:.2s;}
        .export-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,255,153,.4);}
        .export-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none;}
        .spinner{width:16px;height:16px;border:2px solid rgba(2,8,23,.3);border-top-color:#020817;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .7s linear infinite;}

        /* Fields */
        .fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
        .field-item{display:flex;align-items:center;gap:7px;font-size:13px;color:#ccc;padding:3px 0;}

        /* Preview */
        .preview-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .preview-hdr h3{margin-bottom:0;}
        .refresh-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#8899bb;padding:5px 11px;border-radius:8px;cursor:pointer;font-size:12px;transition:.2s;}
        .refresh-btn:hover{color:white;}
        .refresh-btn:disabled{opacity:.5;cursor:not-allowed;}

        .preview-loading{display:flex;flex-direction:column;gap:8px;}
        .preview-skeleton{height:54px;background:rgba(255,255,255,.04);border-radius:8px;animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}

        .preview-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px;color:#8899bb;text-align:center;}
        .preview-empty p{font-size:13px;}
        .preview-link{display:flex;align-items:center;gap:5px;color:#00ff99;text-decoration:none;font-size:13px;}

        .preview-list{display:flex;flex-direction:column;gap:8px;}
        .preview-row{display:flex;align-items:flex-start;gap:10px;padding:10px 11px;background:rgba(255,255,255,.03);border-radius:9px;border:1px solid rgba(255,255,255,.06);}
        .preview-avatar{width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
        .preview-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
        .preview-company{font-size:13px;font-weight:600;}
        .preview-meta{font-size:11px;color:#8899bb;}
        .preview-website{display:flex;align-items:center;gap:4px;font-size:11px;color:#00ff99;}
        .preview-ai{display:flex;align-items:flex-start;gap:4px;font-size:11px;color:#8899bb;font-style:italic;line-height:1.4;}
        .preview-score{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;}
        .score-val{display:flex;align-items:center;gap:3px;font-weight:700;font-size:13px;}
        .preview-priority{font-size:10px;font-weight:700;text-transform:uppercase;}
        .preview-more{display:flex;align-items:center;gap:5px;justify-content:center;font-size:12px;color:#8899bb;margin-top:4px;padding:8px;background:rgba(0,255,153,.04);border-radius:7px;}

        @media(max-width:1000px){.export-layout{grid-template-columns:1fr;}}
        @media(max-width:900px){
          .menu-btn{display:flex;}.sidebar{left:-240px;}.sidebar.active{left:0;}
          .main{margin-left:0;padding:16px;}
          .filter-row{grid-template-columns:1fr;}
          .page-header{flex-direction:column;}
        }
      `}</style>
    </>
  );
}
