"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  LayoutDashboard, Bot, Search, Bookmark,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Menu, X,
} from "lucide-react";

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

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  free:     { label:"Free",         color:"#8899bb" },
  trial:    { label:"Trial",        color:"#ffd700" },
  starter:  { label:"Starter",      color:"#00ff99" },
  pro:      { label:"Professional", color:"#3b9eff" },
  business: { label:"Business",     color:"#a78bfa" },
  expired:  { label:"Expired",      color:"#ff6b6b" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);
  const [dbUser, setDbUser] = useState<any>(null);

  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then(r => r.json())
      .then(setDbUser)
      .catch(console.error);
  }, [email]);

  // Canvas background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const nodes: any[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - .5) * .6, vy: (Math.random() - .5) * .6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff99"; ctx.fill();
      });
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,255,153,${.1 * (1 - d / 120)})`; ctx.stroke();
          }
        }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Close sidebar on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const s = document.getElementById("sidebar");
      if (sidebarActive && s && !s.contains(e.target as Node)) setSidebarActive(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [sidebarActive]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarActive(false);
  }, [pathname]);

  const effectivePlan = dbUser?.effectivePlan || "free";
  const planCfg = PLAN_CONFIG[effectivePlan] || PLAN_CONFIG.free;

  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:-10, pointerEvents:"none" }} />

      {/* Sidebar */}
      <div id="sidebar" className={`sidebar ${sidebarActive ? "active" : ""}`}>
        <div className="sb-logo">
          <div className="logo-dot" />
          <span>Fatila</span>
          {/* Close button inside sidebar — only visible on mobile */}
          <button className="sb-close-btn" onClick={() => setSidebarActive(false)}>
            <X size={18} />
          </button>
        </div>
        <nav>
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon size={15} strokeWidth={1.8} />{label}
            </Link>
          ))}
        </nav>
        <div className="sb-footer">
          <span style={{ color: planCfg.color, fontSize: 11, fontWeight: 700 }}>{planCfg.label} Plan</span>
          <Link href="/billing" className="sb-upgrade">Upgrade</Link>
        </div>
      </div>

      {/* Mobile menu button */}
      <button
        className="menu-btn"
        onClick={(e) => { e.stopPropagation(); setSidebarActive(p => !p); }}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay — closes sidebar on tap outside */}
      {sidebarActive && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarActive(false)}
        />
      )}

      {/* Page content */}
      <div className="page-wrapper">
        {children}
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        /* ── Sidebar ── */
        .sidebar{
          position:fixed;left:0;top:0;
          width:240px;height:100%;
          background:#06102a;
          padding:22px 14px;
          transition:left .3s ease;
          z-index:1000;
          border-right:1px solid rgba(0,255,153,.07);
          display:flex;flex-direction:column;
        }
        .sb-logo{display:flex;align-items:center;gap:9px;margin-bottom:24px;padding:0 4px;color:#00ff99;font-size:17px;font-weight:700;}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#00ff99;box-shadow:0 0 8px #00ff99;flex-shrink:0;}
        nav{display:flex;flex-direction:column;gap:2px;flex:1;}
        nav a{display:flex;align-items:center;gap:9px;color:#8899bb;text-decoration:none;font-size:13px;padding:9px 10px;border-radius:8px;transition:.2s;}
        nav a:hover,nav a.active{color:#00ff99;background:rgba(0,255,153,.08);}
        .sb-footer{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;}
        .sb-upgrade{font-size:11px;color:#00ff99;text-decoration:none;background:rgba(0,255,153,.1);padding:4px 10px;border-radius:20px;border:1px solid rgba(0,255,153,.2);}
        .sb-upgrade:hover{background:rgba(0,255,153,.2);}

        /* ── Mobile menu button ── */
        .menu-btn{
          display:none;
          position:fixed;
          top:14px;left:14px;
          z-index:1200;
          background:#06102a;
          border:1px solid rgba(0,255,153,.2);
          color:white;
          padding:8px 10px;
          border-radius:8px;
          cursor:pointer;
          align-items:center;
          justify-content:center;
          transition:.2s;
        }

        /* ── Close button inside sidebar header ── */
        .sb-close-btn{
          display:none;
          margin-left:auto;
          background:none;
          border:none;
          color:#8899bb;
          cursor:pointer;
          padding:4px;
          border-radius:6px;
          align-items:center;
          justify-content:center;
          transition:.2s;
          flex-shrink:0;
        }
        .sb-close-btn:hover{color:white;background:rgba(255,255,255,.08);}

        /* ── Dark overlay behind sidebar on mobile ── */
        .sidebar-overlay{
          display:none;
          position:fixed;
          inset:0;
          background:rgba(0,0,0,.6);
          z-index:999;
          backdrop-filter:blur(2px);
        }

        /* ── Page wrapper — sits to the right of sidebar on desktop ── */
        .page-wrapper{
          margin-left:240px;
          min-height:100vh;
          position:relative;
          z-index:1;
        }

        /* ── Desktop: keep .main styles working inside page-wrapper ── */
        .main{padding:24px 28px;min-height:100vh;}

        /* ── Mobile ── */
        @media(max-width:900px){
          .menu-btn{display:flex;}
          .sb-close-btn{display:flex;}

          /* Sidebar hidden off-screen left by default */
          .sidebar{left:-260px;}
          .sidebar.active{left:0;box-shadow:4px 0 24px rgba(0,0,0,.5);}

          /* Overlay visible only when sidebar is open */
          .sidebar-overlay{display:block;}

          /* Content takes full width, push down for menu button */
          .page-wrapper{margin-left:0;width:100%;}
          .main{padding:60px 14px 20px;margin-left:0;}
        }

        @media(max-width:600px){
          .main{padding:56px 10px 16px;}
        }
      `}</style>
    </>
  );
}
