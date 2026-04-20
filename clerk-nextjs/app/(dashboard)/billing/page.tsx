// app/billing/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  CreditCard, Zap, Lock, CheckSquare, Clock, AlertTriangle, Shield,
} from "lucide-react";

const TRIAL_FEATURES = [
  { label:"50 leads total",              ok:true },
  { label:"AI Lead Scoring (0-100)",     ok:true },
  { label:"Full AI Insights per lead",   ok:true },
  { label:"Saved Leads (up to 50)",      ok:true },
  { label:"AI Assistant (20 messages)",  ok:true },
  { label:"Tasks & Call Logs",           ok:true },
  { label:"Meta Ads Generator (3 uses)", ok:true },
  { label:"Basic Dashboard",             ok:true },
  { label:"Export CSV / Excel / PDF",    ok:false },
  { label:"Email Center",                ok:false },
];

const PLANS = [
  {
    name:"Starter", targetUsers:"Freelancers & Solo Sellers",
    monthlyUSD:12, yearlyUSD:10, monthlyPKR:"3,300", yearlyPKR:"2,750",
    priceId:"price_1TGxXyFE3BY4oFrRoLc9B1d1", plan:"starter", popular:false,
    features:[
      {ok:true,  text:"100 leads / month"},
      {ok:true,  text:"Lead Search (Google Places)"},
      {ok:true,  text:"AI Lead Scoring & Insights"},
      {ok:true,  text:"Saved Leads (up to 100)"},
      {ok:true,  text:"Tasks & Call Logs"},
      {ok:true,  text:"AI Assistant (50 msgs/mo)"},
      {ok:true,  text:"Meta Ads Generator"},
      {ok:false, text:"Export CSV / Excel / PDF"},
      {ok:false, text:"Email Center"},
      {ok:false, text:"Advanced Analytics"},
    ],
  },
  {
    name:"Professional", targetUsers:"Small Agencies & Sales Reps",
    monthlyUSD:29, yearlyUSD:24, monthlyPKR:"8,000", yearlyPKR:"6,600",
    priceId:"price_1TGxaBFE3BY4oFrR3uXGtOXa", plan:"pro", popular:true,
    features:[
      {ok:true,  text:"1,000 leads / month"},
      {ok:true,  text:"Lead Search with all filters"},
      {ok:true,  text:"AI Lead Scoring & Full Insights"},
      {ok:true,  text:"Saved Leads (up to 1,000)"},
      {ok:true,  text:"Tasks & Call Logs"},
      {ok:true,  text:"AI Assistant (500 msgs/mo)"},
      {ok:true,  text:"Meta Ads Generator"},
      {ok:true,  text:"Export CSV / Excel / PDF"},
      {ok:true,  text:"Email Center"},
      {ok:false, text:"Advanced Analytics"},
    ],
  },
  {
    name:"Business", targetUsers:"Sales Teams & Agencies",
    monthlyUSD:59, yearlyUSD:49, monthlyPKR:"16,500", yearlyPKR:"13,500",
    priceId:"price_1TGxaZFE3BY4oFrRcA9BPQLq", plan:"business", popular:false,
    features:[
      {ok:true, text:"Unlimited leads / month"},
      {ok:true, text:"Lead Search with all filters"},
      {ok:true, text:"AI Lead Scoring & Full Insights"},
      {ok:true, text:"Saved Leads (Unlimited)"},
      {ok:true, text:"Tasks & Call Logs"},
      {ok:true, text:"AI Assistant (Unlimited)"},
      {ok:true, text:"Meta Ads Generator"},
      {ok:true, text:"Export CSV / Excel / PDF / JSON"},
      {ok:true, text:"Email Center + AI email writer"},
      {ok:true, text:"Advanced Analytics & Reports"},
    ],
  },
];

// ── Main billing content (uses useSearchParams — must be inside Suspense) ──
function BillingContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [billingCycle,  setBillingCycle]  = useState<"monthly"|"yearly">("monthly");
  const [dbUser,        setDbUser]        = useState<any>(null);
  const [trialLoading,  setTrialLoading]  = useState(false);
  const [trialSuccess,  setTrialSuccess]  = useState(false);

  const email   = user?.primaryEmailAddress?.emailAddress;
  const userId  = user?.id;
  const expired = searchParams.get("reason") === "trial_expired";

  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r => r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  const startTrial = async () => {
    if (!email) return;
    setTrialLoading(true);
    try {
      const res  = await fetch("/api/trial/start", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) });
      const data = await res.json();
      if (data.success) {
        setTrialSuccess(true);
        setTimeout(() => window.location.href = "/dashboard", 2000);
      } else {
        alert(data.error || "Could not start trial");
      }
    } catch { alert("Something went wrong"); }
    finally { setTrialLoading(false); }
  };

  const handleCheckout = async (priceId: string, plan: string) => {
    if (!email || !userId) { alert("User not loaded"); return; }
    const res  = await fetch("/api/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ priceId, plan, userEmail:email, userId }) });
    const data = await res.json();
    window.location.href = data.url;
  };

  const isAdmin       = dbUser?.role === "admin";
  const effectivePlan = dbUser?.effectivePlan || "free";
  const isOnTrial     = dbUser?.isOnTrial;
  const canStartTrial = dbUser?.canStartTrial;
  const daysLeft      = dbUser?.trialDaysLeft ?? 0;
  const isPaid        = isAdmin || dbUser?.subscriptionStatus === "active";

  return (
    <>
      <div className="main">

        {/* ── ADMIN BANNER ── */}
        {isAdmin && (
          <div className="admin-billing-banner">
            <Shield size={18} color="#ffd700"/>
            <div>
              <p className="admin-bill-title">Admin Account — All Features Unlocked</p>
              <p className="admin-bill-sub">You have full platform access. No billing or subscription required.</p>
            </div>
          </div>
        )}

        {!isAdmin && (expired || effectivePlan === "expired") && (
          <div className="expired-banner">
            <AlertTriangle size={18} color="#ff6b6b"/>
            <div>
              <p className="exp-title">Your 7-day free trial has ended</p>
              <p className="exp-sub">Choose a plan below to continue using Fatila. Your saved leads and data are safe.</p>
            </div>
          </div>
        )}

        {!isAdmin && isOnTrial && (
          <div className="trial-active-banner">
            <Clock size={16} color="#ffd700"/>
            <span><strong>{daysLeft} day{daysLeft!==1?"s":""}</strong> remaining in your free trial</span>
            <span className="sep">·</span>
            <span>Upgrade now to keep full access</span>
          </div>
        )}

        <div className="billing-header">
          <h2>Simple, Transparent Pricing</h2>
          <p className="billing-sub">No hidden fees. Cancel anytime.</p>
          <div className="cycle-toggle">
            <button className={`cycle-btn ${billingCycle==="monthly"?"active":""}`} onClick={()=>setBillingCycle("monthly")}>Monthly</button>
            <button className={`cycle-btn ${billingCycle==="yearly"?"active":""}`} onClick={()=>setBillingCycle("yearly")}>
              Yearly <span className="save-tag">Save 17%</span>
            </button>
          </div>
        </div>

        {!isAdmin && (canStartTrial || trialSuccess) && !isPaid && !isOnTrial && (
          <div className="trial-card">
            <div className="trial-left">
              <div className="trial-badge"><Zap size={14} color="#020817"/>7-Day Free Trial</div>
              <h3>Try Fatila free for 7 days</h3>
              <p>No credit card required. Get full access to core features and see the value before you pay.</p>
              <div className="trial-features">
                {TRIAL_FEATURES.map((f,i)=>(
                  <span key={i} className={`trial-feat ${f.ok?"yes":"no"}`}>
                    {f.ok ? <CheckSquare size={12} color="#00ff99"/> : <Lock size={12} color="#4a5568"/>}
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="trial-right">
              {trialSuccess ? (
                <div className="trial-success">
                  <CheckSquare size={32} color="#00ff99"/>
                  <p>Trial activated!</p>
                  <p className="success-sub">Redirecting to dashboard...</p>
                </div>
              ) : (
                <>
                  <div className="trial-price">
                    <span className="trial-free">FREE</span>
                    <span className="trial-days">7 days</span>
                  </div>
                  <button className="trial-btn" onClick={startTrial} disabled={trialLoading}>
                    {trialLoading ? <span className="spinner"/> : <><Zap size={16}/>Start Free Trial</>}
                  </button>
                  <p className="trial-note">No credit card · Cancel anytime</p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="plans-grid">
          {PLANS.map((p) => {
            const usd = billingCycle==="monthly" ? p.monthlyUSD : p.yearlyUSD;
            const pkr = billingCycle==="monthly" ? p.monthlyPKR : p.yearlyPKR;
            return (
              <div key={p.name} className={`plan-card ${p.popular?"popular":""}`}>
                {p.popular && <div className="popular-badge">Most Popular</div>}
                <h3>{p.name}</h3>
                <p className="plan-target">{p.targetUsers}</p>
                <div className="plan-price">
                  <span className="price-usd">${usd}</span>
                  <span className="price-mo">/mo</span>
                  {/* <span className="price-pkr">{pkr} PKR</span> */}
                  {/* {billingCycle==="yearly" && <span className="billed-ann">billed annually</span>} */}
                </div>
                <ul className="feat-list">
                  {p.features.map((f,i)=>(
                    <li key={i} className={f.ok?"feat-yes":"feat-no"}>
                      {f.ok ? <CheckSquare size={12} color="#00ff99"/> : <Lock size={12} color="#4a5568"/>}
                      {f.text}
                    </li>
                  ))}
                </ul>
                <button
                  className={`plan-btn ${p.popular?"btn-pop":""}`}
                  onClick={()=>handleCheckout(p.priceId, p.plan)}
                >
                  {isPaid && dbUser?.plan===p.plan ? "Current Plan" : `Get ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="cost-note">
          <Zap size={14} color="#00ff99"/>
          Pricing covers real API costs (OpenAI + Google Places). At 50 users our API spend is ~$14/mo — plans are priced to be sustainable for both sides.
        </div>

        <div className="faq-grid">
          {[
            {q:"Is the trial really free?",   a:"Yes — no credit card needed. Just sign up and click Start Trial."},
            {q:"What happens after 7 days?",  a:"You'll be redirected to this page to pick a plan. Your data stays safe."},
            {q:"Can I get a second trial?",   a:"No — one trial per account. This keeps the system fair for everyone."},
            {q:"Can I cancel anytime?",       a:"Yes — cancel from your dashboard, effective immediately."},
          ].map((item,i)=>(
            <div key={i} className="faq-card">
              <p className="faq-q">{item.q}</p>
              <p className="faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}
        .admin-billing-banner{display:flex;align-items:flex-start;gap:12px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;}
        .admin-bill-title{font-size:14px;font-weight:600;color:#ffd700;margin-bottom:3px;}
        .admin-bill-sub{font-size:13px;color:#8899bb;}
        .expired-banner{display:flex;align-items:flex-start;gap:12px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.25);border-radius:12px;padding:16px 20px;margin-bottom:20px;}
        .exp-title{font-size:14px;font-weight:600;color:#ff6b6b;margin-bottom:3px;}
        .exp-sub{font-size:13px;color:#8899bb;}
        .trial-active-banner{display:flex;align-items:center;gap:8px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:12px 18px;margin-bottom:20px;font-size:13px;color:#ccc;}
        .trial-active-banner strong{color:#ffd700;}
        .sep{color:#8899bb;margin:0 4px;}
        .billing-header{text-align:center;margin-bottom:32px;}
        .billing-header h2{color:#00ff99;font-size:26px;margin-bottom:8px;}
        .billing-sub{color:#8899bb;font-size:14px;margin-bottom:20px;}
        .cycle-toggle{display:inline-flex;gap:4px;background:rgba(255,255,255,.05);border-radius:30px;padding:4px;}
        .cycle-btn{padding:7px 20px;border-radius:26px;border:none;background:transparent;color:#8899bb;font-size:13px;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px;}
        .cycle-btn.active{background:#00ff99;color:#081633;font-weight:700;}
        .save-tag{background:rgba(0,255,153,.15);color:#00ff99;font-size:10px;padding:2px 7px;border-radius:20px;}
        .cycle-btn.active .save-tag{background:rgba(8,22,51,.25);color:#081633;}
        .trial-card{display:flex;gap:40px;background:rgba(0,255,153,.04);border:1px solid rgba(0,255,153,.2);border-radius:16px;padding:28px 32px;margin-bottom:28px;align-items:center;}
        .trial-left{flex:1;}
        .trial-badge{display:inline-flex;align-items:center;gap:6px;background:#00ff99;color:#020817;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:12px;}
        .trial-left h3{font-size:20px;font-weight:600;margin-bottom:8px;}
        .trial-left p{color:#8899bb;font-size:13px;margin-bottom:16px;line-height:1.6;}
        .trial-features{display:flex;flex-wrap:wrap;gap:7px;}
        .trial-feat{display:flex;align-items:center;gap:5px;font-size:12px;padding:4px 10px;border-radius:20px;}
        .trial-feat.yes{background:rgba(0,255,153,.07);border:1px solid rgba(0,255,153,.15);color:#ccc;}
        .trial-feat.no{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);color:#4a5568;}
        .trial-right{text-align:center;flex-shrink:0;width:180px;}
        .trial-price{margin-bottom:16px;}
        .trial-free{display:block;font-size:42px;font-weight:700;color:#00ff99;line-height:1;}
        .trial-days{display:block;font-size:14px;color:#8899bb;margin-top:4px;}
        .trial-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border:none;border-radius:30px;background:#00ff99;color:#020817;font-weight:700;font-size:14px;cursor:pointer;transition:.2s;}
        .trial-btn:hover:not(:disabled){background:#00cc66;}
        .trial-btn:disabled{opacity:.6;cursor:not-allowed;}
        .trial-note{font-size:11px;color:#8899bb;margin-top:10px;}
        .trial-success{display:flex;flex-direction:column;align-items:center;gap:8px;color:#00ff99;}
        .trial-success p{font-size:15px;font-weight:600;}
        .success-sub{font-size:12px;color:#8899bb!important;font-weight:400!important;}
        .plans-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px;}
        .plan-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:26px 22px;position:relative;display:flex;flex-direction:column;transition:.3s;}
        .plan-card:hover{background:rgba(0,255,153,.06);transform:translateY(-3px);border-color:rgba(0,255,153,.2);}
        .plan-card.popular{border-color:#00ff99;background:rgba(0,255,153,.06);}
        .popular-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#00ff99;color:#020817;font-size:11px;font-weight:700;padding:3px 14px;border-radius:20px;white-space:nowrap;}
        .plan-card h3{color:#00ff99;font-size:20px;margin-bottom:4px;}
        .plan-target{font-size:12px;color:#8899bb;margin-bottom:16px;}
        .plan-price{margin-bottom:20px;}
        .price-usd{font-size:38px;font-weight:700;}
        .price-mo{font-size:14px;color:#8899bb;margin-left:2px;}
        .price-pkr{display:block;font-size:14px;color:#ccc;margin-top:4px;}
        .billed-ann{display:block;font-size:11px;color:#00cc66;margin-top:2px;}
        .feat-list{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px;flex:1;}
        .feat-list li{display:flex;align-items:center;gap:8px;font-size:13px;}
        .feat-yes{color:#ccc;}
        .feat-no{color:#4a5568;}
        .plan-btn{padding:12px;border-radius:28px;background:rgba(0,255,153,.1);color:#00ff99;font-weight:700;font-size:13px;cursor:pointer;transition:.2s;border:1px solid rgba(0,255,153,.25);}
        .plan-btn:hover{background:rgba(0,255,153,.2);}
        .btn-pop{background:#00ff99;color:#020817;border-color:#00ff99;}
        .btn-pop:hover{background:#00cc66;}
        .cost-note{display:flex;align-items:flex-start;gap:9px;background:rgba(0,255,153,.04);border:1px solid rgba(0,255,153,.1);border-radius:10px;padding:13px 16px;font-size:13px;color:#8899bb;margin-bottom:24px;}
        .faq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:40px;}
        .faq-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px;}
        .faq-q{font-size:13px;color:#fff;font-weight:600;margin-bottom:6px;}
        .faq-a{font-size:12px;color:#8899bb;line-height:1.5;}
        .spinner{width:16px;height:16px;border:2px solid rgba(2,8,23,.3);border-top-color:#020817;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}
          .plans-grid{grid-template-columns:1fr;}
          .faq-grid{grid-template-columns:1fr 1fr;}
          .trial-card{flex-direction:column;gap:24px;}
          .trial-right{width:100%;}
        }
        @media(max-width:500px){.faq-grid{grid-template-columns:1fr;}}
      `}</style>
    </>
  );
}

// ── Default export wrapped in Suspense ────────────────────────────────────────
export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{color:"#00ff99",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>Loading...</div>}>
      <BillingContent />
    </Suspense>
  );
}
