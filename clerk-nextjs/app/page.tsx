"use client";

import { useState, useEffect, useRef } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Star, Zap, Download, BarChart2, Clock,
  CheckCircle, Lock, ArrowRight, Play, Globe,
  Users, Building2, Layers, ChevronRight,
  Target, Brain, Inbox, FileDown, Activity,
  Check, X, Shield, Award, TrendingUp, Briefcase,
  MapPin, Mail, Phone, Database, Cpu, LayoutDashboard,
} from "lucide-react";

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      router.push("/dashboard");
    } else {
      window.location.href =
        "https://accounts.fatilaai.com/sign-in?redirect_url=https%3A%2F%2Ffatilaai.com%2Fdashboard";
    }
  };

  const handleSignUp = () => {
    window.location.href =
      "https://accounts.fatilaai.com/sign-up?redirect_url=https%3A%2F%2Ffatilaai.com%2Fdashboard";
  };

  /* ── Typing Effect ── */
  const headlines = [
    "Find 60 B2B Leads in 60 Seconds",
    "AI-Scored, Verified & Ready to Close",
    "Stop Prospecting. Start Closing.",
  ];
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = headlines[headlineIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (!isDeleting && typedText === current) {
      timeout = setTimeout(() => setIsDeleting(true), 2600);
    } else if (isDeleting && typedText === "") {
      setIsDeleting(false);
      setHeadlineIdx((i) => (i + 1) % headlines.length);
    } else {
      timeout = setTimeout(() => {
        setTypedText(
          isDeleting
            ? current.slice(0, typedText.length - 1)
            : current.slice(0, typedText.length + 1)
        );
      }, isDeleting ? 35 : 65);
    }
    return () => clearTimeout(timeout);
  }, [typedText, isDeleting, headlineIdx]);

  /* ── Counters ── */
  const targets = { leads: 10000, companies: 5000, industries: 120, countries: 35 };
  const [counts, setCounts] = useState({ leads: 0, companies: 0, industries: 0, countries: 0 });
  const [countersStarted, setCountersStarted] = useState(false);
  const countersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !countersStarted) setCountersStarted(true); },
      { threshold: 0.3 }
    );
    if (countersRef.current) observer.observe(countersRef.current);
    return () => observer.disconnect();
  }, [countersStarted]);

  useEffect(() => {
    if (!countersStarted) return;
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounts({
        leads:      Math.floor(ease * targets.leads),
        companies:  Math.floor(ease * targets.companies),
        industries: Math.floor(ease * targets.industries),
        countries:  Math.floor(ease * targets.countries),
      });
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [countersStarted]);

  /* ── Canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const nodes: any[] = [];
    for (let i = 0; i < 80; i++) {
      nodes.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff99"; ctx.fill();
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = "rgba(0,255,153,.15)"; ctx.stroke();
          }
        }
      }
      requestAnimationFrame(animate);
    };
    animate();
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ── Mobile Menu ── */
  const [menuOpen, setMenuOpen] = useState(false);

  /* ── Features ── */
  const features = [
    { Icon: Search,   title: "Smart Lead Discovery",          desc: "Find exactly the right businesses in any city — by industry, keyword, or location. Results in seconds, not hours.",              badge: "Most Used" },
    { Icon: MapPin,   title: "Google Business Leads",         desc: "Get verified phone numbers, emails, addresses and ratings directly from Google — ready to call or email instantly.",               badge: "" },
    { Icon: Brain,    title: "AI Lead Scoring",               desc: "Every lead is scored 0–100 automatically. Know which businesses to contact first — stop wasting time on cold leads.",             badge: "AI Powered" },
    { Icon: Zap,      title: "Automation Workflows",          desc: "Save 10+ hours per week. AI handles prospecting so you can focus entirely on closing deals.",                                      badge: "" },
    { Icon: Activity, title: "Real-Time Data",                desc: "Live data delivery — no stale lists. Every search returns fresh, verified contacts from current sources.",                         badge: "" },
    { Icon: FileDown, title: "Export to CRM",                 desc: "Download to CSV, Excel, or PDF. Push directly to your CRM — zero manual copy-paste, ever.",                                       badge: "" },
  ];

  /* ── Steps ── */
  const steps = [
    { Icon: Target,   num: "01", title: "Define Your Target",    desc: "Type your industry, city, and keywords. Takes 10 seconds." },
    { Icon: Cpu,      num: "02", title: "AI Scans & Scores",     desc: "Our engine crawls Google listings and scores every lead 0–100." },
    { Icon: Database, num: "03", title: "Get 60 Leads Instantly",desc: "Receive enriched, verified contacts — names, phones, emails — ready for outreach." },
  ];

  /* ── Testimonials ── */
  const testimonials = [
    { name: "Ahmed Al-Rashidi",  role: "Sales Director",       location: "Riyadh, Saudi Arabia", text: "I found 47 qualified restaurant leads in Riyadh in under 5 minutes. Closed 3 clients that same week. Nothing comes close at this price.", stars: 5 },
    { name: "Muhammad Tariq",    role: "Agency Owner",          location: "Lahore, Pakistan",      text: "We used to spend 2 hours manually searching for leads. Fatila AI does it in 60 seconds with AI scoring. Our team's productivity doubled.", stars: 5 },
    { name: "Sarah K.",          role: "B2B Consultant",        location: "United States",         text: "I compared this to Apollo.io and Hunter. For MENA and Pakistan markets, Fatila AI is unmatched. The Google Places integration is incredibly accurate.", stars: 5 },
    { name: "Omar Khalil",       role: "Startup Founder",       location: "Amman, Jordan",         text: "The AI lead scoring alone is worth the subscription. I now call only the top 10 leads the AI ranks highest. My close rate tripled.", stars: 5 },
    { name: "Fatima Malik",      role: "Marketing Manager",     location: "Karachi, Pakistan",     text: "Setup took 2 minutes. I ran my first search and had 60 leads with phone numbers and ratings. No other tool gives this speed for Pakistan market.", stars: 5 },
    { name: "James Chen",        role: "Sales Manager",         location: "New York, USA",         text: "Switched from a $300/month tool to Fatila AI at $12/month. Same quality leads, better AI scoring. Best decision this year.", stars: 5 },
  ];

  /* ── Pricing — exact from billing page ── */
  const plans = [
    {
      name: "Starter", targetUsers: "Freelancers & Solo Sellers",
      monthlyUSD: 12, monthlyPKR: "3,300", popular: false,
      jobLimit: "100 results/mo",
      features: [
        { ok: true,  text: "100 leads / month" },
        { ok: true,  text: "Lead Search (Google Places)" },
        { ok: true,  text: "AI Lead Scoring & Insights" },
        { ok: true,  text: "Saved Leads (up to 100)" },
        { ok: true,  text: "Tasks & Call Logs" },
        { ok: true,  text: "AI Assistant (50 msgs/mo)" },
        { ok: true,  text: "Meta Ads Generator" },
        { ok: true,  text: "Job Search (100 results/mo)" },
        { ok: false, text: "Export CSV / Excel / PDF" },
        { ok: false, text: "Email Center" },
        { ok: false, text: "Advanced Analytics" },
      ],
    },
    {
      name: "Professional", targetUsers: "Small Agencies & Sales Reps",
      monthlyUSD: 29, monthlyPKR: "8,000", popular: true,
      jobLimit: "500 results/mo",
      features: [
        { ok: true,  text: "1,000 leads / month" },
        { ok: true,  text: "Lead Search with all filters" },
        { ok: true,  text: "AI Lead Scoring & Full Insights" },
        { ok: true,  text: "Saved Leads (up to 1,000)" },
        { ok: true,  text: "Tasks & Call Logs" },
        { ok: true,  text: "AI Assistant (500 msgs/mo)" },
        { ok: true,  text: "Meta Ads Generator" },
        { ok: true,  text: "Job Search (500 results/mo)" },
        { ok: true,  text: "Export CSV / Excel / PDF" },
        { ok: true,  text: "Email Center" },
        { ok: false, text: "Advanced Analytics" },
      ],
    },
    {
      name: "Business", targetUsers: "Sales Teams & Agencies",
      monthlyUSD: 59, monthlyPKR: "16,500", popular: false,
      jobLimit: "Unlimited",
      features: [
        { ok: true, text: "Unlimited leads / month" },
        { ok: true, text: "Lead Search with all filters" },
        { ok: true, text: "AI Lead Scoring & Full Insights" },
        { ok: true, text: "Saved Leads (Unlimited)" },
        { ok: true, text: "Tasks & Call Logs" },
        { ok: true, text: "AI Assistant (Unlimited)" },
        { ok: true, text: "Meta Ads Generator" },
        { ok: true, text: "Job Search (Unlimited results)" },
        { ok: true, text: "Export CSV / Excel / PDF / JSON" },
        { ok: true, text: "Email Center + AI email writer" },
        { ok: true, text: "Advanced Analytics & Reports" },
      ],
    },
  ];

  /* ── Comparison ── */
  const comparison = [
    { feature: "Starting Price",       fatila: "$12/mo",        apollo: "$49/mo",     hunter: "$34/mo" },
    { feature: "AI Lead Scoring",      fatila: "Included",      apollo: "Included",   hunter: "Not available" },
    { feature: "Google Places Data",   fatila: "Real-time",     apollo: "No",         hunter: "No" },
    { feature: "MENA Market Coverage", fatila: "Specialized",   apollo: "Limited",    hunter: "Limited" },
    { feature: "Leads per Search",     fatila: "60 leads",      apollo: "Varies",     hunter: "Domain only" },
    { feature: "Meta Ads Generator",   fatila: "Included",      apollo: "No",         hunter: "No" },
    { feature: "Free Trial",           fatila: "7 days",        apollo: "Limited",    hunter: "Limited" },
    { feature: "Email Center",         fatila: "Pro+",          apollo: "Included",   hunter: "Included" },
  ];

  return (
    <div className="relative text-white min-h-screen w-full overflow-hidden">
      <style>{`
        * { box-sizing: border-box; }

        .hb-bar { display:block; width:22px; height:2px; background:#fff; border-radius:2px; transition:transform .28s ease, opacity .28s ease; }
        .hb-open .hb-bar:nth-child(1) { transform:translateY(8px) rotate(45deg); }
        .hb-open .hb-bar:nth-child(2) { opacity:0; transform:scaleX(0); }
        .hb-open .hb-bar:nth-child(3) { transform:translateY(-8px) rotate(-45deg); }
        .mobile-menu { transition:opacity .25s ease, transform .25s ease; transform-origin:top right; }
        .mobile-menu-closed { opacity:0; transform:scale(.95) translateY(-6px); pointer-events:none; }
        .mobile-menu-open  { opacity:1; transform:scale(1) translateY(0); pointer-events:all; }

        @keyframes glowPulse { 0%,100%{box-shadow:0 0 18px rgba(57,211,83,.45)} 50%{box-shadow:0 0 38px rgba(57,211,83,.8)} }
        .cta-btn:hover { animation:glowPulse 1.8s ease-in-out infinite; }

        .circuit-circle { position:absolute; top:60%; left:50%; transform:translate(-50%,-50%); width:520px; height:520px; border-radius:50%; border:1.5px dashed rgba(57,211,83,0.25); pointer-events:none; z-index:0; }
        .circuit-circle::before { content:''; position:absolute; inset:18px; border-radius:50%; border:1px solid rgba(47,164,255,0.18); animation:spinCW 18s linear infinite; pointer-events:none; }
        .circuit-circle::after  { content:''; position:absolute; inset:40px; border-radius:50%; border:1.5px dashed rgba(57,211,83,0.2); animation:spinCCW 12s linear infinite; pointer-events:none; }
        @keyframes spinCW  { to { transform:rotate(360deg);  } }
        @keyframes spinCCW { to { transform:rotate(-360deg); } }

        @keyframes bannerShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes badgeBounce   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-2px) scale(1.06)} }
        @keyframes marqueeScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes arrowPing     { 0%,100%{transform:translateX(0);opacity:1} 50%{transform:translateX(4px);opacity:.6} }

        .top-banner { position:relative; overflow:hidden; background:linear-gradient(90deg,#020c1e 0%,#05214d 20%,#0a3a2a 40%,#05214d 60%,#020c1e 80%,#05214d 100%); background-size:300% 100%; animation:bannerShimmer 6s linear infinite; border-bottom:1px solid rgba(57,211,83,0.3); z-index:60; }
        .top-banner::before { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent 0%,rgba(57,211,83,.08) 30%,rgba(47,164,255,.08) 60%,transparent 100%); pointer-events:none; }
        .banner-badge { display:inline-flex; align-items:center; gap:4px; background:linear-gradient(135deg,#39d353,#2fa4ff); color:#020c1e; font-size:10px; font-weight:800; letter-spacing:.08em; padding:3px 9px; border-radius:20px; text-transform:uppercase; white-space:nowrap; animation:badgeBounce 2s ease-in-out infinite; flex-shrink:0; }
        .banner-arrow { display:inline-flex; align-items:center; gap:4px; background:rgba(57,211,83,0.15); border:1px solid rgba(57,211,83,0.45); color:#39d353; font-size:11px; font-weight:700; padding:3px 10px 3px 8px; border-radius:20px; white-space:nowrap; flex-shrink:0; transition:background .2s,border-color .2s; cursor:pointer; }
        .banner-arrow:hover { background:rgba(57,211,83,0.28); border-color:#39d353; }
        .banner-arrow-icon { animation:arrowPing 1.2s ease-in-out infinite; display:inline-flex; }
        .banner-marquee-track { display:flex; align-items:center; animation:marqueeScroll 20s linear infinite; width:max-content; }
        .banner-marquee-track:hover { animation-play-state:paused; }

        .cursor-blink { display:inline-block; width:3px; height:1em; background:#39d353; margin-left:3px; vertical-align:middle; animation:cursorBlink 1s step-end infinite; }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        .video-placeholder { border-radius:16px; overflow:hidden; background:linear-gradient(135deg,rgba(7,31,74,0.9) 0%,rgba(2,6,31,0.95) 100%); border:1.5px solid rgba(57,211,83,0.2); box-shadow:0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(57,211,83,0.06); }
        .video-play-btn { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#39d353,#2fa4ff); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .2s,box-shadow .2s; box-shadow:0 0 30px rgba(57,211,83,0.5); border:none; }
        .video-play-btn:hover { transform:scale(1.1); box-shadow:0 0 50px rgba(57,211,83,0.8); }

        @keyframes scrollTestimonials { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .testimonials-track { display:flex; gap:20px; animation:scrollTestimonials 30s linear infinite; width:max-content; }
        .testimonials-track:hover { animation-play-state:paused; }
        .testimonial-card { width:320px; flex-shrink:0; background:rgba(255,255,255,0.04); border:1px solid rgba(57,211,83,0.12); border-radius:16px; padding:24px; transition:border-color .3s; }
        .testimonial-card:hover { border-color:rgba(57,211,83,0.35); }

        .pricing-card { border-radius:20px; padding:34px 26px; transition:transform .3s,box-shadow .3s; display:flex; flex-direction:column; }
        .pricing-card:hover { transform:translateY(-5px); box-shadow:0 20px 60px rgba(0,0,0,0.5); }
        .pricing-popular { position:relative; }
        .pricing-popular::before { content:'Most Popular'; position:absolute; top:-14px; left:50%; transform:translateX(-50%); background:linear-gradient(90deg,#39d353,#2fa4ff); color:#020c1e; font-size:11px; font-weight:800; padding:3px 14px; border-radius:20px; white-space:nowrap; }

        .comparison-row:hover { background:rgba(57,211,83,0.03); }
        .check-green { color:#39d353; }
        .cross-red   { color:#4a5568; }

        @keyframes urgencyPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .urgency-dot { width:8px; height:8px; border-radius:50%; background:#ff6b6b; animation:urgencyPulse 1.5s infinite; flex-shrink:0; }

        .section-label { font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#39d353; margin-bottom:12px; display:block; }
      `}</style>

      <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:-10, pointerEvents:"none" }} />
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />

      <div className="relative z-10">

        {/* ══ TOP BANNER ══ */}
        <div className="top-banner w-full py-2 px-4 flex items-center justify-center gap-3 fixed top-0 left-0 right-0 z-[70]">
          <span className="banner-badge"><Zap size={10} /> FREE</span>
          <div className="overflow-hidden flex-1 max-w-[600px]" style={{ maskImage:"linear-gradient(to right,transparent,black 12%,black 88%,transparent)" }}>
            <div className="banner-marquee-track">
              {[0,1].map(i => (
                <span key={i} className="flex items-center gap-6 pr-6">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap"><TrendingUp size={11} className="text-[#39d353]" /> Start Finding B2B Leads for <span className="text-[#39d353] font-bold ml-1">Free</span></span>
                  <span className="text-[#39d353] text-xs">✦</span>
                  <span className="flex items-center gap-1.5 text-[#c8d6ff] text-xs whitespace-nowrap"><Database size={10} className="text-[#2fa4ff]" /> 10,000+ Leads Generated</span>
                  <span className="text-[#2fa4ff] text-xs">✦</span>
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap"><Globe size={10} className="text-[#39d353]" /> 35+ Countries · 120+ Industries</span>
                  <span className="text-[#39d353] text-xs">✦</span>
                  <span className="flex items-center gap-1.5 text-[#c8d6ff] text-xs whitespace-nowrap"><Shield size={10} className="text-[#2fa4ff]" /> No Credit Card Required</span>
                  <span className="text-[#2fa4ff] text-xs">✦</span>
                </span>
              ))}
            </div>
          </div>
          <button onClick={handleDashboardClick} className="banner-arrow hidden sm:inline-flex">
            Try Free <span className="banner-arrow-icon"><ArrowRight size={11} /></span>
          </button>
        </div>

        {/* ══ NAVBAR ══ */}
        <nav className="fixed top-[38px] left-0 right-0 mx-auto flex justify-between items-center px-10 py-4 w-[90%] max-w-[1100px] rounded-[60px] bg-[rgba(7,31,74,0.55)] backdrop-blur-[16px] border border-[rgba(0,170,255,.25)] z-50">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg text-[#39d353]">
            <img src="https://ftisolutions.tech/wp-content/uploads/2025/05/Asset-1.svg" className="w-12 h-12 object-contain" alt="Fatila" />
            Fatila
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {[{ label:"Home", href:"#" },{ label:"Features", href:"#features" },{ label:"How It Works", href:"#how" },{ label:"Pricing", href:"#pricing" }].map(l => (
              <a key={l.label} href={l.href} className="hover:text-[#39d353] transition-colors duration-200 text-sm">{l.label}</a>
            ))}
            <Link href="/contact" className="hover:text-[#39d353] transition-colors duration-200 text-sm">Contact</Link>
            <button onClick={handleDashboardClick} className="hover:text-[#39d353] transition-colors bg-transparent border-none cursor-pointer text-white text-sm">Dashboard</button>
            {!isSignedIn && (
              <>
                <SignInButton><button className="hover:text-[#39d353] transition-colors text-sm">Sign In</button></SignInButton>
                <SignUpButton><button className="px-5 py-1.5 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] font-bold text-sm hover:scale-105 transition-transform duration-200">Sign Up Free</button></SignUpButton>
              </>
            )}
            {isSignedIn && <UserButton />}
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" className={`md:hidden flex flex-col gap-[6px] cursor-pointer bg-transparent border-none p-1 ${menuOpen ? "hb-open" : ""}`}>
            <span className="hb-bar" /><span className="hb-bar" /><span className="hb-bar" />
          </button>
        </nav>

        {/* Mobile Dropdown */}
        <div className={`md:hidden mobile-menu ${menuOpen ? "mobile-menu-open" : "mobile-menu-closed"} fixed top-[86px] right-[5%] w-[210px] z-40 rounded-2xl overflow-hidden border border-[rgba(0,170,255,.3)] bg-[rgba(7,25,65,0.97)] backdrop-blur-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.7)]`}>
          {[{ label:"Home", href:"#" },{ label:"Features", href:"#features" },{ label:"How It Works", href:"#how" },{ label:"Pricing", href:"#pricing" },{ label:"Contact", href:"/contact" }].map(item => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className="block px-6 py-3 text-sm hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all border-b border-[rgba(255,255,255,0.06)]">{item.label}</a>
          ))}
          <button onClick={(e) => { setMenuOpen(false); handleDashboardClick(e); }} className="block w-full text-left px-6 py-3 text-sm text-white hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all border-b border-[rgba(255,255,255,0.06)] bg-transparent border-x-0 border-t-0 cursor-pointer">Dashboard</button>
          {!isSignedIn && (
            <div className="flex flex-col gap-2 p-4 border-t border-[rgba(255,255,255,0.06)]">
              <SignInButton forceRedirectUrl="/dashboard"><button onClick={() => setMenuOpen(false)} className="w-full py-2 rounded-full border border-[rgba(57,211,83,0.45)] text-[#39d353] text-sm hover:bg-[rgba(57,211,83,0.1)] transition-all">Sign In</button></SignInButton>
              <SignUpButton forceRedirectUrl="/dashboard"><button onClick={() => setMenuOpen(false)} className="w-full py-2 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] font-bold text-sm hover:scale-105 transition-transform">Sign Up Free</button></SignUpButton>
            </div>
          )}
          {isSignedIn && <div className="flex items-center gap-3 p-4 border-t border-[rgba(255,255,255,0.06)]"><UserButton /></div>}
        </div>

        {/* ══ HERO ══ */}
        <section className="text-center max-w-[900px] mx-auto relative pt-[210px] pb-[80px] px-5">
          <div className="circuit-circle" />

          <div className="relative z-10 inline-flex items-center gap-2 bg-[rgba(57,211,83,0.07)] border border-[rgba(57,211,83,0.22)] rounded-full px-4 py-1.5 mb-7">
            <Shield size={13} className="text-[#39d353]" />
            <span className="text-[#39d353] text-xs font-bold">AI-Powered Lead Engine</span>
            <span className="text-[rgba(255,255,255,0.2)] text-xs">|</span>
            <span className="text-[#c8d6ff] text-xs">No Credit Card Required</span>
            <span className="text-[rgba(255,255,255,0.2)] text-xs">|</span>
            <span className="text-[#2fa4ff] text-xs font-semibold flex items-center gap-1">Free Trial <ChevronRight size={11} /></span>
          </div>

          <h1 className="relative z-10 text-4xl md:text-6xl font-bold mb-5 min-h-[80px] md:min-h-[140px] bg-clip-text text-transparent bg-gradient-to-r from-[#39d353] to-[#2fa4ff] leading-tight">
            {typedText}<span className="cursor-blink" />
          </h1>

          <p className="relative z-10 text-[#c8d6ff] text-lg md:text-xl mb-3 max-w-[680px] mx-auto leading-relaxed">
            Type any industry + city → Fatila AI instantly finds, scores, and delivers <strong className="text-white">60 verified B2B leads</strong> — names, phones, emails, ratings — ready to contact.
          </p>
          <p className="relative z-10 text-[#9fb8e6] text-sm mb-10 flex items-center justify-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><TrendingUp size={13} className="text-[#39d353]" /> Starts at <strong className="text-[#39d353] ml-1">$12/month</strong></span>
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <span className="flex items-center gap-1"><Globe size={13} /> Used in 35+ countries</span>
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <span className="flex items-center gap-1"><Zap size={13} /> Apollo alternative</span>
          </p>

          <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center items-center mb-5">
            {!isSignedIn ? (
              <>
                <button onClick={handleSignUp} className="cta-btn flex items-center gap-2 px-9 py-3.5 rounded-[40px] font-bold text-base bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none shadow-[0_0_30px_rgba(57,211,83,0.3)]">
                  <Zap size={17} /> Start Free Trial — No Card Needed
                </button>
                <a href="#demo" className="flex items-center gap-2 px-9 py-3.5 rounded-[40px] font-semibold text-base border border-[rgba(57,211,83,0.4)] text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all cursor-pointer">
                  <Play size={15} /> Watch Demo
                </a>
              </>
            ) : (
              <button onClick={handleDashboardClick} className="cta-btn flex items-center gap-2 px-9 py-3.5 rounded-[40px] font-bold text-base bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none">
                <LayoutDashboard size={17} /> Go to Dashboard
              </button>
            )}
          </div>

          <p className="relative z-10 flex items-center justify-center gap-2 text-[#39d353] text-sm font-medium flex-wrap">
            <CheckCircle size={14} /> Free Trial
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <CheckCircle size={14} /> No Credit Card
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <CheckCircle size={14} /> Cancel Anytime
          </p>

          <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-5 text-sm text-[#9fb8e6]">
            <span className="flex items-center gap-1.5">
              {Array(5).fill(0).map((_,i) => <Star key={i} size={13} className="text-[#39d353] fill-[#39d353]" />)}
              <strong className="text-white ml-1">5.0</strong> from early users
            </span>
            <span className="text-[rgba(255,255,255,0.15)]">|</span>
            <span className="flex items-center gap-1.5"><Globe size={13} /> <strong className="text-white">35+</strong> countries</span>
            <span className="text-[rgba(255,255,255,0.15)]">|</span>
            <span className="flex items-center gap-1.5"><Database size={13} /> <strong className="text-white">60 leads</strong> per search</span>
            <span className="text-[rgba(255,255,255,0.15)]">|</span>
            <span className="flex items-center gap-1.5"><Brain size={13} /> <strong className="text-white">AI</strong> scoring</span>
          </div>
        </section>

        {/* ══ DEMO VIDEO ══ */}
        <section id="demo" className="px-5 pb-20 max-w-[860px] mx-auto">
          <div className="text-center mb-8">
            <span className="section-label">Live Demo</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white">See 60 Leads Found in 60 Seconds</h2>
          </div>
          <div className="video-placeholder">
            <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56]" /><span className="w-3 h-3 rounded-full bg-[#ffbd2e]" /><span className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <span className="ml-4 text-xs text-[#9fb8e6] bg-[rgba(255,255,255,0.04)] rounded-full px-3 py-0.5 max-w-[240px]">fatilaai.com/dashboard</span>
            </div>
          <video
  className="w-full rounded-b-[14px]"
  controls
  autoPlay
  muted
  loop
  playsInline
  poster=""
>
  <source src="/videos/demo.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>
          </div>
        </section>

        {/* ══ COUNTERS ══ */}
        <section ref={countersRef} className="grid grid-cols-2 md:grid-cols-4 gap-5 px-6 py-20 text-center max-w-[1000px] mx-auto">
          {[
            { Icon: Database,  val: counts.leads.toLocaleString() + "+",     label: "Leads Generated" },
            { Icon: Building2, val: counts.companies.toLocaleString() + "+", label: "Companies Indexed" },
            { Icon: Layers,    val: counts.industries + "+",                  label: "Industries Covered" },
            { Icon: Globe,     val: counts.countries + "+",                   label: "Countries" },
          ].map(({ Icon, val, label }) => (
            <div key={label} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(57,211,83,0.1)] rounded-2xl py-8 px-4 hover:border-[rgba(57,211,83,0.28)] transition-colors duration-300">
              <Icon size={24} className="text-[#39d353] mx-auto mb-3" />
              <h2 className="text-4xl font-bold text-[#39d353] mb-1">{val}</h2>
              <p className="text-[#c8d6ff] text-sm">{label}</p>
            </div>
          ))}
        </section>

        {/* ══ FEATURES ══ */}
        <section id="features" className="px-5 py-24 max-w-[1200px] mx-auto">
          <div className="text-center mb-14">
            <span className="section-label">What You Get</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything You Need to Close More Deals</h2>
            <p className="text-[#9fb8e6] max-w-[540px] mx-auto">Stop paying for 5 different tools. Fatila AI combines lead discovery, AI scoring, CRM, and automation — all in one platform starting at $12/month.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ Icon, title, desc, badge }) => (
              <div key={title} className="relative bg-[rgba(255,255,255,0.04)] p-7 rounded-2xl border border-[rgba(0,170,255,.15)] hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,.4),0_0_20px_rgba(57,211,83,.15)] hover:border-[rgba(57,211,83,0.45)] transition-all duration-400 group">
                {badge && <span className="absolute top-4 right-4 text-[10px] font-bold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#020c1e] px-2.5 py-0.5 rounded-full">{badge}</span>}
                <div className="w-11 h-11 rounded-xl bg-[rgba(57,211,83,0.09)] border border-[rgba(57,211,83,0.18)] flex items-center justify-center mb-5 group-hover:bg-[rgba(57,211,83,0.16)] transition-colors duration-300">
                  <Icon size={20} className="text-[#39d353]" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-[#9fb8e6] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="px-5 py-24 max-w-[1000px] mx-auto text-center">
          <span className="section-label">Simple 3-Step Process</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Your First 60 Leads in Under 2 Minutes</h2>
          <p className="text-[#9fb8e6] mb-16 max-w-[480px] mx-auto">No complex setup. No training needed. Just type, click, and get verified leads instantly.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-[26px] left-[33%] right-[33%] h-px bg-gradient-to-r from-[#39d353] to-[#2fa4ff] opacity-25" />
            {steps.map(({ Icon, num, title, desc }) => (
              <div key={num} className="flex flex-col items-center group">
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] flex items-center justify-center text-[#081633] mb-5 shadow-[0_0_28px_rgba(57,211,83,0.35)] group-hover:shadow-[0_0_48px_rgba(57,211,83,0.65)] transition-all duration-300">
                  <Icon size={22} />
                </div>
                <span className="text-[#39d353] text-[11px] font-bold uppercase tracking-widest mb-1.5">Step {num}</span>
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-[#9fb8e6] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14">
            {!isSignedIn ? (
              <button onClick={handleSignUp} className="cta-btn inline-flex items-center gap-2 px-9 py-3.5 rounded-[40px] font-bold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none text-base shadow-[0_0_28px_rgba(57,211,83,0.28)]">
                <Zap size={17} /> Try It Free Now — No Card Required
              </button>
            ) : (
              <button onClick={handleDashboardClick} className="cta-btn inline-flex items-center gap-2 px-9 py-3.5 rounded-[40px] font-bold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none text-base">
                <LayoutDashboard size={17} /> Go to Dashboard
              </button>
            )}
            <p className="text-[#9fb8e6] text-sm mt-3 flex items-center justify-center gap-2 flex-wrap">
              <CheckCircle size={13} className="text-[#39d353]" /> Free Trial
              <span className="text-[rgba(255,255,255,0.2)]">·</span>
              <CheckCircle size={13} className="text-[#39d353]" /> Cancel Anytime
              <span className="text-[rgba(255,255,255,0.2)]">·</span>
              <CheckCircle size={13} className="text-[#39d353]" /> Setup in 2 Minutes
            </p>
          </div>
        </section>

        {/* ══ TESTIMONIALS ══ */}
        <section id="testimonials" className="py-24 overflow-hidden">
          <div className="text-center mb-12 px-5">
            <span className="section-label">Real Users, Real Results</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">What Our Users Say</h2>
            <div className="flex justify-center items-center gap-1 mb-2">
              {Array(5).fill(0).map((_,i) => <Star key={i} size={18} className="text-[#39d353] fill-[#39d353]" />)}
            </div>
            <p className="text-[#9fb8e6] text-sm">Loved by sales teams across Pakistan, Saudi Arabia, Jordan & USA</p>
          </div>
          <div className="overflow-hidden" style={{ maskImage:"linear-gradient(to right,transparent,black 8%,black 92%,transparent)" }}>
            <div className="testimonials-track py-2">
              {[...testimonials, ...testimonials].map((t, i) => (
                <div key={i} className="testimonial-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#39d353] to-[#2fa4ff] flex items-center justify-center text-[#020c1e] font-bold text-sm flex-shrink-0">{t.name.charAt(0)}</div>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.name}</p>
                      <p className="text-[#9fb8e6] text-xs flex items-center gap-1"><MapPin size={10} /> {t.location}</p>
                    </div>
                  </div>
                  <p className="text-[#9fb8e6] text-xs mb-2 font-medium">{t.role}</p>
                  <div className="flex gap-0.5 mb-3">{Array(t.stars).fill(0).map((_,j) => <Star key={j} size={12} className="text-[#39d353] fill-[#39d353]" />)}</div>
                  <p className="text-[#cdd9ff] text-sm leading-relaxed">"{t.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ COMPARISON ══ */}
        <section className="px-5 py-20 max-w-[860px] mx-auto">
          <div className="text-center mb-12">
            <span className="section-label">Why Fatila AI?</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Fatila AI vs The Competition</h2>
            <p className="text-[#9fb8e6]">Enterprise-grade lead generation at a fraction of the price.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[rgba(57,211,83,0.18)]">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr className="bg-[rgba(57,211,83,0.06)]">
                  <th className="text-left py-4 px-6 text-[#9fb8e6] text-sm font-semibold">Feature</th>
                  <th className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[#39d353] font-bold text-sm">Fatila AI</span>
                      <span className="text-[10px] bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#020c1e] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Award size={9} /> Best Value</span>
                    </div>
                  </th>
                  <th className="py-4 px-6 text-[#9fb8e6] text-sm font-semibold text-center">Apollo.io</th>
                  <th className="py-4 px-6 text-[#9fb8e6] text-sm font-semibold text-center">Hunter.io</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={`comparison-row border-t border-[rgba(255,255,255,0.04)] ${i%2===0?"bg-[rgba(255,255,255,0.015)]":""}`}>
                    <td className="py-3.5 px-6 text-[#cdd9ff] text-sm">{row.feature}</td>
                    <td className="py-3.5 px-6 text-center text-[#39d353] font-semibold text-sm">{row.fatila}</td>
                    <td className="py-3.5 px-6 text-center text-[#9fb8e6] text-sm">{row.apollo}</td>
                    <td className="py-3.5 px-6 text-center text-[#9fb8e6] text-sm">{row.hunter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══ PRICING ══ */}
        <section id="pricing" className="px-5 py-24 max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <span className="section-label">Simple Pricing</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Start Free. Upgrade When Ready.</h2>
            <p className="text-[#9fb8e6]">No hidden fees. Cancel anytime. All plans include a free trial.</p>
            <div className="inline-flex items-center gap-2 mt-5 bg-[rgba(57,211,83,0.07)] border border-[rgba(57,211,83,0.2)] rounded-full px-5 py-2 text-sm text-[#c8d6ff]">
              <Zap size={14} className="text-[#39d353]" />
              <span>Start with a <strong className="text-[#39d353]">7-day free trial</strong> — 50 leads included, no card required</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {plans.map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.popular ? "pricing-popular" : ""}`} style={{ background: plan.popular ? "rgba(47,164,255,0.09)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${plan.popular ? "#2fa4ff" : "rgba(255,255,255,0.08)"}` }}>
                <div className="mb-1">
                  <h3 className="text-white font-bold text-xl">{plan.name}</h3>
                  <p className="text-[#9fb8e6] text-xs mt-0.5">{plan.targetUsers}</p>
                </div>
                <div className="flex items-end gap-1 my-5">
                  <span className="text-5xl font-bold text-white">${plan.monthlyUSD}</span>
                  <span className="text-[#9fb8e6] text-sm mb-1.5">/mo</span>
                </div>
                <p className="text-[#9fb8e6] text-xs mb-5">≈ PKR {plan.monthlyPKR}/mo</p>
                <div className="flex items-center gap-2 bg-[rgba(59,158,255,0.07)] border border-[rgba(59,158,255,0.15)] rounded-lg px-3 py-2 mb-5 text-xs text-[#9fb8e6]">
                  <Briefcase size={11} className="text-[#3b9eff] flex-shrink-0" />
                  <span>Job Search: <strong className="text-[#3b9eff]">{plan.jobLimit}</strong></span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className={`flex items-center gap-2 text-sm ${f.ok ? "text-[#cdd9ff]" : "text-[#4a5568]"}`}>
                      {f.ok ? <Check size={13} className="text-[#39d353] flex-shrink-0" /> : <X size={13} className="text-[#4a5568] flex-shrink-0" />}
                      {f.text}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={!isSignedIn ? handleSignUp : handleDashboardClick}
                  className={`w-full py-3 rounded-[40px] font-bold text-sm transition-all duration-300 cursor-pointer border-none flex items-center justify-center gap-2 ${plan.popular ? "bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#020c1e] hover:scale-105 shadow-[0_0_24px_rgba(57,211,83,0.35)]" : "bg-[rgba(255,255,255,0.07)] text-white border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.12)]"}`}
                >
                  <Zap size={14} /> Get {plan.name}
                </button>
                <p className="text-center text-[#9fb8e6] text-xs mt-3 flex items-center justify-center gap-1">
                  <Lock size={10} /> No credit card required
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-[#9fb8e6]">
            {[{ Icon: Shield, text:"Secure payment" },{ Icon: Award, text:"7-day money-back guarantee" },{ Icon: X, text:"Cancel anytime" },{ Icon: Clock, text:"Support within 24hrs" }].map(({ Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5"><Icon size={13} className="text-[#39d353]" /> {text}</span>
            ))}
          </div>
        </section>

        {/* ══ FINAL CTA ══ */}
        <section className="px-5 py-28 text-center max-w-[720px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.25)] rounded-full px-4 py-1.5 mb-8">
            <span className="urgency-dot" />
            <span className="text-[#ff6b6b] text-xs font-bold">Limited Free Trial Spots Available</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Start Finding <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#39d353] to-[#2fa4ff]">60 Leads</span> in the Next 2 Minutes
          </h2>
          <p className="text-[#9fb8e6] text-lg mb-10 leading-relaxed">Join businesses across Pakistan, Saudi Arabia, Jordan & USA who are using AI to find verified leads — without spending hours on Google.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isSignedIn ? (
              <>
                <button onClick={handleSignUp} className="cta-btn flex items-center gap-2 px-10 py-4 rounded-[40px] font-bold text-lg bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none shadow-[0_0_40px_rgba(57,211,83,0.35)]">
                  <Zap size={20} /> Start Free — No Card Required
                </button>
                <a href="#demo" className="flex items-center gap-2 text-[#39d353] text-sm font-semibold hover:underline cursor-pointer">
                  <Play size={14} /> Watch demo first
                </a>
              </>
            ) : (
              <button onClick={handleDashboardClick} className="cta-btn flex items-center gap-2 px-10 py-4 rounded-[40px] font-bold text-lg bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none">
                <LayoutDashboard size={20} /> Go to Dashboard
              </button>
            )}
          </div>
          <p className="text-[#9fb8e6] text-sm mt-5 flex items-center justify-center gap-2 flex-wrap">
            <CheckCircle size={13} className="text-[#39d353]" /> Free trial
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <CheckCircle size={13} className="text-[#39d353]" /> Cancel anytime
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <CheckCircle size={13} className="text-[#39d353]" /> 7-day money back guarantee
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {["Pakistan","Saudi Arabia","Jordan","United States","Germany","France"].map(c => (
              <span key={c} className="flex items-center gap-1.5 text-[#9fb8e6] text-xs bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-full">
                <Globe size={10} /> {c}
              </span>
            ))}
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="border-t border-[rgba(255,255,255,0.07)] mt-4 px-6 md:px-10 py-12 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src="https://ftisolutions.tech/wp-content/uploads/2025/05/Asset-1.svg" className="w-10 h-10 object-contain" alt="Fatila" />
                <span className="text-[#39d353] font-semibold text-lg">Fatila</span>
              </div>
              <p className="text-[#9fb8e6] text-sm leading-relaxed">AI Powered Lead Intelligence Engine — Find 60 verified B2B leads in 60 seconds.</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#9fb8e6]">
                <Globe size={11} className="text-[#39d353]" /> Pakistan · Saudi Arabia · Jordan · USA
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Features</a></li>
                <li><a href="#how" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Pricing</a></li>
                <li><Link href="/billing" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Billing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Contact</Link></li>
                <li><a href="https://ftisolutions.tech" target="_blank" rel="noopener noreferrer" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">FTI Solutions</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/refund-policy" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-[rgba(255,255,255,0.05)] text-center text-[#9fb8e6] text-sm">
            © 2026 Fatila — A Fatila Techno Innovations Company. All rights reserved.
          </div>
        </footer>

      </div>
    </div>
  );
}
