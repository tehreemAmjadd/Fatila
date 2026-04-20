"use client";

import { useState, useEffect, useRef } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  /** Auth-aware dashboard navigation */
  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      router.push("/dashboard");
    } else {
      window.location.href = "https://accounts.fatilaai.com/sign-in?redirect_url=https%3A%2F%2Ffatilaai.com%2Fdashboard";
    }
  };

  /** Typing Effect */
  const fullText = "AI Powered Lead Intelligence Engine";
  const [typedText, setTypedText] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  /** Counters */
  const targets = { leads: 10000, companies: 5000, industries: 120, countries: 35 };
  const [counts, setCounts] = useState({ leads: 0, companies: 0, industries: 0, countries: 0 });
  useEffect(() => {
    const increment = () => {
      setCounts((prev) => {
        const newCounts = { ...prev };
        let done = true;
        for (const key in prev) {
          const k = key as keyof typeof prev;
          if (prev[k] < targets[k]) {
            newCounts[k] = Math.min(prev[k] + Math.ceil(targets[k] / 100), targets[k]);
            done = false;
          }
        }
        if (!done) requestAnimationFrame(increment);
        return newCounts;
      });
    };
    increment();
  }, []);

  /** Canvas Background Animation */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const nodes: any[] = [];

    for (let i = 0; i < 80; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff99";
        ctx.fill();
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = "rgba(0,255,153,.15)";
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => window.removeEventListener("resize", resize);
  }, []);

  /** Mobile Menu */
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);

  /** Features */
  const features = [
    { title: "Smart Lead Discovery", desc: "Search businesses by industry, location and keywords." },
    { title: "Google Business Leads", desc: "Extract business contacts from Google listings." },
    { title: "Business Directory Intelligence", desc: "Discover companies from verified public directories." },
    { title: "Automation Workflows", desc: "Leads processed instantly using automation systems." },
    { title: "Real-Time Data", desc: "Instant lead delivery using modern webhook systems." },
    { title: "Export Leads", desc: "Download leads or send them to CRM platforms." },
  ];

  /** How It Works */
  const steps = [
    { num: "01", title: "Define Your Target", desc: "Set your industry, region, and keywords to focus your search." },
    { num: "02", title: "AI Scans Sources", desc: "Our engine crawls Google listings, directories, and public databases." },
    { num: "03", title: "Leads Delivered", desc: "Get enriched, verified contacts instantly — ready for outreach." },
  ];

  return (
    <div className="relative text-white min-h-screen w-full overflow-hidden">

      {/* Hamburger + mobile menu styles */}
      <style>{`
        .hb-bar {
          display: block;
          width: 22px;
          height: 2px;
          background: #ffffff;
          border-radius: 2px;
          transition: transform 0.28s ease, opacity 0.28s ease;
        }
        .hb-open .hb-bar:nth-child(1) { transform: translateY(8px) rotate(45deg); }
        .hb-open .hb-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .hb-open .hb-bar:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

        .mobile-menu {
          transition: opacity 0.25s ease, transform 0.25s ease;
          transform-origin: top right;
        }
        .mobile-menu-closed {
          opacity: 0;
          transform: scale(0.95) translateY(-6px);
          pointer-events: none;
        }
        .mobile-menu-open {
          opacity: 1;
          transform: scale(1) translateY(0);
          pointer-events: all;
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(57,211,83,.45); }
          50%       { box-shadow: 0 0 38px rgba(57,211,83,.8); }
        }
        .cta-btn:hover {
          animation: glowPulse 1.8s ease-in-out infinite;
        }
        .circuit-circle {
          position: absolute;
          top: 60%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 520px;
          height: 520px;
          border-radius: 50%;
          border: 1.5px dashed rgba(57,211,83,0.25);
          pointer-events: none;
          z-index: 0;
        }
        .circuit-circle::before {
          content: '';
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          border: 1px solid rgba(47,164,255,0.18);
          animation: spinCW 18s linear infinite;
          pointer-events: none;
        }
        .circuit-circle::after {
          content: '';
          position: absolute;
          inset: 40px;
          border-radius: 50%;
          border: 1.5px dashed rgba(57,211,83,0.2);
          animation: spinCCW 12s linear infinite;
          pointer-events: none;
        }
        @keyframes spinCW  { to { transform: rotate(360deg);  } }
        @keyframes spinCCW { to { transform: rotate(-360deg); } }
      `}</style>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          pointerEvents: "none",
        }}
      />

      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />

      <div className="relative z-10">

        {/* ── NAVBAR ── */}
        <nav className="fixed top-6 left-0 right-0 mx-auto flex justify-between items-center px-10 py-4 w-[90%] max-w-[1100px] rounded-[60px] bg-[rgba(7,31,74,0.55)] backdrop-blur-[16px] border border-[rgba(0,170,255,.25)] z-50">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg text-[#39d353]">
            <img
              src="https://ftisolutions.tech/wp-content/uploads/2025/05/Asset-1.svg"
              className="w-12 h-12 object-contain"
              alt="Fatila"
            />
            Fatila
          </Link>

          {/* ── Desktop Links (hidden on mobile) ── */}
          <div className="hidden md:flex items-center gap-7">
            <a href="#" className="hover:text-[#39d353] transition-colors duration-200">Home</a>
            <a href="#features" className="hover:text-[#39d353] transition-colors duration-200">Features</a>
            <a href="#how" className="hover:text-[#39d353] transition-colors duration-200">How It Works</a>
            <Link href="/contact" className="hover:text-[#39d353] transition-colors duration-200">Contact</Link>

            {/* ✅ Dashboard link — auth-aware */}
            <button
              onClick={handleDashboardClick}
              className="hover:text-[#39d353] transition-colors duration-200 bg-transparent border-none cursor-pointer text-white"
            >
              Dashboard
            </button>

            {!isSignedIn && (
              <>
                <SignInButton>
                  <button className="hover:text-[#39d353] transition-colors duration-200">Sign In</button>
                </SignInButton>
                <SignUpButton>
                  <button className="px-4 py-1 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] font-semibold hover:scale-105 transition-transform duration-200">
                    Sign Up
                  </button>
                </SignUpButton>
              </>
            )}

            {isSignedIn && (
              <>
                <UserButton />
              </>
            )}
          </div>

          {/* ── Hamburger button (visible on mobile only) ── */}
          <button
            onClick={toggleMenu}
            aria-label="Toggle menu"
            className={`md:hidden flex flex-col gap-[6px] cursor-pointer bg-transparent border-none p-1 ${menuOpen ? "hb-open" : ""}`}
          >
            <span className="hb-bar" />
            <span className="hb-bar" />
            <span className="hb-bar" />
          </button>
        </nav>

        {/* ── Mobile Dropdown (md:hidden) ── */}
        <div
          className={`md:hidden mobile-menu ${menuOpen ? "mobile-menu-open" : "mobile-menu-closed"} fixed top-[86px] right-[5%] w-[210px] z-40 rounded-2xl overflow-hidden border border-[rgba(0,170,255,.3)] bg-[rgba(7,25,65,0.97)] backdrop-blur-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.7)]`}
        >
          {/* Nav links */}
          {[
            { label: "Home", href: "#" },
            { label: "Features", href: "#features" },
            { label: "How It Works", href: "#how" },
            { label: "Contact", href: "/contact" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-3 text-sm hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all duration-200 border-b border-[rgba(255,255,255,0.06)]"
            >
              {item.label}
            </a>
          ))}

          {/* ✅ Dashboard — auth-aware in mobile menu */}
          <button
            onClick={(e) => { setMenuOpen(false); handleDashboardClick(e); }}
            className="block w-full text-left px-6 py-3 text-sm text-white hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all duration-200 border-b border-[rgba(255,255,255,0.06)] bg-transparent border-x-0 border-t-0 cursor-pointer"
          >
            Dashboard
          </button>

          {/* Auth buttons */}
          {!isSignedIn && (
            <div className="flex flex-col gap-2 p-4 border-t border-[rgba(255,255,255,0.06)]">
              <SignInButton forceRedirectUrl="/dashboard">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full py-2 rounded-full border border-[rgba(57,211,83,0.45)] text-[#39d353] text-sm hover:bg-[rgba(57,211,83,0.1)] transition-all duration-200"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/dashboard">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full py-2 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] font-semibold text-sm hover:scale-105 transition-transform duration-200"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          )}

          {isSignedIn && (
            <div className="flex items-center gap-3 p-4 border-t border-[rgba(255,255,255,0.06)]">
              <UserButton />
            </div>
          )}
        </div>

        {/* ── HERO ── */}
        <section className="text-center max-w-[900px] mx-auto relative pt-[260px] pb-[120px] px-5">

          <div className="circuit-circle" />

          <h1 className="relative z-10 text-4xl md:text-6xl mb-5 bg-clip-text text-transparent bg-gradient-to-r from-[#39d353] to-[#2fa4ff]">
            {typedText}
          </h1>

          <p className="relative z-10 text-[#c8d6ff] text-lg mb-10">
            Fatila helps businesses discover high-quality B2B leads using Google Business listings and public company data sources.
          </p>

          {/* ✅ Hero CTA — auth-aware */}
          <button
            onClick={handleDashboardClick}
            className="cta-btn relative z-10 inline-block px-9 py-3 rounded-[40px] font-semibold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none"
          >
            Start Finding Leads
          </button>
        </section>

        {/* ── COUNTERS ── */}
        <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-7 px-10 py-24 text-center">
          <div>
            <h2 className="text-4xl text-[#39d353]">{counts.leads.toLocaleString()}+</h2>
            <p className="text-[#c8d6ff] mt-1">Leads Generated</p>
          </div>
          <div>
            <h2 className="text-4xl text-[#39d353]">{counts.companies.toLocaleString()}+</h2>
            <p className="text-[#c8d6ff] mt-1">Companies Indexed</p>
          </div>
          <div>
            <h2 className="text-4xl text-[#39d353]">{counts.industries}+</h2>
            <p className="text-[#c8d6ff] mt-1">Industries Covered</p>
          </div>
          <div>
            <h2 className="text-4xl text-[#39d353]">{counts.countries}+</h2>
            <p className="text-[#c8d6ff] mt-1">Countries</p>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="px-10 py-24 max-w-[1200px] mx-auto">
          <h2 className="text-3xl md:text-4xl text-center mb-16">
            Platform Features
          </h2>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-7">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-[rgba(255,255,255,0.04)] p-8 rounded-xl border border-[rgba(0,170,255,.2)] hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,.4),0_0_20px_rgba(57,211,83,.25)] hover:border-[#39d353] transition-all duration-500"
              >
                <h3 className="text-[#39d353] mb-2">{f.title}</h3>
                <p className="text-[#cdd9ff] text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how" className="px-10 py-24 max-w-[1000px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl mb-16">How It Works</h2>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-10">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#39d353] to-[#2fa4ff] flex items-center justify-center text-[#081633] font-bold text-lg mb-4 shadow-[0_0_22px_rgba(57,211,83,0.45)]">
                  {step.num}
                </div>
                <h3 className="text-[#39d353] font-semibold mb-2">{step.title}</h3>
                <p className="text-[#cdd9ff] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center py-28 px-5">
          <h2 className="text-3xl mb-5">
            Start Generating Quality Leads
          </h2>
          <p className="text-[#c8d6ff] mb-8">
            Use automation to discover high-value prospects.
          </p>

          {/* ✅ CTA button — auth-aware */}
          <button
            onClick={handleDashboardClick}
            className="cta-btn inline-block px-9 py-3 rounded-[40px] font-semibold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none"
          >
            Launch Platform
          </button>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-[rgba(255,255,255,0.08)] mt-16 px-6 md:px-10 py-12 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="https://ftisolutions.tech/wp-content/uploads/2025/05/Asset-1.svg"
                  className="w-10 h-10 object-contain"
                  alt="Fatila"
                />
                <span className="text-[#39d353] font-semibold text-lg">Fatila</span>
              </div>
              <p className="text-[#9fb8e6] text-sm leading-relaxed">
                AI Powered Lead Intelligence Engine — Discover verified B2B leads globally.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Features</a></li>
                <li><a href="#how" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">How It Works</a></li>
                <li><Link href="/pricing" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Pricing</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Contact</Link></li>
                <li><a href="https://ftisolutions.tech" target="_blank" rel="noopener noreferrer" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Parent Company</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/refund-policy" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[rgba(255,255,255,0.06)] text-center text-[#9fb8e6] text-sm">
            © 2026 Fatila — A Fatila Techno Innovations Company. All rights reserved.
          </div>
        </footer>

      </div>
    </div>
  );
}
