"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, Bot, Search, Bookmark, BarChart2,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Shield, Menu, Target, Flame, Star, TrendingUp,
  Lock, ChevronRight, AlertTriangle, X,
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", leadsMax:0,        aiMsgs:0 },
  starter:  { label:"Starter",      color:"#00ff99", leadsMax:100,      aiMsgs:50 },
  pro:      { label:"Professional", color:"#3b9eff", leadsMax:1000,     aiMsgs:500 },
  business: { label:"Business",     color:"#a78bfa", leadsMax:Infinity, aiMsgs:Infinity },
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

export default function DashboardPage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);
  const [stats,      setStats]      = useState<any>(null);
  const [dbUser,     setDbUser]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [showAdmin,  setShowAdmin]  = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          fetch("/api/get-user",        { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) }),
          fetch("/api/dashboard/stats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) }),
        ]);
        const uData = await uRes.json();
        const sData = await sRes.json();
        setDbUser(uData); setStats(sData);
        if (uData.role === "admin") {
          const aRes  = await fetch("/api/admin/users", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) });
          setAdminUsers((await aRes.json()).users || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [email]);

  // ── Canvas ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const nodes: any[] = Array.from({ length:70 }, () => ({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.7, vy:(Math.random()-.5)*.7,
    }));
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      nodes.forEach(n => {
        n.x+=n.vx; n.y+=n.vy;
        if(n.x<0||n.x>canvas.width)n.vx*=-1; if(n.y<0||n.y>canvas.height)n.vy*=-1;
        ctx.beginPath(); ctx.arc(n.x,n.y,1.8,0,Math.PI*2); ctx.fillStyle="#00ff99"; ctx.fill();
      });
      for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) {
        const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y, d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle=`rgba(0,255,153,${.12*(1-d/120)})`;ctx.stroke();}
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

  // ── Derived ──────────────────────────────────────────────────────────────
  const plan      = ((dbUser?.plan as PlanKey) || "free");
  const planCfg   = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const isAdmin   = dbUser?.role === "admin";
  const isPaid    = plan !== "free";
  const leadsUsed = stats?.totalLeads ?? 0;
  const leadsMax  = planCfg.leadsMax;
  const pct       = leadsMax === Infinity ? 100 : Math.min((leadsUsed / leadsMax)*100, 100);

  const fmtDate       = (d:string) => { try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}catch{return ""} };
  const priorityColor = (p:string) => p==="High"?"#ff6b6b":p==="Medium"?"#ffd700":"#00ff99";
  const statusColor   = (s:string) => s==="new"?"#00ff99":s==="contacted"?"#3b9eff":s==="qualified"?"#ffd700":s==="converted"?"#00e676":"#ff6b6b";

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:-10,pointerEvents:"none"}} />

      {/* ── Sidebar ── */}
      <div id="sidebar" className={`sidebar ${sidebarActive?"active":""}`}>
        <div className="sb-logo">
          <div className="logo-dot" />
          <span className="logo-text">Fatila</span>
        </div>
        <nav>
          {NAV.map(({ href, label, Icon }) => (
            <a key={href} href={href} className={href==="/dashboard"?"active":""}>
              <Icon size={15} strokeWidth={1.8} />{label}
            </a>
          ))}
          {isAdmin && (
            <button className="nav-btn" onClick={()=>setShowAdmin(p=>!p)}>
              <Shield size={15} strokeWidth={1.8} />Admin Panel
            </button>
          )}
        </nav>
        <div className="sb-footer">
          <span style={{color:planCfg.color,fontSize:11,fontWeight:700}}>{planCfg.label} Plan</span>
          {!isPaid && <a href="/billing" className="sb-upgrade">Upgrade</a>}
        </div>
      </div>

      {/* Mobile menu toggle */}
      <button className="menu-btn" onClick={(e)=>{e.stopPropagation();setSidebarActive(p=>!p);}}>
        {sidebarActive ? <X size={20}/> : <Menu size={20}/>}
      </button>

      {/* ── Main content ── */}
      <div className="main">

        {/* Header */}
        <div className="dash-header">
          <div>
            <h1>Welcome back, {user?.firstName || "User"}</h1>
            <p className="sub">Here's what's happening with your leads today</p>
          </div>
          <div className="header-right">
            <span className="plan-pill" style={{color:planCfg.color,borderColor:`${planCfg.color}44`,background:`${planCfg.color}12`}}>
              {planCfg.label}
            </span>
            {!isPaid && <a href="/billing" className="upgrade-btn">Upgrade</a>}
          </div>
        </div>

        {loading ? (
          <div className="skeleton-grid">{[...Array(4)].map((_,i)=><div key={i} className="skeleton"/>)}</div>
        ) : (
          <>
            {/* ── FREE GATE ── */}
            {!isPaid && (
              <div className="free-gate">
                <div className="gate-icon-wrap"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
                <h3>You're on the Free Plan</h3>
                <p>Upgrade to start generating leads, using the AI Assistant, and accessing all platform features.</p>
                <a href="/billing" className="gate-cta">View Plans — Starting $12/mo</a>
                <div className="gate-perks">
                  {["Lead Search","AI Insights","Meta Ads Generator","Export CSV / Excel / PDF"].map(f=>(
                    <span key={f} className="perk"><CheckSquare size={11} color="#00ff99"/>{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── PAID CONTENT ── */}
            {isPaid && (
              <>
                {/* Stat cards */}
                <div className="stats-grid">
                  {[
                    {Icon:Target,      label:"Total Leads",    value:stats?.totalLeads??0,        color:"#00ff99"},
                    {Icon:Bookmark,    label:"Saved Leads",    value:stats?.savedLeads??0,        color:"#3b9eff"},
                    {Icon:Flame,       label:"High Priority",  value:stats?.highPriorityLeads??0, color:"#ff6b6b"},
                    {Icon:CheckSquare, label:"Tasks Done",     value:stats?.completedTasks??0,    color:"#a78bfa"},
                  ].map(({Icon,label,value,color})=>(
                    <div className="stat-card" key={label}>
                      <div className="stat-icon" style={{background:`${color}14`,border:`1px solid ${color}28`}}>
                        <Icon size={18} color={color} strokeWidth={1.8}/>
                      </div>
                      <div><h3>{value}</h3><p>{label}</p></div>
                    </div>
                  ))}
                </div>

                {/* Usage bar */}
                <div className="usage-card">
                  <div className="usage-row">
                    <span className="usage-lbl">Lead usage this month</span>
                    <span className="usage-val" style={{color:pct>=90?"#ff6b6b":planCfg.color}}>
                      {leadsMax===Infinity ? `${leadsUsed} used  ·  Unlimited` : `${leadsUsed} / ${leadsMax}`}
                    </span>
                  </div>
                  <div className="usage-track">
                    <div className="usage-fill" style={{
                      width:`${pct}%`,
                      background: leadsMax===Infinity?"#a78bfa":pct>=90?"#ff6b6b":pct>=70?"#ffd700":"#00ff99"
                    }}/>
                  </div>
                  {pct>=90 && leadsMax!==Infinity && (
                    <p className="usage-warn">
                      <AlertTriangle size={12} color="#ff6b6b" style={{display:"inline",marginRight:4}}/>
                      Almost at limit — <a href="/billing">upgrade now</a>
                    </p>
                  )}
                </div>

                {/* Grid */}
                <div className="content-grid">

                  {/* Recent Leads */}
                  <div className="card">
                    <div className="card-hdr">
                      <h3>Recent Leads</h3>
                      <a href="/lead-search" className="card-link"><Search size={12}/>New Search</a>
                    </div>
                    {stats?.recentLeads?.length ? (
                      <div className="lead-list">
                        {stats.recentLeads.map((lead:any,i:number)=>(
                          <div key={i} className="lead-row">
                            <div className="lead-l">
                              <span className="lead-name">{lead.company}</span>
                              <span className="lead-ind">{lead.industry}</span>
                            </div>
                            <div className="lead-r">
                              <span className="badge" style={{color:priorityColor(lead.priority),background:`${priorityColor(lead.priority)}18`}}>{lead.priority}</span>
                              <span className="badge" style={{color:statusColor(lead.status)}}>{lead.status}</span>
                              <span className="lead-score"><Star size={10} color="#ffd700"/>{lead.score}</span>
                              <span className="lead-date">{fmtDate(lead.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty"><Search size={26} color="#8899bb" strokeWidth={1.4}/><p>No leads yet. <a href="/lead-search">Start searching</a></p></div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="card">
                    <div className="card-hdr"><h3>Quick Actions</h3></div>
                    <div className="actions">
                      {[
                        {href:"/lead-search", Icon:Search,     label:"Search Leads",       desc:"Find leads by location & industry",            show:true},
                        {href:"/ai-assistant",Icon:Bot,        label:"AI Assistant",        desc:plan==="starter"?"50 msgs/mo":plan==="pro"?"500 msgs/mo":"Unlimited", show:true},
                        {href:"/meta-ads",    Icon:Megaphone,  label:"Meta Ads Generator", desc:"AI-powered ad copy",                           show:true},
                        {href:"/export",      Icon:Upload,     label:"Export Leads",        desc:"CSV, Excel, PDF, JSON",                        show:plan==="pro"||plan==="business"},
                        {href:"/emails",      Icon:Mail,       label:"Email Center",        desc:"Send AI-written emails",                       show:plan==="pro"||plan==="business"},
                        {href:"/analytics",   Icon:TrendingUp, label:"Advanced Analytics", desc:"Full reports & insights",                      show:plan==="business"},
                      ].filter(a=>a.show).map(({href,Icon,label,desc})=>(
                        <a key={href} href={href} className="action-item">
                          <div className="action-icon"><Icon size={15} strokeWidth={1.8} color="#00ff99"/></div>
                          <div className="action-text">
                            <span className="action-label">{label}</span>
                            <span className="action-desc">{desc}</span>
                          </div>
                          <ChevronRight size={14} color="#8899bb"/>
                        </a>
                      ))}
                    </div>

                    {plan !== "business" && (
                      <div className="locked-row">
                        <Lock size={12} color="#8899bb" style={{flexShrink:0}}/>
                        <div>
                          <p className="locked-title">{plan==="starter"?"Unlock with Professional":"Unlock with Business"}</p>
                          <p className="locked-desc">{plan==="starter"?"Export · Email Center · 1,000 leads/mo":"Unlimited leads · Advanced Analytics · Priority Support"}</p>
                        </div>
                        <a href="/billing" className="locked-cta"
                          style={{color:plan==="starter"?"#00ff99":"#a78bfa",borderColor:plan==="starter"?"rgba(0,255,153,.3)":"rgba(167,139,250,.3)",background:plan==="starter"?"rgba(0,255,153,.08)":"rgba(167,139,250,.08)"}}>
                          Upgrade
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── ADMIN PANEL ── */}
            {isAdmin && showAdmin && (
              <div className="admin-panel">
                <div className="admin-hdr">
                  <Shield size={15} color="#ffd700"/><h3>Admin — All Users</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr>{["Email","Plan","Status","Role","Leads","Tasks","Joined"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {adminUsers.length===0
                        ?<tr><td colSpan={7} className="td-empty">No users found</td></tr>
                        :adminUsers.map((u:any)=>(
                          <tr key={u.id}>
                            <td className="td-email">{u.email}</td>
                            <td><span style={{color:u.plan==="business"?"#a78bfa":u.plan==="pro"?"#3b9eff":"#00ff99",fontSize:12,fontWeight:700}}>{u.plan||"free"}</span></td>
                            <td><span style={{color:u.subscriptionStatus==="active"?"#00ff99":"#8899bb",fontSize:12}}>{u.subscriptionStatus==="active"?"Active":u.subscriptionStatus}</span></td>
                            <td><span style={{color:u.role==="admin"?"#ffd700":"#8899bb",fontSize:12}}>{u.role==="admin"?"Admin":"User"}</span></td>
                            <td className="td-c">{u._count?.leads??"—"}</td>
                            <td className="td-c">{u._count?.tasks??"—"}</td>
                            <td className="td-c">{fmtDate(u.createdAt)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        /* Sidebar */
        .sidebar{position:fixed;left:0;top:0;width:240px;height:100%;background:#06102a;padding:22px 14px;transition:.3s;z-index:1000;border-right:1px solid rgba(0,255,153,.07);display:flex;flex-direction:column;}
        .sb-logo{display:flex;align-items:center;gap:9px;margin-bottom:26px;padding:0 4px;}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#00ff99;box-shadow:0 0 8px #00ff99;}
        .logo-text{color:#00ff99;font-size:17px;font-weight:700;}
        nav{display:flex;flex-direction:column;gap:2px;flex:1;}
        nav a,.nav-btn{display:flex;align-items:center;gap:9px;color:#8899bb;text-decoration:none;font-size:13px;padding:9px 10px;border-radius:8px;transition:.2s;background:none;border:none;cursor:pointer;width:100%;text-align:left;}
        nav a:hover,nav a.active,.nav-btn:hover{color:#00ff99;background:rgba(0,255,153,.08);}
        .sb-footer{border-top:1px solid rgba(255,255,255,.06);padding-top:12px;display:flex;align-items:center;justify-content:space-between;}
        .sb-upgrade{font-size:11px;background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.25);padding:3px 10px;border-radius:20px;text-decoration:none;}

        /* Menu btn */
        .menu-btn{display:none;position:fixed;top:15px;left:15px;z-index:1100;background:#06102a;border:1px solid rgba(0,255,153,.15);color:white;padding:8px 10px;border-radius:8px;cursor:pointer;}

        /* Main */
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}
        .dash-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px;}
        .dash-header h1{font-size:21px;font-weight:600;margin-bottom:4px;}
        .sub{color:#8899bb;font-size:13px;}
        .header-right{display:flex;align-items:center;gap:10px;}
        .plan-pill{font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;border:1px solid;}
        .upgrade-btn{background:rgba(0,255,153,.1);color:#00ff99;border:1px solid rgba(0,255,153,.3);font-size:12px;padding:5px 14px;border-radius:20px;text-decoration:none;transition:.2s;}
        .upgrade-btn:hover{background:rgba(0,255,153,.2);}

        /* Skeletons */
        .skeleton-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
        .skeleton{height:88px;border-radius:12px;background:rgba(255,255,255,.05);animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

        /* Free gate */
        .free-gate{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon-wrap{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .free-gate h3{font-size:20px;margin-bottom:10px;}
        .free-gate p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}
        .gate-perks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;}
        .perk{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.06);border:1px solid rgba(0,255,153,.14);color:#ccc;font-size:12px;padding:5px 12px;border-radius:20px;}

        /* Stats */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px;}
        .stat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;display:flex;align-items:center;gap:13px;}
        .stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .stat-card h3{font-size:22px;font-weight:700;}
        .stat-card p{font-size:12px;color:#8899bb;margin-top:2px;}

        /* Usage */
        .usage-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 20px;margin-bottom:18px;}
        .usage-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px;}
        .usage-lbl{color:#8899bb;}
        .usage-val{font-weight:600;}
        .usage-track{height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;}
        .usage-fill{height:100%;border-radius:6px;transition:width .6s ease;}
        .usage-warn{font-size:12px;color:#ff6b6b;margin-top:8px;display:flex;align-items:center;}
        .usage-warn a{color:#ff6b6b;margin-left:3px;}

        /* Content grid */
        .content-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
        .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;}
        .card-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .card-hdr h3{font-size:14px;font-weight:600;}
        .card-link{display:flex;align-items:center;gap:4px;color:#8899bb;font-size:12px;text-decoration:none;}
        .card-link:hover{color:#00ff99;}

        /* Lead list */
        .lead-list{display:flex;flex-direction:column;gap:8px;}
        .lead-row{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:rgba(255,255,255,.03);border-radius:8px;gap:8px;}
        .lead-l{display:flex;flex-direction:column;gap:2px;min-width:0;}
        .lead-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .lead-ind{font-size:11px;color:#8899bb;}
        .lead-r{display:flex;align-items:center;gap:5px;flex-shrink:0;}
        .badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;}
        .lead-score{display:flex;align-items:center;gap:3px;font-size:11px;color:#ffd700;}
        .lead-date{font-size:11px;color:#8899bb;}
        .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 0;color:#8899bb;font-size:13px;}
        .empty a{color:#00ff99;}

        /* Actions */
        .actions{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;}
        .action-item{display:flex;align-items:center;gap:11px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;text-decoration:none;color:white;transition:.2s;}
        .action-item:hover{background:rgba(0,255,153,.05);border-color:rgba(0,255,153,.15);}
        .action-icon{width:30px;height:30px;border-radius:7px;background:rgba(0,255,153,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .action-text{flex:1;display:flex;flex-direction:column;gap:1px;}
        .action-label{font-size:13px;font-weight:500;}
        .action-desc{font-size:11px;color:#8899bb;}

        /* Locked */
        .locked-row{display:flex;align-items:center;gap:10px;background:rgba(136,153,187,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:11px 13px;}
        .locked-title{font-size:12px;font-weight:600;color:#ccc;}
        .locked-desc{font-size:11px;color:#8899bb;margin-top:2px;}
        .locked-cta{font-size:11px;padding:4px 11px;border-radius:20px;border:1px solid;text-decoration:none;white-space:nowrap;flex-shrink:0;}

        /* Admin */
        .admin-panel{margin-top:22px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.12);border-radius:14px;padding:18px;}
        .admin-hdr{display:flex;align-items:center;gap:7px;margin-bottom:14px;}
        .admin-hdr h3{font-size:13px;font-weight:600;color:#ffd700;}
        .table-wrap{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        th{text-align:left;padding:7px 12px;color:#8899bb;font-size:11px;font-weight:600;border-bottom:1px solid rgba(255,255,255,.07);}
        td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04);}
        .td-email{color:#ccc;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
        .td-c{text-align:center;color:#8899bb;}
        .td-empty{text-align:center;padding:28px;color:#8899bb;}

        /* Responsive */
        @media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,1fr);}.skeleton-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:900px){
          .menu-btn{display:flex;}.sidebar{left:-240px;}.sidebar.active{left:0;}
          .main{margin-left:0;padding:16px;}.content-grid{grid-template-columns:1fr;}
          .stats-grid{grid-template-columns:repeat(2,1fr);}
        }
        @media(max-width:500px){.stats-grid{grid-template-columns:1fr;}}
      `}</style>
    </>
  );
}
