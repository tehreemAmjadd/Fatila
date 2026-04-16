"use client";

import { useEffect, useRef, useState } from "react";

export default function CRMIntegrationPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarActive(!sidebarActive);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById("sidebar");
      const menuBtn = document.querySelector(".menu-btn");
      if (
        sidebar &&
        menuBtn &&
        sidebarActive &&
        !sidebar.contains(e.target as Node) &&
        !menuBtn.contains(e.target as Node)
      ) {
        setSidebarActive(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [sidebarActive]);

  // AI background animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
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

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Highlight active sidebar link
  useEffect(() => {
    const sidebarLinks = document.querySelectorAll(".sidebar a");
    const currentPage = window.location.pathname.split("/").pop()?.toLowerCase() || "";
    sidebarLinks.forEach((link) => {
      const linkHref = link.getAttribute("href")?.toLowerCase();
      if (
        (linkHref === "#" && ["", "index.html", "dashboard.html"].includes(currentPage)) ||
        linkHref === currentPage
      ) {
        link.classList.add("active");
      }
    });
  }, []);

  return (
    <>
              <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />

      <canvas id="brainCanvas" ref={canvasRef}></canvas>

      {/* SIDEBAR */}
      <div id="sidebar" className={`sidebar ${sidebarActive ? "active" : ""}`}>
        <h2>Fatila</h2>
 <a href="/dashboard">Dashboard</a>
        <a href="/ai-assistant">AI Assistant</a>
        <a href="/lead-search">Lead Search</a>
        <a href="/saved-leads">Saved Leads</a>
        <a href="/emails">Emails</a>
        <a href="/calls">Calls</a>
        <a href="/tasks">Tasks</a>
        <a href="/export">Export</a>
        <a href="/billing">Billing</a>
        <a href="/crm-integration">CRM Integration</a>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="menu-btn" onClick={toggleSidebar}>
            ☰
          </div>
          <input className="search" placeholder="Search CRMs..." />
        </div>

        <h2 style={{ color: "#00ff99", marginBottom: "20px" }}>CRM Integrations</h2>

        <div className="crm-wrapper">
          <div className="crm-card">
            <h3>Zoho CRM</h3>
            <p className="status not-connected">Not Connected</p>
            <p>Sync leads, contacts, and deals automatically</p>
            <button onClick={() => alert("Connect Zoho CRM backend here")}>Connect</button>
          </div>

          <div className="crm-card">
            <h3>HubSpot</h3>
            <p className="status not-connected">Not Connected</p>
            <p>Integrate with your HubSpot CRM for real-time lead updates</p>
            <button onClick={() => alert("Connect HubSpot backend here")}>Connect</button>
          </div>

          <div className="crm-card">
            <h3>Salesforce</h3>
            <p className="status not-connected">Not Connected</p>
            <p>Push leads directly into Salesforce CRM</p>
            <button onClick={() => alert("Connect Salesforce backend here")}>Connect</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: "Inter", sans-serif;
        }
        body {
          background: #081633;
          color: white;
          overflow-x: hidden;
        }
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 240px;
          height: 100%;
          background: #06102a;
          padding: 30px 20px;
          transition: 0.3s;
        }
        .sidebar h2 {
          color: #00ff99;
          margin-bottom: 40px;
        }
        .sidebar a {
          display: block;
          color: #ccc;
          text-decoration: none;
          margin: 14px 0;
          font-size: 14px;
          transition: 0.3s;
        }
        .sidebar a:hover {
          color: #00ff99;
        }
        .sidebar a.active {
          color: #00ff99;
          font-weight: 600;
        }
        .main {
          margin-left: 240px;
          padding: 20px;
          width: calc(100% - 240px);
          transition: 0.3s;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .menu-btn {
          font-size: 22px;
          cursor: pointer;
          display: none;
        }
        .search {
          background: #0e1b3f;
          padding: 10px 15px;
          border-radius: 8px;
          border: none;
          color: white;
          width: 250px;
        }
        .crm-wrapper {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-top: 20px;
        }
        .crm-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 25px 20px;
          text-align: center;
          transition: 0.3s;
        }
        .crm-card:hover {
          background: rgba(0, 255, 153, 0.1);
          transform: translateY(-5px);
        }
        .crm-card h3 {
          color: #00ff99;
          margin-bottom: 10px;
          font-size: 20px;
        }
        .crm-card p {
          font-size: 14px;
          color: #ccc;
          margin-bottom: 15px;
        }
        .crm-card button {
          padding: 10px 20px;
          border: none;
          border-radius: 25px;
          background: #00ff99;
          color: #081633;
          font-weight: bold;
          cursor: pointer;
          transition: 0.3s;
        }
        .crm-card button:hover {
          background: #00cc66;
        }
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .connected {
          background: #00cc66;
          color: #081633;
        }
        .not-connected {
          background: #ff5555;
          color: white;
        }
        #brainCanvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
        }
        @media (min-width: 900px) {
          .crm-wrapper {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 900px) {
          .menu-btn {
            display: flex;
          }
          .sidebar {
            left: -240px;
          }
          .sidebar.active {
            left: 0;
          }
          .main {
            margin-left: 0;
            width: 100%;
            padding: 15px;
          }
        }
      `}</style>
    </>
  );
}