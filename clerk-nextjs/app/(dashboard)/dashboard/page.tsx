"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Bot, Search, Bookmark, Shield, Target, Flame, Star, TrendingUp,
  Lock, ChevronRight, AlertTriangle, CheckSquare, Upload, Mail,
  Megaphone, Users, CreditCard, Globe, Activity, BarChart2, MousePointer,
} from "lucide-react";

// ─── GA Types ─────────────────────────────────────────────────────────────────
interface GAData {
  totalUsers:     number;
  newUsers:       number;
  activeUsers:    number;
  sessions:       number;
  trafficSources: { source: string; sessions: number }[];
  topCountries:   { country: string; users: number }[];
  pageViews:      number;
}

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", leadsMax:50,       aiMsgs:0 },
  trial:    { label:"Trial",        color:"#ffd700", leadsMax:50,       aiMsgs:10 },
  starter:  { label:"Starter",      color:"#00ff99", leadsMax:100,      aiMsgs:50 },
  pro:      { label:"Professional", color:"#3b9eff", leadsMax:1000,     aiMsgs:500 },
  business: { label:"Business",     color:"#a78bfa", leadsMax:Infinity, aiMsgs:Infinity },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

// Admin emails — yahan apna admin email add karo
const ADMIN_EMAILS = ["admin@fatila.com", "your@email.com"];

export default function DashboardPage() {
  const { user } = useUser();
  const [stats,      setStats]      = useState<any>(null);
  const [dbUser,     setDbUser]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [planStats,  setPlanStats]  = useState<Record<string,number>>({});

  // Google Analytics state — only fetched for admin
  const [gaData,    setGaData]    = useState<GAData | null>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [gaError,   setGaError]   = useState("");

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── fetchStats — reusable, called on load + tab-focus + interval ─────────
  const fetchStats = async (em: string) => {
    try {
      const [uRes, sRes] = await Promise.all([
        fetch("/api/get-user",        { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email: em }) }),
        fetch("/api/dashboard/stats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email: em }) }),
      ]);
      const uData = await uRes.json();
      const sData = await sRes.json();
      setDbUser(uData);
      setStats(sData);
      if (uData.role === "admin") {
        const aRes  = await fetch("/api/admin/users", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email: em }) });
        const aData = await aRes.json();
        const users = aData.users || [];
        setAdminUsers(users);
        const breakdown: Record<string,number> = {};
        users.forEach((u:any) => { const p = u.plan || "free"; breakdown[p] = (breakdown[p]||0)+1; });
        setPlanStats(breakdown);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── fetchGA — calls /api/admin/analytics which wraps GA Data API ────────
  const fetchGA = async () => {
    setGaLoading(true);
    setGaError("");
    try {
      const res  = await fetch("/api/admin/analytics");
      const data = await res.json();
      if (data.error) { setGaError(data.error); return; }
      setGaData(data);
    } catch { setGaError("Could not load analytics data."); }
    finally  { setGaLoading(false); }
  };

  // Initial load
  useEffect(() => {
    if (!email) return;
    fetchStats(email);
  }, [email]);

  // Re-fetch when user returns to this tab (e.g. after lead search)
  useEffect(() => {
    if (!email) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStats(email);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [email]);

  // Poll every 20s while dashboard is open — keeps count live
  useEffect(() => {
    if (!email) return;
    const id = setInterval(() => fetchStats(email), 20_000);
    return () => clearInterval(id);
  }, [email]);

  // Fetch GA when admin confirmed, refresh every 30s for real-time active users
  useEffect(() => {
    if (!dbUser || dbUser.role !== "admin") return;
    fetchGA();
    const id = setInterval(fetchGA, 30_000);
    return () => clearInterval(id);
  }, [dbUser]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isAdmin   = dbUser?.role === "admin";
  // Admin always gets business-level access
  const plan      = isAdmin ? "business" : ((dbUser?.plan as PlanKey) || "free");
  const planCfg   = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const isPaid    = isAdmin || plan === "trial" || plan !== "free";
  // Parse leadsUsed safely — API might return array, object, or number
  const _rawLeads = stats?.totalLeads ?? stats?.monthlyLeads ?? stats?.leadsUsedThisMonth ?? 0;
  const leadsUsed = typeof _rawLeads === "number" ? _rawLeads
                  : Array.isArray(_rawLeads)       ? _rawLeads.length
                  : typeof _rawLeads === "object" && _rawLeads !== null ? Number(Object.values(_rawLeads)[0] ?? 0)
                  : Number(_rawLeads) || 0;
  const leadsMax  = planCfg.leadsMax;
  const pct       = leadsMax === Infinity ? 100 : Math.min((leadsUsed / leadsMax)*100, 100);

  const fmtDate       = (d:string) => { try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}catch{return ""} };
  const priorityColor = (p:string) => p==="High"?"#ff6b6b":p==="Medium"?"#ffd700":"#00ff99";
  const statusColor   = (s:string) => s==="new"?"#00ff99":s==="contacted"?"#3b9eff":s==="qualified"?"#ffd700":s==="converted"?"#00e676":"#ff6b6b";

  return (
    <>
      {/* ── Main content ── */}
      <div className="main">

        {/* Header */}
        <div className="dash-header">
          <div>
            <h1>Welcome back, {user?.firstName || "User"} {isAdmin && <span className="admin-badge"><Shield size={13}/>Admin</span>}</h1>
            <p className="sub">{isAdmin ? "Platform overview & user management" : "Here's what's happening with your leads today"}</p>
          </div>
          <div className="header-right">
            {/* <span className="plan-pill" style={{color:isAdmin?"#ffd700":planCfg.color,borderColor:isAdmin?"rgba(255,215,0,.44)":` ${planCfg.color}44`,background:isAdmin?"rgba(255,215,0,.12)":`${planCfg.color}12`}}>
              {isAdmin ? "Admin" : planCfg.label}
            </span> */}
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
                    {Icon:Target,      label:"Total Leads",    value:leadsUsed,                                          color:"#00ff99"},
                    {Icon:Bookmark,    label:"Saved Leads",    value:Number(stats?.savedLeads??0)||0,                    color:"#3b9eff"},
                    {Icon:Flame,       label:"High Priority",  value:Number(stats?.highPriorityLeads??0)||0,             color:"#ff6b6b"},
                    {Icon:CheckSquare, label:"Tasks Done",     value:Number(stats?.completedTasks??0)||0,                color:"#a78bfa"},
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
                    <span className="usage-val" style={{color:pct>=80?"#ff6b6b":planCfg.color}}>
                      {leadsMax===Infinity ? `${leadsUsed} used  ·  Unlimited` : `${leadsUsed} / ${leadsMax}`}
                    </span>
                  </div>
                  <div className="usage-track">
                    <div className="usage-fill" style={{
                      width:`${pct}%`,
                      background: leadsMax===Infinity?"#a78bfa":pct>=80?"#ff6b6b":pct>=60?"#ffd700":"#00ff99"
                    }}/>
                  </div>
                  {pct>=80 && leadsMax!==Infinity && (
                    <p className="usage-warn">
                      <AlertTriangle size={12} color="#ff6b6b" style={{display:"inline",marginRight:4}}/>
                      {pct>=100 ? "Limit reached — " : "Almost at limit — "}<a href="/billing">upgrade now</a>
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
                              <span className="lead-name">{lead.company.length > 35 ? lead.company.slice(0,35)+"…" : lead.company}</span>
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
            {isAdmin && (
              <div className="admin-panel">
                <div className="admin-hdr">
                  <Shield size={15} color="#ffd700"/><h3>Admin — Platform Overview</h3>
                </div>

                {/* Platform Stats Row */}
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{background:"rgba(0,255,153,.1)",border:"1px solid rgba(0,255,153,.2)"}}>
                      <Users size={18} color="#00ff99"/>
                    </div>
                    <div>
                      <h4>{adminUsers.length}</h4>
                      <p>Total Users</p>
                    </div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{background:"rgba(59,158,255,.1)",border:"1px solid rgba(59,158,255,.2)"}}>
                      <CreditCard size={18} color="#3b9eff"/>
                    </div>
                    <div>
                      <h4>{adminUsers.filter((u:any)=>u.subscriptionStatus==="active").length}</h4>
                      <p>Paid Subscribers</p>
                    </div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{background:"rgba(255,215,0,.1)",border:"1px solid rgba(255,215,0,.2)"}}>
                      <Star size={18} color="#ffd700"/>
                    </div>
                    <div>
                      <h4>{adminUsers.filter((u:any)=>u.isOnTrial).length}</h4>
                      <p>On Trial</p>
                    </div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)"}}>
                      <TrendingUp size={18} color="#a78bfa"/>
                    </div>
                    <div>
                      <h4>{adminUsers.filter((u:any)=>!u.subscriptionStatus||u.subscriptionStatus==="inactive").length}</h4>
                      <p>Free Users</p>
                    </div>
                  </div>
                </div>

                {/* Plan Breakdown */}
                <div className="plan-breakdown">
                  <p className="breakdown-title">Subscription Plan Breakdown</p>
                  <div className="breakdown-grid">
                    {[
                      {key:"starter",  label:"Starter",      color:"#00ff99"},
                      {key:"pro",      label:"Professional", color:"#3b9eff"},
                      {key:"business", label:"Business",     color:"#a78bfa"},
                      {key:"free",     label:"Free",         color:"#8899bb"},
                      {key:"trial",    label:"Trial",        color:"#ffd700"},
                    ].map(({key,label,color})=>(
                      <div key={key} className="breakdown-chip" style={{borderColor:`${color}30`,background:`${color}0a`}}>
                        <span className="bc-dot" style={{background:color}}/>
                        <span className="bc-label">{label}</span>
                        <span className="bc-count" style={{color}}>{planStats[key]||0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── GOOGLE ANALYTICS SECTION ── */}
                <div className="ga-section">
                  <div className="ga-section-hdr">
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <BarChart2 size={15} color="#3b9eff"/>
                      <span className="ga-title">Website Analytics</span>
                      <span className="ga-badge">Last 7 days</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span className="live-dot-wrap">
                        <span className="live-dot"/>
                        <span className="live-label">Live</span>
                      </span>
                      <button className="ga-refresh" onClick={fetchGA} disabled={gaLoading}>
                        {gaLoading ? "Loading…" : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {gaError && (
                    <div className="ga-error">
                      <AlertTriangle size={13} color="#ff6b6b"/>
                      <span>{gaError} — Check /api/admin/analytics setup.</span>
                    </div>
                  )}

                  {gaLoading && !gaData && (
                    <div className="ga-skeleton-row">
                      {[...Array(4)].map((_,i)=><div key={i} className="ga-skeleton"/>)}
                    </div>
                  )}

                  {gaData && (
                    <>
                      {/* 4 stat cards */}
                      <div className="ga-stats-grid">
                        {[
                          { Icon:Users,       label:"Total Users",      value:gaData.totalUsers,  color:"#00ff99" },
                          { Icon:MousePointer,label:"New Users",         value:gaData.newUsers,    color:"#3b9eff" },
                          { Icon:Globe,       label:"Sessions",          value:gaData.sessions,    color:"#ffd700" },
                          { Icon:Activity,    label:"Active Right Now",  value:gaData.activeUsers, color:"#00ff99", highlight:true },
                        ].map(({Icon,label,value,color,highlight})=>(
                          <div key={label} className="ga-stat-card" style={highlight?{border:"1px solid rgba(0,255,153,.25)",background:"rgba(0,255,153,.05)"}:{}}>
                            <div className="ga-stat-icon" style={{background:`${color}18`,border:`1px solid ${color}30`}}>
                              <Icon size={16} color={color}/>
                            </div>
                            <div>
                              <h4 className="ga-num" style={highlight?{color}:{}}>{value.toLocaleString()}</h4>
                              <p className="ga-lbl">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Traffic sources + Countries */}
                      <div className="ga-bottom-grid">
                        <div className="ga-card">
                          <p className="ga-card-title">Traffic Sources (Sessions)</p>
                          <div className="ga-list">
                            {gaData.trafficSources.length === 0 && <p style={{color:"#8899bb",fontSize:12}}>No data</p>}
                            {gaData.trafficSources.map((s,i)=>{
                              const total = gaData.trafficSources.reduce((a,b)=>a+b.sessions,0);
                              const pct   = total>0 ? Math.round((s.sessions/total)*100) : 0;
                              const cols  = ["#3b9eff","#00ff99","#a78bfa","#ffd700","#ff6b6b","#8899bb"];
                              const c     = cols[i%cols.length];
                              return (
                                <div key={i} className="ga-list-row">
                                  <div className="ga-list-left">
                                    <span className="ga-dot" style={{background:c}}/>
                                    <span className="ga-name">{s.source}</span>
                                  </div>
                                  <div className="ga-list-right">
                                    <div className="ga-bar-wrap"><div className="ga-bar-fill" style={{width:`${pct}%`,background:c}}/></div>
                                    <span className="ga-val">{s.sessions}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="ga-card">
                          <p className="ga-card-title">Active Users by Country</p>
                          <div className="ga-list">
                            {gaData.topCountries.length === 0 && <p style={{color:"#8899bb",fontSize:12}}>No data</p>}
                            {gaData.topCountries.map((c,i)=>{
                              const max = gaData.topCountries[0]?.users||1;
                              const pct = Math.round((c.users/max)*100);
                              return (
                                <div key={i} className="ga-list-row">
                                  <div className="ga-list-left">
                                    <span className="ga-rank">{i+1}</span>
                                    <span className="ga-name">{c.country}</span>
                                  </div>
                                  <div className="ga-list-right">
                                    <div className="ga-bar-wrap"><div className="ga-bar-fill" style={{width:`${pct}%`,background:"#3b9eff"}}/></div>
                                    <span className="ga-val">{c.users}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Users Table */}
                <div className="table-wrap">
                  <table>
                    <thead><tr>{["Email","Plan","Status","Role","Leads","Tasks","Joined"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {adminUsers.length===0
                        ?<tr><td colSpan={7} className="td-empty">No users found</td></tr>
                        :adminUsers.map((u:any)=>(
                          <tr key={u.id}>
                            <td className="td-email">{u.email}</td>
                            <td><span style={{color:u.plan==="business"?"#a78bfa":u.plan==="pro"?"#3b9eff":u.plan==="starter"?"#00ff99":"#8899bb",fontSize:12,fontWeight:700}}>{u.plan||"free"}</span></td>
                            <td><span style={{color:u.subscriptionStatus==="active"?"#00ff99":u.isOnTrial?"#ffd700":"#8899bb",fontSize:12}}>{u.subscriptionStatus==="active"?"Active":u.isOnTrial?"Trial":"Inactive"}</span></td>
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

        /* Main */
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}
        .dash-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px;}
        .dash-header h1{font-size:21px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:10px;}
        .admin-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(255,215,0,.12);color:#ffd700;border:1px solid rgba(255,215,0,.3);font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;}
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
        .content-grid{display:grid;grid-template-columns:1.2fr 0.8fr;gap:18px;}
        .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;overflow:hidden;}
        .card-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .card-hdr h3{font-size:14px;font-weight:600;}
        .card-link{display:flex;align-items:center;gap:4px;color:#8899bb;font-size:12px;text-decoration:none;}
        .card-link:hover{color:#00ff99;}

        /* Lead list */
        .lead-list{display:flex;flex-direction:column;gap:8px;}
        .lead-row{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:rgba(255,255,255,.03);border-radius:8px;gap:8px;min-width:0;}
        .lead-l{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;overflow:hidden;}
        .lead-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
        .lead-ind{font-size:11px;color:#8899bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
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

        /* Admin panel */
        .admin-panel{margin-top:22px;background:rgba(255,215,0,.03);border:1px solid rgba(255,215,0,.12);border-radius:14px;padding:20px;}
        .admin-hdr{display:flex;align-items:center;gap:7px;margin-bottom:18px;}
        .admin-hdr h3{font-size:14px;font-weight:600;color:#ffd700;}

        /* Admin stats */
        .admin-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;}
        .admin-stat-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px;}
        .admin-stat-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .admin-stat-card h4{font-size:20px;font-weight:700;}
        .admin-stat-card p{font-size:11px;color:#8899bb;margin-top:2px;}

        /* Plan breakdown */
        .plan-breakdown{margin-bottom:18px;}
        .breakdown-title{font-size:12px;color:#8899bb;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;}
        .breakdown-grid{display:flex;gap:8px;flex-wrap:wrap;}
        .breakdown-chip{display:flex;align-items:center;gap:7px;padding:6px 14px;border-radius:20px;border:1px solid;font-size:12px;}
        .bc-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .bc-label{color:#ccc;}
        .bc-count{font-weight:700;margin-left:2px;}

        /* Table */
        .table-wrap{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        th{text-align:left;padding:7px 12px;color:#8899bb;font-size:11px;font-weight:600;border-bottom:1px solid rgba(255,255,255,.07);}
        td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04);}
        .td-email{color:#ccc;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
        .td-c{text-align:center;color:#8899bb;}
        .td-empty{text-align:center;padding:28px;color:#8899bb;}

        /* Responsive */
        @media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,1fr);}.skeleton-grid{grid-template-columns:repeat(2,1fr);}.admin-stats-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}.content-grid{grid-template-columns:1fr;}
          .stats-grid{grid-template-columns:repeat(2,1fr);}
          .admin-stats-grid{grid-template-columns:repeat(2,1fr);}
        }
        @media(max-width:500px){.stats-grid{grid-template-columns:1fr;}.breakdown-grid{flex-direction:column;}}

        /* ── Google Analytics section ── */
        .ga-section{background:rgba(59,158,255,.03);border:1px solid rgba(59,158,255,.15);border-radius:12px;padding:16px 18px;margin-bottom:18px;}
        .ga-section-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .ga-title{font-size:13px;font-weight:600;color:#e0e8ff;}
        .ga-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(59,158,255,.12);border:1px solid rgba(59,158,255,.25);color:#3b9eff;}
        .live-dot-wrap{display:flex;align-items:center;gap:5px;}
        .live-dot{width:7px;height:7px;border-radius:50%;background:#00ff99;animation:livepulse 1.5s ease infinite;}
        @keyframes livepulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
        .live-label{font-size:11px;color:#00ff99;font-weight:600;}
        .ga-refresh{font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid rgba(59,158,255,.3);background:rgba(59,158,255,.08);color:#3b9eff;cursor:pointer;transition:.2s;}
        .ga-refresh:hover:not(:disabled){background:rgba(59,158,255,.18);}
        .ga-refresh:disabled{opacity:.5;cursor:not-allowed;}
        .ga-error{display:flex;align-items:center;gap:7px;background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.2);border-radius:8px;padding:10px 13px;font-size:12px;color:#ff6b6b;margin-bottom:12px;}
        .ga-skeleton-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
        .ga-skeleton{height:72px;border-radius:10px;background:rgba(255,255,255,.04);animation:pulse 1.4s ease infinite;}
        .ga-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
        .ga-stat-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:13px;display:flex;align-items:center;gap:10px;}
        .ga-stat-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ga-num{font-size:20px;font-weight:700;}
        .ga-lbl{font-size:11px;color:#8899bb;margin-top:2px;}
        .ga-bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .ga-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:14px;}
        .ga-card-title{font-size:11px;font-weight:600;color:#8899bb;margin-bottom:10px;text-transform:uppercase;letter-spacing:.4px;}
        .ga-list{display:flex;flex-direction:column;gap:8px;}
        .ga-list-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .ga-list-left{display:flex;align-items:center;gap:7px;min-width:0;flex:1;}
        .ga-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .ga-rank{width:16px;height:16px;border-radius:4px;background:rgba(59,158,255,.15);color:#3b9eff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ga-name{font-size:12px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ga-list-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .ga-bar-wrap{width:80px;height:5px;background:rgba(255,255,255,.07);border-radius:5px;overflow:hidden;}
        .ga-bar-fill{height:100%;border-radius:5px;transition:width .5s ease;}
        .ga-val{font-size:12px;font-weight:600;color:#fff;min-width:24px;text-align:right;}
        @media(max-width:1100px){.ga-stats-grid{grid-template-columns:repeat(2,1fr);}.ga-bottom-grid{grid-template-columns:1fr;}}
      `}</style>
    </>
  );
}
