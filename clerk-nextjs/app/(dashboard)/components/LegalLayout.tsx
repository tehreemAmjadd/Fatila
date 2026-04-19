"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { UserButton, useAuth, OrganizationSwitcher } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LegalLayoutProps {
  children: ReactNode;
  title: string;
  lastUpdated?: string;
}

export default function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      router.push("/dashboard");
    } else {
      router.push("/sign-in?redirect_url=/dashboard");
    }
  };

  /** Canvas Background Animation — identical to homepage */
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

  return (
    <div className="relative text-white min-h-screen w-full overflow-hidden">
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

        .legal-content h2 {
          color: #39d353;
          font-size: 1.6rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(57,211,83,0.2);
        }
        .legal-content h3 {
          color: #2fa4ff;
          font-size: 1.2rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .legal-content p {
          color: #cdd9ff;
          margin-bottom: 1rem;
          line-height: 1.75;
        }
        .legal-content ul, .legal-content ol {
          color: #cdd9ff;
          margin-bottom: 1rem;
          padding-left: 1.5rem;
          line-height: 1.75;
        }
        .legal-content ul li { list-style: disc; margin-bottom: 0.4rem; }
        .legal-content ol li { list-style: decimal; margin-bottom: 0.4rem; }
        .legal-content a { color: #39d353; text-decoration: underline; }
        .legal-content a:hover { color: #2fa4ff; }
        .legal-content strong { color: #ffffff; font-weight: 600; }
        .legal-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          overflow: hidden;
        }
        .legal-content th, .legal-content td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid rgba(0,170,255,0.15);
          color: #cdd9ff;
        }
        .legal-content th {
          background: rgba(57,211,83,0.08);
          color: #39d353;
          font-weight: 600;
        }
        .highlight-box {
          background: rgba(57,211,83,0.07);
          border-left: 3px solid #39d353;
          padding: 16px 22px;
          margin: 20px 0;
          border-radius: 6px;
        }
      `}</style>

      {/* Canvas Background */}
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

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-7">
            <Link href="/" className="hover:text-[#39d353] transition-colors duration-200">Home</Link>
            <Link href="/#features" className="hover:text-[#39d353] transition-colors duration-200">Features</Link>
            <Link href="/#how" className="hover:text-[#39d353] transition-colors duration-200">How It Works</Link>

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
                <OrganizationSwitcher />
              </>
            )}
          </div>

          {/* Hamburger */}
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

        {/* Mobile Menu */}
        <div
          className={`md:hidden mobile-menu ${menuOpen ? "mobile-menu-open" : "mobile-menu-closed"} fixed top-[86px] right-[5%] w-[210px] z-40 rounded-2xl overflow-hidden border border-[rgba(0,170,255,.3)] bg-[rgba(7,25,65,0.97)] backdrop-blur-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.7)]`}
        >
          {[
            { label: "Home", href: "/" },
            { label: "Features", href: "/#features" },
            { label: "How It Works", href: "/#how" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-3 text-sm hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all duration-200 border-b border-[rgba(255,255,255,0.06)]"
            >
              {item.label}
            </Link>
          ))}

          <button
            onClick={(e) => { setMenuOpen(false); handleDashboardClick(e); }}
            className="block w-full text-left px-6 py-3 text-sm text-white hover:text-[#39d353] hover:bg-[rgba(57,211,83,0.07)] transition-all duration-200 border-b border-[rgba(255,255,255,0.06)] bg-transparent border-x-0 border-t-0 cursor-pointer"
          >
            Dashboard
          </button>

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
              <OrganizationSwitcher />
            </div>
          )}
        </div>

        {/* ── PAGE CONTENT ── */}
        <section className="pt-[160px] pb-[80px] px-6 md:px-10 max-w-[900px] mx-auto">
          <h1 className="text-4xl md:text-5xl mb-3 bg-clip-text text-transparent bg-gradient-to-r from-[#39d353] to-[#2fa4ff] font-bold">
            {title}
          </h1>
          {lastUpdated && (
            <p className="text-[#9fb8e6] text-sm italic mb-10">
              Last updated: {lastUpdated}
            </p>
          )}
          <div className="legal-content">
            {children}
          </div>
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
                <li><Link href="/#features" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">Features</Link></li>
                <li><Link href="/#how" className="text-[#9fb8e6] hover:text-[#39d353] transition-colors">How It Works</Link></li>
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
