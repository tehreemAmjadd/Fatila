"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

export default function AnalyticsDashboard() {
  const sourceChartRef = useRef<HTMLCanvasElement | null>(null);
  const growthChartRef = useRef<HTMLCanvasElement | null>(null);
  const conversionChartRef = useRef<HTMLCanvasElement | null>(null);
  const brainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);

  // Toggle sidebar
  const toggleSidebar = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSidebarActive((prev) => !prev);
  };

  // Close sidebar when clicked outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const sidebar = document.getElementById("sidebar");
      const menuBtn = document.getElementById("menuBtn");
      if (
        sidebarActive &&
        sidebar &&
        !sidebar.contains(e.target as Node) &&
        menuBtn &&
        e.target !== menuBtn
      ) {
        setSidebarActive(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [sidebarActive]);

  // Highlight active sidebar link
  useEffect(() => {
    const sidebarLinks = document.querySelectorAll(".sidebar a");
    const currentPage = window.location.pathname.toLowerCase();
    sidebarLinks.forEach((link) => {
      const linkHref = link.getAttribute("href")?.toLowerCase() || "";
      if (currentPage === linkHref) link.classList.add("active");
      else link.classList.remove("active");
    });
  }, []);

  // Charts
  useEffect(() => {
    if (sourceChartRef.current) {
      new Chart(sourceChartRef.current, {
        type: "pie",
        data: {
          labels: ["LinkedIn", "Google", "Referrals", "Cold Emails"],
          datasets: [
            {
              data: [120, 300, 150, 70],
              backgroundColor: ["#00ff99", "#0e1b3f", "#00cc66", "#006633"],
            },
          ],
        },
        options: { maintainAspectRatio: false },
      });
    }

    if (growthChartRef.current) {
      new Chart(growthChartRef.current, {
        type: "line",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
          datasets: [
            {
              label: "New Leads",
              data: [100, 150, 180, 220, 260, 300, 340],
              borderColor: "#00ff99",
              backgroundColor: "rgba(0,255,153,0.2)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: { maintainAspectRatio: false, responsive: true },
      });
    }

    if (conversionChartRef.current) {
      new Chart(conversionChartRef.current, {
        type: "bar",
        data: {
          labels: ["LinkedIn", "Google", "Referrals", "Cold Emails"],
          datasets: [
            {
              label: "Conversion %",
              data: [25, 40, 30, 15],
              backgroundColor: "#00ff99",
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          scales: { y: { beginAtZero: true, max: 100 } },
        },
      });
    }
  }, []);

  // AI background canvas animation
  useEffect(() => {
    const canvas = brainCanvasRef.current;
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

  return (
    <>
     {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      {/* Background Canvas */}
      <canvas
        ref={brainCanvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
      />

       {/* Sidebar */}
      <div id="sidebar" className={`sidebar ${sidebarActive ? "active" : ""}`}>
        <h2>Fatila</h2>
        <a href="/dashboard">Dashboard</a>
        <a href="/ai-assistant">AI Assistant</a>
        <a href="/lead-search">Lead Search</a>
        <a href="/saved-leads">Saved Leads</a>
        <a href="/analytics">Analytics</a>
        <a href="/emails">Emails</a>
        <a href="/calls">Calls</a>
        <a href="/tasks">Tasks</a>
        <a href="/export">Export</a>
        <a href="/billing">Billing</a>
<a href="/meta-ads">🚀 Meta Ads</a>      </div>
      {/* Hamburger */}
      <div id="menuBtn" className="menu-btn" onClick={toggleSidebar}>
        ☰
      </div>

      {/* Main content */}
      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <input className="search" placeholder="Search..." />
        </div>

        {/* Charts */}
        <div className="charts-wrapper">
          <div className="chart-container">
            <h3>Leads by Source</h3>
            <canvas ref={sourceChartRef}></canvas>
          </div>
          <div className="chart-container">
            <h3>Leads Growth (Monthly)</h3>
            <canvas ref={growthChartRef}></canvas>
          </div>
          <div className="chart-container">
            <h3>Lead Conversion Rate</h3>
            <canvas ref={conversionChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { background: #081633; color:white; overflow-x:hidden; position:relative; }

        .sidebar{ position:fixed; left:0; top:0; width:240px; height:100%; background:#06102a; padding:30px 20px; transition:.3s; z-index:1000; }
        .sidebar h2{ color:#00ff99; margin-bottom:40px; }
        .sidebar a{ display:block; color:#ccc; text-decoration:none; margin:14px 0; font-size:14px; }
        .sidebar a:hover, .sidebar a.active { color:#00ff99; font-weight:600; }

        .main{ margin-left:230px; padding:20px; transition:.3s; position:relative; z-index:10; }
        .topbar{ display:flex; justify-content:flex-end; align-items:center; margin-bottom:20px; }
        .menu-btn{ display:none; position:fixed; top:15px; left:15px; font-size:28px; color:white; cursor:pointer; z-index:2000; }
        .search{ background:#0e1b3f; padding:10px 15px; border-radius:8px; border:none; color:white; flex:1; min-width:200px; }

        .charts-wrapper{ display:grid; grid-template-columns:1fr; gap:20px; width:100%; }
        .chart-container{ background: rgba(255,255,255,0.05); border-radius:12px; padding:20px; border:1px solid rgba(255,255,255,0.08); height:300px; display:flex; flex-direction:column; }
        .chart-container h3{ margin-bottom:10px; color:#00ff99; font-size:16px; }

        @media(max-width:900px){
          .main{margin-left:0;}
          .menu-btn{display:block; margin-bottom:15px;}
          .sidebar{left:-230px; position:fixed;}
          .sidebar.active{left:0;}
          .charts-wrapper{grid-template-columns:1fr;}
        }
        @media(min-width:901px){
          .sidebar{left:0;}
          .main{margin-left:230px;}
        }
      `}</style>
    </>
  );
}