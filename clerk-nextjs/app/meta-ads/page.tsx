"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, Bot, Search, Bookmark, BarChart2,
  Mail, Phone, CheckSquare, Upload, CreditCard, Megaphone,
  Menu, X, Sparkles, Target, Globe, TrendingUp, Lock,
  Copy, Check, Download, Play, RefreshCw, ExternalLink,
  DollarSign, Calendar, Users, Lightbulb, Hash,
  BarChart, Zap, AlertTriangle, Clock, Construction,
  ImagePlus, Smartphone, Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface GeneratedAd {
  campaignName: string;
  objective: string;
  primaryHeadline: string;
  secondaryHeadline: string;
  primaryText: string;
  description: string;
  callToAction: string;
  targetingAge: { min: number; max: number };
  targetingInterests: string[];
  targetingBehaviors: string[];
  targetingLocations: string[];
  adFormats: string[];
  recommendedBudget: number;
  estimatedReachMin: number;
  estimatedReachMax: number;
  estimatedClicksMin: number;
  estimatedClicksMax: number;
  tips: string[];
  hashtagSuggestions: string[];
  alternativeHeadlines: string[];
  alternativePrimaryTexts: string[];
  audienceInsight: string;
  campaignStrategy: string;
}

const OBJECTIVES = [
  { value: "OUTCOME_SALES",     label: "Sales",          desc: "Drive purchases",    Icon: DollarSign },
  { value: "OUTCOME_TRAFFIC",   label: "Traffic",        desc: "Website visitors",   Icon: Globe      },
  { value: "OUTCOME_AWARENESS", label: "Awareness",      desc: "Brand recognition",  Icon: TrendingUp },
  { value: "OUTCOME_LEADS",     label: "Lead Generation",desc: "Collect contacts",   Icon: Target     },
];

const CATEGORIES = [
  "Fashion & Clothing","Electronics","Food & Beverage","Health & Beauty",
  "Home & Decor","Sports & Fitness","Services","Real Estate",
  "Education","Software/App","Jewelry","Automotive","Other",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function MetaAdsPage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sidebarActive, setSidebarActive] = useState(false);
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  // Plan check — use effectivePlan (handles trial/expired correctly)
  const [dbUser, setDbUser] = useState<any>(null);

  // Form state
  const [productDesc, setProductDesc]     = useState("");
  const [productCat, setProductCat]       = useState("");
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState("");
  const [budget, setBudget]               = useState("10");
  const [duration, setDuration]           = useState("7");
  const [location, setLocation]           = useState("Pakistan");
  const [audience, setAudience]           = useState("");
  const [objective, setObjective]         = useState("OUTCOME_SALES");
  const [websiteUrl, setWebsiteUrl]       = useState("");

  // Results
  const [generating, setGenerating]       = useState(false);
  const [generatedAd, setGeneratedAd]     = useState<GeneratedAd | null>(null);
  const [activeSection, setActiveSection] = useState<"form"|"result"|"launch">("form");

  // Meta connect (Part B)
  const [metaConnected, setMetaConnected] = useState(false);
  const [adAccountId, setAdAccountId]     = useState("");
  const [accessToken, setAccessToken]     = useState("");
  const [pageId, setPageId]               = useState("");
  const [launching, setLaunching]         = useState(false);
  const [launchResult, setLaunchResult]   = useState<any>(null);
  const [copied, setCopied]               = useState<string>("");

  // ✅ AI Ad Video generation — 3 styles
  const adCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [adVideoUrls, setAdVideoUrls]         = useState<Record<string,string>>({});
  const [generatingStyle, setGeneratingStyle] = useState<string|null>(null); // which style is rendering
  const [videoProgresses, setVideoProgresses] = useState<Record<string,number>>({});
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<string|null>(null);
  const [mediaType, setMediaType]             = useState<"image"|"video"|"none">("none");

  // compat helpers used in downloadAdVideo / old refs
  const adVideoUrl      = selectedVideoStyle ? (adVideoUrls[selectedVideoStyle] || "") : "";
  const generatingVideo = generatingStyle !== null;
  const videoProgress   = generatingStyle ? (videoProgresses[generatingStyle] || 0) : 0;

  // Canvas
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const nodes: any[] = [];
    for (let i=0;i<80;i++) nodes.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-.5)*.8,vy:(Math.random()-.5)*.8});
    let animId: number;
    const animate = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>canvas.width)n.vx*=-1;if(n.y<0||n.y>canvas.height)n.vy*=-1;ctx.beginPath();ctx.arc(n.x,n.y,2,0,Math.PI*2);ctx.fillStyle="#00ff99";ctx.fill();});
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<130){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle="rgba(0,255,153,.15)";ctx.stroke();}}
      animId=requestAnimationFrame(animate);
    };
    animate();
    return()=>{cancelAnimationFrame(animId);window.removeEventListener("resize",resize);};
  },[]);

  const toggleSidebar=(e:React.MouseEvent)=>{e.stopPropagation();setSidebarActive(p=>!p);};
  useEffect(()=>{
    const h=(e:MouseEvent)=>{const s=document.getElementById("sidebar"),m=document.getElementById("menuBtn");if(sidebarActive&&s&&!s.contains(e.target as Node)&&m&&e.target!==m)setSidebarActive(false);};
    document.addEventListener("click",h);return()=>document.removeEventListener("click",h);
  },[sidebarActive]);

  // Load user plan
  useEffect(() => {
    if (!userEmail) return;
    fetch("/api/get-user",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail})})
    .then(r=>r.json()).then(d=>setDbUser(d)).catch(()=>{});
  },[userEmail]);

  // Image/video upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setAdVideoUrls({}); // reset any previous generated videos
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── VIDEO STYLE CONFIGS ──────────────────────────────────────────────────
  const VIDEO_STYLES = [
    { id: "cinematic", label: "Cinematic",  icon: "🎬", desc: "Dark luxury, Ken Burns, HUD brackets, particle burst" },
    { id: "minimal",   label: "Minimal",    icon: "✨", desc: "Clean white light, elegant typography, smooth fades" },
    { id: "bold",      label: "Bold & Pop", icon: "🔥", desc: "High contrast, color blocks, punchy zoom cuts" },
  ];

  // ── Generate Ad Video for a specific style ────────────────────────────────
  const generateAdVideo = async (style: string) => {
    if (!generatedAd) { alert("Generate AI ad copy first"); return; }

    setGeneratingStyle(style);
    setVideoProgresses(p => ({...p, [style]: 0}));
    setAdVideoUrls(prev => { const n = {...prev}; delete n[style]; return n; });

    const setProgress = (v: number) => setVideoProgresses(p => ({...p, [style]: v}));

    try {
      const W = 1080, H = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      let productImg: HTMLImageElement | null = null;
      if (imagePreview) {
        productImg = await new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = imagePreview;
        });
      }
      setProgress(10);

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
        videoBitsPerSecond: 8_000_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const headline    = generatedAd.primaryHeadline;
      const bodyText    = generatedAd.primaryText;
      const cta         = generatedAd.callToAction.replace(/_/g, " ");
      const hashtags    = (generatedAd.hashtagSuggestions || []).slice(0, 3).join("  ");
      const subHeadline = generatedAd.secondaryHeadline || generatedAd.description || "";
      // ✅ Product-specific scene 4 content (from AI, NOT generic stats)
      const tips = generatedAd.tips || [];
      const interests = generatedAd.targetingInterests || [];
      const scene4Lines = [
        bodyText,
        tips[0] || "",
        tips[1] || "",
      ].filter(Boolean);
      const featureBullets = interests.slice(0, 3).map((t, i) => ({
        icon: ["✨","🎯","💎"][i] || "✦",
        text: t,
      }));

      // Easing
      const easeOutCubic  = (x: number) => 1 - Math.pow(1-x, 3);
      const easeInOutQuad = (x: number) => x < 0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;
      const easeOutBack   = (x: number) => { const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); };
      const easeOutBounce = (x: number) => { const n1=7.5625,d1=2.75; if(x<1/d1)return n1*x*x; if(x<2/d1)return n1*(x-=1.5/d1)*x+0.75; if(x<2.5/d1)return n1*(x-=2.25/d1)*x+0.9375; return n1*(x-=2.625/d1)*x+0.984375; };
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const lerp  = (a: number, b: number, t: number) => a+(b-a)*t;

      const drawImgCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1, panX = 0, panY = 0) => {
        const ir = img.width/img.height, cr = w/h;
        let sw=img.width,sh=img.height,sx=0,sy=0;
        if(ir>cr){sw=img.height*cr;sx=(img.width-sw)/2;}else{sh=img.width/cr;sy=(img.height-sh)/2;}
        const zw=sw/zoom,zh=sh/zoom,zx=sx+(sw-zw)/2+panX*(sw-zw)/2,zy=sy+(sh-zh)/2+panY*(sh-zh)/2;
        ctx.drawImage(img,zx,zy,zw,zh,x,y,w,h);
      };

      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
        ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
      };

      const getLines = (text: string, maxW: number): string[] => {
        const words=text.split(" "),lines: string[]=[]; let cur="";
        for(const w of words){const test=cur?cur+" "+w:w;if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w;}else cur=test;}
        if(cur)lines.push(cur); return lines;
      };

      const drawScanlines = (alpha: number) => {
        ctx.save(); ctx.globalAlpha=alpha;
        for(let y=0;y<H;y+=4){ctx.fillStyle="rgba(0,0,0,0.3)";ctx.fillRect(0,y,W,1);}
        ctx.restore();
      };

      const particles: {x:number;y:number;vx:number;vy:number;life:number;color:string;r:number}[] = [];
      const spawnParticles = (x: number, y: number, count: number, colors: string[]) => {
        for(let i=0;i<count;i++){const a=(Math.PI*2*i)/count+Math.random()*0.5,spd=4+Math.random()*8;particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:1,color:colors[i%colors.length],r:3+Math.random()*5});}
      };
      const updateParticles = () => {
        ctx.save();
        for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.3;p.life-=0.022;if(p.life<=0)continue;ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      };

      const drawOrbs = (elapsed: number, alpha: number, palette = ["rgba(0,255,153,","rgba(24,119,242,","rgba(167,139,250,"]) => {
        ctx.save(); ctx.globalAlpha=alpha;
        for(let i=0;i<6;i++){const ox=W*(0.15+(i*0.17)%0.8),oy=H*0.5+Math.sin(elapsed*0.4+i*1.1)*H*0.25,or=80+Math.sin(elapsed*0.6+i)*20;const og=ctx.createRadialGradient(ox,oy,0,ox,oy,or);og.addColorStop(0,palette[i%3]+"0.14)");og.addColorStop(1,palette[i%3]+"0)");ctx.fillStyle=og;ctx.beginPath();ctx.arc(ox,oy,or,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      };

      const drawStreak = (progress: number, y: number, col: string) => {
        const p=easeOutCubic(clamp(progress,0,1)),x2=W*p;
        const sg=ctx.createLinearGradient(0,0,x2,0);
        const rgba=(c:string,a:number)=>c.replace("rgb(","rgba(").replace(")",`,${a})`);
        sg.addColorStop(0,rgba(col,0.9));sg.addColorStop(0.7,rgba(col,0.5));sg.addColorStop(1,rgba(col,0));
        ctx.fillStyle=sg;ctx.fillRect(0,y,x2,6);
        const tg=ctx.createRadialGradient(x2,y+3,0,x2,y+3,30);
        tg.addColorStop(0,"rgba(255,255,255,0.9)");tg.addColorStop(1,"rgba(255,255,255,0)");
        ctx.fillStyle=tg;ctx.fillRect(x2-30,y-10,60,26);
      };

      // ── Style-specific theme ──────────────────────────────────────────────
      const theme = {
        cinematic: { bg0:"#061228", bg1:"#020817", accent:"#00ff99", accentRgb:"0,255,153", text:"#ffffff", sub:"rgba(200,225,255,0.88)", cta:"#00ff99", ctaText:"#020817" },
        minimal:   { bg0:"#0a0a0a", bg1:"#111111", accent:"#e8e8e8", accentRgb:"232,232,232", text:"#ffffff", sub:"rgba(200,200,200,0.80)", cta:"#ffffff", ctaText:"#111111" },
        bold:      { bg0:"#0a0020", bg1:"#1a0040", accent:"#ff3cac", accentRgb:"255,60,172", text:"#ffffff", sub:"rgba(255,220,255,0.85)", cta:"#ff3cac", ctaText:"#ffffff" },
      }[style] || { bg0:"#061228", bg1:"#020817", accent:"#00ff99", accentRgb:"0,255,153", text:"#ffffff", sub:"rgba(200,225,255,0.88)", cta:"#00ff99", ctaText:"#020817" };

      const TOTAL_FRAMES = 300, FPS = 30;
      const sp = {s1:false,s5:false};
      recorder.start(); setProgress(15);

      for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
        const elapsed = frame/FPS;
        ctx.clearRect(0,0,W,H);

        // ══ SCENE 1 (0–59): Intro ════════════════════════════════════════
        if (frame < 60) {
          const sc=frame/60;
          // BG
          if (style === "minimal") {
            ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,W,H);
            // elegant thin lines
            ctx.save(); ctx.globalAlpha=clamp(sc*2,0,0.08); ctx.strokeStyle="#ffffff"; ctx.lineWidth=0.5;
            for(let gx=0;gx<=W;gx+=80){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
            for(let gy=0;gy<=H;gy+=80){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
            ctx.restore();
          } else if (style === "bold") {
            // Split color block BG
            const p=easeOutCubic(clamp(sc*3,0,1));
            ctx.fillStyle="#1a0040"; ctx.fillRect(0,0,W,H);
            ctx.fillStyle="#ff3cac"; ctx.fillRect(0,0,W*0.5*p,H);
            ctx.fillStyle="#7928ca"; ctx.fillRect(W*0.5*p,0,W*(0.5-0.5*p),H);
          } else {
            const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.9);
            bg.addColorStop(0,"#061228"); bg.addColorStop(1,"#020817");
            ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
            drawOrbs(elapsed,0.5);
            ctx.save(); ctx.globalAlpha=clamp(sc*3,0,0.12); ctx.strokeStyle="#00ff99"; ctx.lineWidth=1;
            for(let gx=0;gx<=W;gx+=120){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
            for(let gy=0;gy<=H;gy+=120){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
            ctx.restore();
          }

          drawStreak(sc*2,8,`rgb(${theme.accentRgb})`);
          drawStreak(sc*2-0.1,H-14,`rgb(${theme.accentRgb})`);

          // Circle or cross
          if (style === "bold") {
            // Big X reveal
            const xProg=easeOutBack(clamp(sc*2,0,1))*400;
            ctx.save(); ctx.globalAlpha=clamp(sc*3,0,0.4); ctx.strokeStyle="#ffffff"; ctx.lineWidth=8;
            ctx.beginPath(); ctx.moveTo(W/2-xProg,H/2-xProg); ctx.lineTo(W/2+xProg,H/2+xProg); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W/2+xProg,H/2-xProg); ctx.lineTo(W/2-xProg,H/2+xProg); ctx.stroke();
            ctx.restore();
          } else {
            const cr=easeOutBack(clamp(sc*1.5,0,1))*120;
            ctx.save(); ctx.globalAlpha=clamp(sc*2,0,1);
            const cg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,cr);
            cg.addColorStop(0,`rgba(${theme.accentRgb},0.2)`); cg.addColorStop(1,`rgba(${theme.accentRgb},0)`);
            ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(W/2,H/2,cr,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle=theme.accent; ctx.lineWidth=3; ctx.globalAlpha=clamp(sc*2,0,1)*0.7;
            ctx.beginPath(); ctx.arc(W/2,H/2,cr,0,Math.PI*2*clamp(sc*2,0,1)); ctx.stroke();
            ctx.restore();
          }

          // Brand text
          const ba=easeOutCubic(clamp((sc-0.3)*3,0,1));
          if(ba>0){
            ctx.save(); ctx.globalAlpha=ba; ctx.textAlign="center";
            ctx.shadowColor=theme.accent; ctx.shadowBlur=style==="bold"?0:30;
            ctx.fillStyle=theme.accent; ctx.font="bold 28px Arial";
            ctx.fillText(style==="bold"?"🔥 HIGH IMPACT AD":"POWERED BY AI",W/2,H/2-20);
            ctx.shadowBlur=0; ctx.fillStyle=theme.text; ctx.font="900 72px Arial";
            ctx.fillText("AD CAMPAIGN",W/2,H/2+50);
            ctx.fillStyle=`rgba(${theme.accentRgb},0.5)`; ctx.font="300 24px Arial";
            ctx.fillText("Facebook  ·  Instagram  ·  Reels",W/2,H/2+96);
            ctx.restore();
          }

          // HUD corners (cinematic/bold only)
          if(style!=="minimal"){
            ctx.save(); ctx.globalAlpha=clamp(sc*4,0,0.6); ctx.strokeStyle=theme.accent; ctx.lineWidth=4;
            [[40,40,1,1],[W-40,40,-1,1],[40,H-40,1,-1],[W-40,H-40,-1,-1]].forEach(([bx,by,dx,dy])=>{ctx.beginPath();ctx.moveTo(bx,by+dy*50);ctx.lineTo(bx,by);ctx.lineTo(bx+dx*50,by);ctx.stroke();});
            ctx.restore();
          }

          if(!sp.s1){spawnParticles(W/2,H/2,18,[theme.accent,"#fff",`rgb(${theme.accentRgb})`]);sp.s1=true;}
          updateParticles();
          if(style==="cinematic") drawScanlines(0.04);
        }

        // ══ SCENE 2 (60–119): Product hero ═══════════════════════════════
        else if (frame < 120) {
          const sc=(frame-60)/60;
          ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H);

          if(productImg){
            const zoom=lerp(1.0,1.08,easeInOutQuad(sc));
            const wipe=easeOutCubic(clamp(sc*2,0,1));
            ctx.save();
            if(style==="bold"){
              // Diagonal wipe
              ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W*wipe*1.2,0); ctx.lineTo(W*wipe*1.2-200,H); ctx.lineTo(0,H); ctx.closePath(); ctx.clip();
            } else {
              ctx.beginPath(); ctx.rect(0,0,W*wipe,H); ctx.clip();
            }
            drawImgCover(productImg,0,0,W,H,zoom,lerp(0,-0.04,easeInOutQuad(sc)),lerp(0,0.02,easeInOutQuad(sc)));
            const bH=style==="minimal"?0:H*0.08, bAlpha=easeOutCubic(clamp(sc*3,0,1));
            if(bH>0){ctx.globalAlpha=bAlpha;ctx.fillStyle="#000";ctx.fillRect(0,0,W,bH);ctx.fillRect(0,H-bH,W,bH);}
            ctx.restore();
            // Vignette / overlay
            ctx.save(); ctx.globalAlpha=style==="minimal"?0.3:0.55;
            const vig=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.75);
            vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.85)");
            ctx.fillStyle=vig; ctx.fillRect(0,0,W,H); ctx.restore();
            // Style-specific overlay tint
            if(style==="bold"){ctx.save();ctx.globalAlpha=0.18;ctx.fillStyle=`rgba(${theme.accentRgb},1)`;ctx.fillRect(0,0,W,H);ctx.restore();}
          }

          // "INTRODUCING" pill
          const la=easeOutCubic(clamp((sc-0.2)*4,0,1));
          const lY=lerp(-80,120,easeOutBack(clamp((sc-0.2)*3,0,1)));
          ctx.save(); ctx.globalAlpha=la; ctx.textAlign="center";
          ctx.fillStyle=`rgba(${theme.accentRgb},0.22)`;
          roundRect(W/2-160,lY-36,320,48,24); ctx.fill();
          ctx.strokeStyle=`rgba(${theme.accentRgb},0.6)`; ctx.lineWidth=1.5;
          roundRect(W/2-160,lY-36,320,48,24); ctx.stroke();
          ctx.fillStyle=theme.accent; ctx.font="700 22px Arial";
          ctx.fillText(style==="bold"?"🔥  NEW DROP  🔥":"✦  INTRODUCING  ✦",W/2,lY);
          ctx.restore();

          // Headline — typed or instant per style
          const na=easeOutCubic(clamp((sc-0.35)*4,0,1));
          const nY=lerp(H+60,H*0.72,easeOutBack(clamp((sc-0.35)*3,0,1)));
          const headlineShown=style==="bold"?headline:headline.slice(0,Math.floor(headline.length*clamp((sc-0.4)*4,0,1)));
          ctx.save(); ctx.globalAlpha=na; ctx.textAlign="center";
          if(style==="bold"){ctx.shadowColor=theme.accent;ctx.shadowBlur=30;}else{ctx.shadowColor="rgba(0,0,0,0.8)";ctx.shadowBlur=20;}
          ctx.fillStyle=theme.text; ctx.font="900 62px Arial";
          ctx.fillText(headlineShown,W/2,nY);
          ctx.restore();

          drawStreak(clamp((sc-0.05)*6,0,1),0,`rgb(${theme.accentRgb})`);
          if(style==="cinematic") drawScanlines(0.03);
        }

        // ══ SCENE 3 (120–179): Split layout ══════════════════════════════
        else if (frame < 180) {
          const sc=(frame-120)/60;
          ctx.fillStyle=style==="minimal"?"#111111":style==="bold"?"#0d0030":"#04102b";
          ctx.fillRect(0,0,W,H);
          if(style!=="bold") drawOrbs(elapsed,0.3,style==="minimal"?["rgba(255,255,255,","rgba(200,200,200,","rgba(180,180,200,"]:undefined);

          const split=easeOutCubic(clamp(sc*2,0,1)), imgW=W*0.48*split;
          if(productImg&&imgW>10){
            ctx.save();
            if(style==="bold"){
              // Bold: image clips with angled cut
              ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(imgW+80,0); ctx.lineTo(imgW-40,H); ctx.lineTo(0,H); ctx.closePath(); ctx.clip();
            } else {
              roundRect(0,0,imgW,H,0); ctx.clip();
            }
            drawImgCover(productImg,0,0,imgW,H,1.05+sc*0.03);
            const lo=ctx.createLinearGradient(imgW-150,0,imgW,0);
            lo.addColorStop(0,`rgba(${style==="bold"?"13,0,48":"4,16,43"},0)`);
            lo.addColorStop(1,`rgba(${style==="bold"?"13,0,48":"4,16,43"},0.92)`);
            ctx.fillStyle=lo; ctx.fillRect(0,0,imgW,H); ctx.restore();
            // Separator
            ctx.save(); ctx.globalAlpha=split;
            const sg=ctx.createLinearGradient(imgW,0,imgW,H);
            sg.addColorStop(0,`rgba(${theme.accentRgb},0)`); sg.addColorStop(0.2,`rgba(${theme.accentRgb},0.9)`);
            sg.addColorStop(0.8,`rgba(${theme.accentRgb},0.9)`); sg.addColorStop(1,`rgba(${theme.accentRgb},0)`);
            ctx.fillStyle=sg; ctx.fillRect(imgW-2,0,3,H); ctx.restore();
          }

          const rX=W*0.52, rW=W*0.44;
          const lp=clamp((sc-0.2)*3,0,1);
          if(lp>0){
            ctx.save(); ctx.globalAlpha=easeOutCubic(lp);
            ctx.fillStyle=`rgba(${theme.accentRgb},0.15)`;
            roundRect(rX,180,200,36,8); ctx.fill();
            ctx.fillStyle=theme.accent; ctx.font="700 16px Arial"; ctx.textAlign="left";
            ctx.fillText("✦ HEADLINE",rX+14,204); ctx.restore();
          }

          // Headline drop-in
          ctx.font="bold 58px Arial";
          getLines(headline,rW).slice(0,3).forEach((line,i)=>{
            const lp2=clamp((sc-0.25-i*0.12)*4,0,1); if(lp2<=0)return;
            const lY=290+i*72+lerp(40,0,easeOutBack(lp2));
            ctx.save(); ctx.globalAlpha=easeOutCubic(lp2);
            ctx.shadowColor=`rgba(${theme.accentRgb},0.5)`; ctx.shadowBlur=style==="bold"?25:18;
            ctx.fillStyle=theme.text; ctx.font="bold 58px Arial"; ctx.textAlign="left";
            ctx.fillText(line,rX,lY); ctx.restore();
          });

          // Divider
          const dp=clamp((sc-0.5)*3,0,1);
          if(dp>0){
            const dg=ctx.createLinearGradient(rX,0,rX+rW*dp,0);
            dg.addColorStop(0,theme.accent); dg.addColorStop(1,`rgba(${theme.accentRgb},0.1)`);
            ctx.fillStyle=dg; ctx.fillRect(rX,430,rW*dp,3);
          }

          // Sub text
          const sp2v=clamp((sc-0.55)*3.5,0,1);
          if(sp2v>0){
            ctx.save(); ctx.globalAlpha=easeOutCubic(sp2v); ctx.font="400 30px Arial"; ctx.textAlign="left";
            ctx.fillStyle=theme.sub;
            getLines(subHeadline||bodyText.slice(0,70),rW).slice(0,2).forEach((l,i)=>ctx.fillText(l,rX,500+i*42));
            ctx.restore();
          }

          drawStreak(sc*4,0,`rgb(${theme.accentRgb})`);
          if(style==="cinematic") drawScanlines(0.025);
        }

        // ══ SCENE 4 (180–239): ✅ PRODUCT CONTENT — no generic stats ════
        else if (frame < 240) {
          const sc=(frame-180)/60;
          const bg4=ctx.createLinearGradient(0,0,W,H);
          if(style==="minimal"){bg4.addColorStop(0,"#0d0d0d");bg4.addColorStop(1,"#161616");}
          else if(style==="bold"){bg4.addColorStop(0,"#0d0030");bg4.addColorStop(1,"#1a0050");}
          else{bg4.addColorStop(0,"#020c1e");bg4.addColorStop(1,"#04102b");}
          ctx.fillStyle=bg4; ctx.fillRect(0,0,W,H);

          if(productImg){
            ctx.save(); ctx.globalAlpha=0.1;
            drawImgCover(productImg,0,H*0.5,W,H*0.5,1.15);
            const fg=ctx.createLinearGradient(0,H*0.48,0,H);
            fg.addColorStop(0,style==="minimal"?"#0d0d0d":style==="bold"?"#0d0030":"#020c1e");
            fg.addColorStop(0.4,style==="minimal"?"rgba(13,13,13,0)":style==="bold"?"rgba(13,0,48,0)":"rgba(2,12,30,0)");
            fg.addColorStop(1,style==="minimal"?"#0d0d0d":style==="bold"?"#0d0030":"#020c1e");
            ctx.globalAlpha=1; ctx.fillStyle=fg; ctx.fillRect(0,H*0.48,W,H*0.52); ctx.restore();
          }

          if(style!=="bold") drawOrbs(elapsed,0.2,style==="minimal"?["rgba(255,255,255,","rgba(200,200,200,","rgba(180,180,200,"]:undefined);

          // ✅ "ABOUT THIS PRODUCT" badge (product-relevant)
          const bp=easeOutBack(clamp(sc*3,0,1));
          ctx.save(); ctx.globalAlpha=clamp(sc*3,0,1);
          const bdW=300, bdH=44;
          const bdg=ctx.createLinearGradient(W/2-bdW/2,78,W/2+bdW/2,78);
          bdg.addColorStop(0,`rgba(${theme.accentRgb},0.22)`); bdg.addColorStop(1,`rgba(${theme.accentRgb},0.08)`);
          ctx.fillStyle=bdg; ctx.save(); ctx.translate(W/2,100); ctx.scale(bp,bp); ctx.translate(-W/2,-100);
          roundRect(W/2-bdW/2,78,bdW,bdH,22); ctx.fill();
          ctx.strokeStyle=`rgba(${theme.accentRgb},0.5)`; ctx.lineWidth=1.5;
          roundRect(W/2-bdW/2,78,bdW,bdH,22); ctx.stroke();
          ctx.restore();
          ctx.textAlign="center"; ctx.fillStyle=theme.accent; ctx.font="700 20px Arial";
          ctx.fillText("✦  ABOUT THIS PRODUCT  ✦",W/2,107); ctx.restore();

          // ✅ Product body text typed (from AI — real product description)
          const tp=clamp((sc-0.15)*2.5,0,1);
          if(tp>0){
            ctx.save(); ctx.font="400 34px Arial"; ctx.textAlign="center";
            getLines(bodyText,W-180).slice(0,2).forEach((line,i)=>{
              const lp=clamp((tp-i*0.22)*3,0,1); if(lp<=0)return;
              const chars=Math.floor(line.length*lp), lY=210+i*56;
              ctx.shadowColor=`rgba(${theme.accentRgb},0.25)`; ctx.shadowBlur=6;
              ctx.fillStyle=theme.text; ctx.font="400 34px Arial";
              ctx.fillText(line.slice(0,chars),W/2,lY);
              if(lp<1){const tw=ctx.measureText(line.slice(0,chars)).width;ctx.fillStyle=theme.accent;ctx.fillRect(W/2+tw/2+2,lY-28,3,36);}
              ctx.shadowBlur=0;
            });
            ctx.restore();
          }

          // ✅ Product interest/feature bullets (from AI targeting interests)
          featureBullets.forEach((f,i)=>{
            const fp=easeOutBack(clamp((sc-0.35-i*0.12)*3.5,0,1)); if(fp<=0)return;
            const rowY=350+i*100, rowH=80;
            ctx.save(); ctx.translate(W/2,rowY+rowH/2); ctx.scale(fp,1); ctx.translate(-W/2,-(rowY+rowH/2));
            ctx.globalAlpha=clamp((sc-0.35-i*0.12)*4,0,1);
            // Row bg pill
            const rg=ctx.createLinearGradient(80,rowY,W-80,rowY+rowH);
            rg.addColorStop(0,`rgba(${theme.accentRgb},0.08)`); rg.addColorStop(1,`rgba(${theme.accentRgb},0.02)`);
            ctx.fillStyle=rg; roundRect(80,rowY,W-160,rowH,20); ctx.fill();
            ctx.strokeStyle=i===1?`rgba(${theme.accentRgb},0.45)`:`rgba(${theme.accentRgb},0.15)`; ctx.lineWidth=1.5;
            roundRect(80,rowY,W-160,rowH,20); ctx.stroke();
            // Icon circle
            const icR=26, icX=140, icY=rowY+rowH/2;
            ctx.fillStyle=`rgba(${theme.accentRgb},0.18)`; ctx.beginPath(); ctx.arc(icX,icY,icR,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=theme.accent; ctx.font="24px Arial"; ctx.textAlign="center"; ctx.fillText(f.icon,icX,icY+8);
            // Text
            ctx.fillStyle=theme.text; ctx.font="500 30px Arial"; ctx.textAlign="left";
            // Truncate if too long
            let ft=f.text; while(ctx.measureText(ft).width>W-260&&ft.length>0)ft=ft.slice(0,-1);
            if(ft!==f.text)ft+="...";
            ctx.fillText(ft,185,rowY+rowH/2+10);
            ctx.restore();
          });

          // ✅ AI Tip from generatedAd.tips (product-specific!)
          const tipProg=clamp((sc-0.72)*5,0,1);
          if(tipProg>0 && tips[0]){
            ctx.save(); ctx.globalAlpha=easeOutCubic(tipProg);
            ctx.textAlign="center"; ctx.font="italic 24px Arial";
            ctx.fillStyle=`rgba(${theme.accentRgb},0.65)`;
            const tipLine=tips[0].length>70?tips[0].slice(0,67)+"...":tips[0];
            ctx.fillText("💡 "+tipLine,W/2,H-55); ctx.restore();
          }

          drawStreak(clamp(sc*5,0,1),0,`rgb(${theme.accentRgb})`);
          if(style==="cinematic") drawScanlines(0.02);
          updateParticles();
        }

        // ══ SCENE 5 (240–299): CTA explosion + outro ═════════════════════
        else {
          const sc=(frame-240)/60;
          const bg7=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.85);
          if(style==="minimal"){bg7.addColorStop(0,"#161616");bg7.addColorStop(1,"#0a0a0a");}
          else if(style==="bold"){bg7.addColorStop(0,"#1a0050");bg7.addColorStop(1,"#0a0028");}
          else{bg7.addColorStop(0,"#061830");bg7.addColorStop(1,"#020817");}
          ctx.fillStyle=bg7; ctx.fillRect(0,0,W,H);

          if(productImg){
            ctx.save(); ctx.globalAlpha=style==="minimal"?0.15:0.22+Math.sin(sc*Math.PI)*0.05;
            drawImgCover(productImg,0,0,W,H,1.05+sc*0.02);
            ctx.globalAlpha=style==="bold"?0.5:0.65; ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,H);
            ctx.restore();
          }
          if(style!=="bold") drawOrbs(elapsed,0.5,style==="minimal"?["rgba(255,255,255,","rgba(200,200,200,","rgba(180,180,200,"]:undefined);
          if(!sp.s5){spawnParticles(W/2,H/2,32,[theme.accent,"#ffd700","#fff",`rgba(${theme.accentRgb},0.8)`]);sp.s5=true;}
          updateParticles();

          // Headline
          const hp=easeOutBack(clamp(sc*4,0,1));
          ctx.save(); ctx.globalAlpha=clamp(sc*5,0,1); ctx.textAlign="center";
          ctx.shadowColor=theme.accent; ctx.shadowBlur=style==="bold"?50:35;
          ctx.fillStyle=theme.text; ctx.font="900 68px Arial";
          getLines(headline,W-120).forEach((l,i)=>ctx.fillText(l,W/2,220+i*80+lerp(60,0,hp)));
          ctx.shadowBlur=0; ctx.restore();

          drawStreak(clamp(sc*8,0,1),0,`rgb(${theme.accentRgb})`);
          drawStreak(clamp(sc*8-0.1,0,1),H-8,`rgb(${theme.accentRgb})`);

          // CTA button
          const bp2=easeOutBounce(clamp((sc-0.2)*2.5,0,1));
          const bPulse=1+Math.sin(elapsed*5)*0.025;
          const bW=500,bH=90,bX=W/2-250,bY=H/2+100;
          ctx.save();
          ctx.translate(W/2,bY+bH/2); ctx.scale(bp2*bPulse,bp2*bPulse); ctx.translate(-W/2,-(bY+bH/2));
          ctx.globalAlpha=clamp((sc-0.2)*4,0,1);
          const halo=ctx.createRadialGradient(W/2,bY+bH/2,0,W/2,bY+bH/2,160);
          halo.addColorStop(0,`rgba(${theme.accentRgb},0.3)`); halo.addColorStop(1,`rgba(${theme.accentRgb},0)`);
          ctx.fillStyle=halo; ctx.fillRect(bX-80,bY-60,bW+160,bH+120);
          // Button
          if(style==="minimal"){
            ctx.fillStyle="#ffffff"; roundRect(bX,bY,bW,bH,45); ctx.fill();
            ctx.strokeStyle=theme.accent; ctx.lineWidth=3; roundRect(bX,bY,bW,bH,45); ctx.stroke();
          } else if(style==="bold"){
            const bg5=ctx.createLinearGradient(bX,bY,bX+bW,bY+bH);
            bg5.addColorStop(0,"#ff3cac"); bg5.addColorStop(0.5,"#8a2be2"); bg5.addColorStop(1,"#ff3cac");
            ctx.fillStyle=bg5; roundRect(bX,bY,bW,bH,45); ctx.fill();
          } else {
            const bg6=ctx.createLinearGradient(bX,bY,bX+bW,bY+bH);
            bg6.addColorStop(0,"#00ff99"); bg6.addColorStop(0.5,"#00e87a"); bg6.addColorStop(1,"#00cc66");
            ctx.fillStyle=bg6; roundRect(bX,bY,bW,bH,45); ctx.fill();
          }
          // Shimmer
          const shimX=((elapsed*0.5)%1.4-0.2)*(bW+200);
          const sg2=ctx.createLinearGradient(bX+shimX-80,0,bX+shimX+80,0);
          sg2.addColorStop(0,"rgba(255,255,255,0)");sg2.addColorStop(0.5,"rgba(255,255,255,0.3)");sg2.addColorStop(1,"rgba(255,255,255,0)");
          ctx.save(); roundRect(bX,bY,bW,bH,45); ctx.clip(); ctx.fillStyle=sg2; ctx.fillRect(bX,bY,bW,bH); ctx.restore();
          ctx.fillStyle=theme.ctaText; ctx.font="900 36px Arial"; ctx.textAlign="center";
          ctx.shadowColor="rgba(0,0,0,0.3)"; ctx.shadowBlur=4;
          ctx.fillText("👉  "+cta,W/2,bY+57); ctx.restore();

          // Bouncing arrows
          const ap=clamp((sc-0.5)*4,0,1);
          if(ap>0){[0,14,28].forEach((off,i)=>{const b=Math.sin(elapsed*4+i*0.8)*6;ctx.save();ctx.globalAlpha=ap*(0.4+0.3*Math.sin(elapsed*3+i));ctx.fillStyle=theme.accent;ctx.font="bold 28px Arial";ctx.textAlign="center";ctx.fillText("▼",W/2,bY+bH+42+off+b);ctx.restore();});}

          // Hashtags
          const tp3=easeOutCubic(clamp((sc-0.65)*4,0,1));
          if(tp3>0&&hashtags){ctx.save();ctx.globalAlpha=tp3;ctx.textAlign="center";ctx.fillStyle=`rgba(${theme.accentRgb},0.65)`;ctx.font="italic 28px Arial";const ty=lerp(H+40,H-52,easeOutCubic(tp3));ctx.fillText(hashtags,W/2,ty);ctx.restore();}

          // HUD corners
          if(style!=="minimal"){
            ctx.save(); ctx.globalAlpha=clamp(sc*5,0,0.5); ctx.strokeStyle=theme.accent; ctx.lineWidth=3;
            [[30,30,1,1],[W-30,30,-1,1],[30,H-30,1,-1],[W-30,H-30,-1,-1]].forEach(([bx,by,dx,dy])=>{ctx.beginPath();ctx.moveTo(bx,by+dy*40);ctx.lineTo(bx,by);ctx.lineTo(bx+dx*40,by);ctx.stroke();});
            ctx.restore();
          }
          if(style==="cinematic") drawScanlines(0.03);

          // Fade out
          if(frame>=290){ctx.save();ctx.globalAlpha=(frame-290)/10;ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);ctx.restore();}
        }

        await new Promise(r => setTimeout(r, 1000/FPS));
        if(frame%20===0) setProgress(15+Math.round((frame/TOTAL_FRAMES)*78));
      }

      recorder.stop(); setProgress(96);
      await new Promise<void>(res => { recorder.onstop = () => res(); });
      const url = URL.createObjectURL(new Blob(chunks, {type:"video/webm"}));
      setAdVideoUrls(prev => ({...prev, [style]: url}));
      setSelectedVideoStyle(style);
      setProgress(100);

    } catch (err: any) {
      console.error("Video error:", err);
      alert("Video generation failed: " + err.message);
    } finally {
      setGeneratingStyle(null);
    }
  };

  const downloadAdVideo = (style?: string) => {
    const s = style || selectedVideoStyle || "";
    const url = adVideoUrls[s];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedAd?.campaignName || "meta-ad"}-${s}.webm`;
    a.click();
  };

  // ── Part A: Generate AI Ad Copy ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!productDesc.trim()) { alert("Please describe your product"); return; }
    setGenerating(true);
    try {
      const res  = await fetch("/api/meta-ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDescription: productDesc,
          productCategory:    productCat,
          budget, duration,
          targetLocation:     location,
          targetAudience:     audience,
          objective,
          userEmail,
        }),
      });
      const data = await res.json();
      if (data.ad) {
        setGeneratedAd(data.ad);
        setActiveSection("result");
      } else {
        alert(data.error || "Generation failed");
      }
    } catch(err:any){ alert("Error: " + err.message); }
    finally{ setGenerating(false); }
  };

  // ── Part B: Launch Real Meta Ad ──────────────────────────────────────────
  const handleLaunchAd = async () => {
    if (!adAccountId || !accessToken) {
      alert("Please enter your Meta Ad Account ID and Access Token");
      return;
    }
    if (!generatedAd) return;
    setLaunching(true);
    try {
      const res  = await fetch("/api/meta-ads/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:           userEmail,
          adAccountId,
          accessToken,
          campaignName:    generatedAd.campaignName,
          objective:       generatedAd.objective,
          primaryText:     generatedAd.primaryText,
          headline:        generatedAd.primaryHeadline,
          callToAction:    generatedAd.callToAction,
          imageUrl:        imagePreview || null,
          dailyBudget:     Number(budget),
          durationDays:    Number(duration),
          targetLocations: [location],
          targetInterests: generatedAd.targetingInterests,
          targetAgeMin:    generatedAd.targetingAge.min,
          targetAgeMax:    generatedAd.targetingAge.max,
          websiteUrl,
        }),
      });
      const data = await res.json();
      setLaunchResult(data);
    } catch(err:any){ alert("Launch error: " + err.message); }
    finally{ setLaunching(false); }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(()=>setCopied(""),2000);
  };

  const effectivePlan = dbUser?.effectivePlan || "free";
  const isPaid = ["pro","business","starter","trial"].includes(effectivePlan);
  const planColor = effectivePlan==="business"?"#a78bfa":effectivePlan==="pro"?"#3b9eff":effectivePlan==="trial"?"#ffd700":"#00ff99";

  const fmtNum = (n: number) => n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-[#020817] via-[#04102b] to-[#02060f] z-[-20]" />
      <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:-10,pointerEvents:"none"}} />

      {/* Sidebar */}
      <div id="sidebar" className={`sidebar ${sidebarActive?"active":""}`}>
        <div className="sb-logo"><div className="logo-dot"/><span>Fatila</span></div>
        <nav>
          {[
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
          ].map(({href,label,Icon})=>(
            <a key={href} href={href} className={href==="/meta-ads"?"active":""}>
              <Icon size={15} strokeWidth={1.8}/>{label}
            </a>
          ))}
        </nav>
        <div className="sb-footer">
          <span style={{color:planColor,fontSize:11,fontWeight:700}}>
            {effectivePlan.charAt(0).toUpperCase()+effectivePlan.slice(1)} Plan
          </span>
          {!isPaid&&<a href="/billing" className="sb-upgrade">Upgrade</a>}
        </div>
      </div>
      <button className="menu-btn" onClick={(e)=>{e.stopPropagation();setSidebarActive(p=>!p);}}>
        {sidebarActive?<X size={20}/>:<Menu size={20}/>}
      </button>

      <div className="main">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Meta Ads Manager</h1>
            <p>AI-powered Facebook & Instagram ad campaigns for your products</p>
          </div>
          <div className="header-badges">
            <span className="badge-fb"><Globe size={12}/>Facebook</span>
            <span className="badge-ig"><Smartphone size={12}/>Instagram</span>
            <span className={`plan-badge ${isPaid?"paid":"free"}`}>
              {isPaid ? <><Check size={12}/>Active</> : <><Lock size={12}/>Paid Feature</>}
            </span>
          </div>
        </div>

        {/* Plan gate */}
        {!isPaid && (
          <div className="plan-gate">
            <div className="gate-content">
              <div className="gate-icon-wrap"><Lock size={32} strokeWidth={1.4} color="#8899bb"/></div>
              <h2>Meta Ads is a Paid Feature</h2>
              <p>Upgrade to Starter, Pro, or Business to access AI-powered Meta Ad generation and campaign launching.</p>
              <div className="gate-features">
                <div className="gate-feat"><Sparkles size={13} color="#00ff99"/>AI writes your ad copy</div>
                <div className="gate-feat"><Target size={13} color="#00ff99"/>Smart audience targeting</div>
                <div className="gate-feat"><BarChart size={13} color="#00ff99"/>Reach & click estimates</div>
                <div className="gate-feat"><Megaphone size={13} color="#00ff99"/>Direct campaign launch</div>
                <div className="gate-feat"><Smartphone size={13} color="#00ff99"/>Facebook + Instagram ads</div>
                <div className="gate-feat"><DollarSign size={13} color="#00ff99"/>Budget optimization</div>
              </div>
              <a href="/billing" className="upgrade-btn"><CreditCard size={15}/>Upgrade Now — Starting $12/mo</a>
            </div>
          </div>
        )}

        {isPaid && (
          <>
            {/* ── Under Development Banner ── */}
            <div className="dev-banner">
              <div className="dev-banner-left">
                <Construction size={22} color="#ffa500" className="dev-icon"/>
                <div>
                  <strong>Auto-Launch Under Development</strong>
                  <p>AI ad copy generation is fully available. Direct Meta ad launching is coming soon.</p>
                </div>
              </div>
              <span className="dev-badge">Coming Soon</span>
            </div>

            {/* Step tabs */}
            <div className="steps-row">
              {[
                {id:"form",   label:"1. Product Info", Icon:Info},
                {id:"result", label:"2. AI Ad Copy",   Icon:Sparkles},
                {id:"launch", label:"3. Launch Ad",    Icon:Megaphone},
              ].map(step=>(
                <button
                  key={step.id}
                  className={`step-btn ${activeSection===step.id?"active":""} ${step.id==="result"&&!generatedAd?"disabled":""}`}
                  onClick={()=>{ if(step.id==="result"&&!generatedAd) return; setActiveSection(step.id as any); }}
                >
                  <step.Icon size={14} strokeWidth={1.8}/>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            {/* ══ STEP 1: FORM ══ */}
            {activeSection==="form" && (
              <div className="form-layout">
                <div className="form-main">
                  <div className="form-card">
                    <h2><Info size={18} color="#00ff99" strokeWidth={1.8}/>Product Information</h2>

                    {/* Image upload */}
                    <div className="upload-area" onClick={()=>document.getElementById("imgInput")?.click()}>
                      {imagePreview ? (
                        <img src={imagePreview} alt="product" className="preview-img" />
                      ) : (
                        <div className="upload-placeholder">
                          <ImagePlus size={36} color="#8899bb" strokeWidth={1.2}/>
                          <p>Click to upload product image or video</p>
                          <span className="upload-hint">JPG, PNG, MP4 — Max 50MB</span>
                        </div>
                      )}
                      <input id="imgInput" type="file" accept="image/*,video/*" hidden onChange={handleImageUpload} />
                    </div>
                    {imagePreview && (
                      <button className="remove-img" onClick={()=>{setImageFile(null);setImagePreview("");}}>
                        <X size={13}/>Remove Image
                      </button>
                    )}

                    <div className="field-group">
                      <label>Product Description *</label>
                      <textarea
                        value={productDesc}
                        onChange={e=>setProductDesc(e.target.value)}
                        placeholder="Describe your product in detail — what it is, what problem it solves, who it's for, what makes it special..."
                        rows={5}
                      />
                      <span className="char-count">{productDesc.length} chars</span>
                    </div>

                    <div className="fields-grid">
                      <div className="field-group">
                        <label>Product Category</label>
                        <select value={productCat} onChange={e=>setProductCat(e.target.value)}>
                          <option value="">Select category...</option>
                          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Target Location</label>
                        <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Pakistan, UAE, USA" />
                      </div>
                      <div className="field-group">
                        <label>Daily Budget (USD)</label>
                        <div className="input-with-icon">
                          <span>$</span>
                          <input type="number" value={budget} onChange={e=>setBudget(e.target.value)} min="1" />
                        </div>
                      </div>
                      <div className="field-group">
                        <label>Duration (days)</label>
                        <input type="number" value={duration} onChange={e=>setDuration(e.target.value)} min="1" max="90" />
                      </div>
                      <div className="field-group">
                        <label>Target Audience</label>
                        <input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="e.g. women 25-40, business owners" />
                      </div>
                      <div className="field-group">
                        <label>Your Website URL</label>
                        <input value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://yourstore.com" />
                      </div>
                    </div>

                    {/* Objective */}
                    <div className="field-group">
                      <label>Campaign Objective</label>
                      <div className="objective-grid">
                        {OBJECTIVES.map(obj=>(
                          <div
                            key={obj.value}
                            className={`objective-card ${objective===obj.value?"selected":""}`}
                            onClick={()=>setObjective(obj.value)}
                          >
                            <obj.Icon size={16} strokeWidth={1.8} color={objective===obj.value?"#00ff99":"#8899bb"}/>
                            <span className="obj-label">{obj.label}</span>
                            <span className="obj-desc">{obj.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
                      {generating ? <><span className="spinner"/> Generating AI Ad...</> : <><Sparkles size={15}/>Generate AI Ad Campaign</>}
                    </button>
                  </div>
                </div>

                {/* Sidebar info */}
                <div className="form-sidebar">
                  <div className="info-card">
                    <h3><Lightbulb size={13} color="#00ff99"/>How It Works</h3>
                    <div className="how-steps">
                      <div className="how-step"><span className="how-num">1</span><span>Upload your product image & describe it</span></div>
                      <div className="how-step"><span className="how-num">2</span><span>AI generates complete ad copy & targeting</span></div>
                      <div className="how-step"><span className="how-num">3</span><span>Review and copy the ad content</span></div>
                      <div className="how-step"><span className="how-num">4</span><span>Connect Meta account to launch directly</span></div>
                    </div>
                  </div>
                  <div className="info-card">
                    <h3><Check size={13} color="#00ff99"/>What AI Generates</h3>
                    <ul className="ai-list">
                      {["Ad headline & body text","Target audience & interests","Age & location targeting","Budget recommendations","Reach & click estimates","Hashtag suggestions","5 alternative headlines","Campaign strategy"].map(i=>(
                        <li key={i}><span className="check"><Check size={11} color="#00ff99"/></span>{i}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="total-cost-card">
                    <h3><DollarSign size={13} color="#00ff99"/>Estimated Total Cost</h3>
                    <div className="cost-breakdown">
                      <div className="cost-row"><span>Daily Budget</span><span>${budget}/day</span></div>
                      <div className="cost-row"><span>Duration</span><span>{duration} days</span></div>
                      <div className="cost-row total"><span>Total Ad Spend</span><span>${(Number(budget)*Number(duration)).toFixed(0)}</span></div>
                    </div>
                    <p className="cost-note">* Ad spend goes directly to Meta. LeadVision charges your subscription only.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ══ STEP 2: AI RESULT ══ */}
            {activeSection==="result" && generatedAd && (
              <div className="result-layout">

                {/* Estimated reach */}
                <div className="reach-banner">
                  <div className="reach-item">
                    <span className="reach-val">{fmtNum(generatedAd.estimatedReachMin)}–{fmtNum(generatedAd.estimatedReachMax)}</span>
                    <span className="reach-lbl">Estimated Daily Reach</span>
                  </div>
                  <div className="reach-item">
                    <span className="reach-val">{fmtNum(generatedAd.estimatedClicksMin)}–{fmtNum(generatedAd.estimatedClicksMax)}</span>
                    <span className="reach-lbl">Estimated Daily Clicks</span>
                  </div>
                  <div className="reach-item">
                    <span className="reach-val">${budget}/day</span>
                    <span className="reach-lbl">Daily Budget</span>
                  </div>
                  <div className="reach-item">
                    <span className="reach-val">{duration} days</span>
                    <span className="reach-lbl">Duration</span>
                  </div>
                </div>

                <div className="result-grid">
                  {/* Ad Preview */}
                  <div className="ad-preview-card">
                    <h3><Smartphone size={14} color="#00ff99"/>Ad Preview</h3>
                    <div className="fb-ad-mock">
                      <div className="fb-header">
                        <div className="fb-avatar">P</div>
                        <div>
                          <div className="fb-page">Your Page Name</div>
                          <div className="fb-sponsored">Sponsored · <Globe size={11}/></div>
                        </div>
                      </div>
                      <div className="fb-text">{generatedAd.primaryText}</div>
                      {imagePreview && <img src={imagePreview} alt="ad" className="fb-img" />}
                      {!imagePreview && <div className="fb-img-placeholder"><ImagePlus size={24} color="#8899bb"/>Your product image here</div>}
                      <div className="fb-bottom">
                        <div className="fb-headline-block">
                          <div className="fb-headline">{generatedAd.primaryHeadline}</div>
                          <div className="fb-desc">{generatedAd.description}</div>
                        </div>
                        <button className="fb-cta">{generatedAd.callToAction.replace(/_/g," ")}</button>
                      </div>
                    </div>
                  </div>

                  {/* Ad Copy */}
                  <div className="copy-cards">
                    <div className="copy-card">
                      <div className="copy-header">
                        <span><Target size={13} color="#00ff99"/>Primary Headline</span>
                        <button className="copy-btn" onClick={()=>copyText(generatedAd.primaryHeadline,"h1")}>
                          {copied==="h1"?<><Check size={12}/>Copied!</>:<><Copy size={12}/>Copy</>}
                        </button>
                      </div>
                      <p className="copy-text">{generatedAd.primaryHeadline}</p>
                    </div>

                    <div className="copy-card">
                      <div className="copy-header">
                        <span><Sparkles size={13} color="#00ff99"/>Ad Body Text</span>
                        <button className="copy-btn" onClick={()=>copyText(generatedAd.primaryText,"body")}>
                          {copied==="body"?<><Check size={12}/>Copied!</>:<><Copy size={12}/>Copy</>}
                        </button>
                      </div>
                      <p className="copy-text">{generatedAd.primaryText}</p>
                    </div>

                    <div className="copy-card">
                      <div className="copy-header">
                        <span><RefreshCw size={13} color="#00ff99"/>Alternative Headlines</span>
                      </div>
                      {generatedAd.alternativeHeadlines.map((h,i)=>(
                        <div key={i} className="alt-item">
                          <span>{h}</span>
                          <button className="copy-btn sm" onClick={()=>copyText(h,`alt${i}`)}>
                            {copied===`alt${i}`?<Check size={12}/>:<Copy size={12}/>}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="copy-card">
                      <div className="copy-header"><span><Hash size={13} color="#00ff99"/>Hashtags</span></div>
                      <div className="hashtags">
                        {generatedAd.hashtagSuggestions.map(h=>(
                          <span key={h} className="hashtag">{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Targeting */}
                <div className="targeting-section">
                  <h3><Target size={15} color="#00ff99"/>Recommended Targeting</h3>
                  <div className="targeting-grid">
                    <div className="targeting-card">
                      <h4><Users size={13}/>Age Range</h4>
                      <p>{generatedAd.targetingAge.min} – {generatedAd.targetingAge.max} years</p>
                    </div>
                    <div className="targeting-card">
                      <h4><Sparkles size={13}/>Interests</h4>
                      <div className="interest-tags">
                        {generatedAd.targetingInterests.map(i=><span key={i} className="interest-tag">{i}</span>)}
                      </div>
                    </div>
                    <div className="targeting-card">
                      <h4><Lightbulb size={13}/>Audience Insight</h4>
                      <p className="insight-text">{generatedAd.audienceInsight}</p>
                    </div>
                    <div className="targeting-card">
                      <h4><BarChart size={13}/>Strategy</h4>
                      <p className="insight-text">{generatedAd.campaignStrategy}</p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="tips-section">
                  <h3><Lightbulb size={15} color="#00ff99"/>AI Tips for Better Results</h3>
                  <div className="tips-grid">
                    {generatedAd.tips.map((tip,i)=>(
                      <div key={i} className="tip-card">
                        <span className="tip-num">{i+1}</span>
                        <p>{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ✅ AI Ad Video Creator — 3 styles */}
                <div className="ad-video-section">
                  <div className="ad-video-header">
                    <div>
                      <h3><Play size={15} color="#00ff99"/>AI Ad Video Creator</h3>
                      <p>Generate up to 3 different video styles — pick your favourite to download</p>
                    </div>
                  </div>

                  {!imagePreview ? (
                    <div className="video-no-image">
                      <ImagePlus size={32} color="#8899bb" strokeWidth={1.2}/>
                      <p>Go back and upload a product image to generate your ad videos</p>
                      <button className="back-btn" style={{marginTop:"8px"}} onClick={()=>setActiveSection("form")}>← Upload Image</button>
                    </div>
                  ) : (
                    <>
                      {/* 3 style cards */}
                      <div className="video-styles-grid">
                        {VIDEO_STYLES.map(vs => {
                          const isRendering = generatingStyle === vs.id;
                          const isDone      = !!adVideoUrls[vs.id];
                          const isSelected  = selectedVideoStyle === vs.id;
                          const prog        = videoProgresses[vs.id] || 0;
                          return (
                            <div key={vs.id} className={`vs-card ${isSelected && isDone ? "selected" : ""}`}>
                              <div className="vs-card-top">
                                <span className="vs-label">{vs.icon} {vs.label}</span>
                                {isDone && <span className="vs-done-badge"><Check size={11}/>Ready</span>}
                                {isRendering && <span className="vs-rendering-badge"><Clock size={11}/>Rendering…</span>}
                              </div>
                              <p className="vs-desc">{vs.desc}</p>

                              {/* Preview thumbnail */}
                              <div className="vs-thumb-wrap">
                                {isDone && adVideoUrls[vs.id] ? (
                                  <video
                                    src={adVideoUrls[vs.id]}
                                    muted loop autoPlay
                                    className={`vs-thumb-video ${isSelected ? "active" : ""}`}
                                    onClick={() => setSelectedVideoStyle(vs.id)}
                                  />
                                ) : (
                                  <div className={`vs-thumb-placeholder ${vs.id}`}>
                                    <img src={imagePreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.35}} />
                                    <div className="vs-thumb-overlay">
                                      <span className="vs-thumb-icon">{vs.icon}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Progress bar while rendering */}
                              {isRendering && (
                                <div className="vs-progress-wrap">
                                  <div className="vs-progress-track">
                                    <div className="vs-progress-fill" style={{width:`${prog}%`}} />
                                  </div>
                                  <span className="vs-progress-label">{prog}% — rendering frames…</span>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="vs-actions">
                                {!isDone && !isRendering && (
                                  <button
                                    className="vs-gen-btn"
                                    onClick={() => generateAdVideo(vs.id)}
                                    disabled={generatingStyle !== null}
                                  >
                                    {generatingStyle !== null && generatingStyle !== vs.id
                                      ? <><Clock size={12}/>Wait…</>
                                      : <><Play size={12}/>Generate</>}
                                  </button>
                                )}
                                {isDone && (
                                  <>
                                    <button className="vs-select-btn" onClick={() => setSelectedVideoStyle(vs.id)}>
                                      {isSelected ? <><Check size={12}/>Selected</> : <><Play size={12}/>Preview</>}
                                    </button>
                                    <button className="vs-download-btn" onClick={() => downloadAdVideo(vs.id)}>
                                      <Download size={12}/>Download
                                    </button>
                                    <button className="vs-regen-btn" onClick={() => generateAdVideo(vs.id)} disabled={generatingStyle !== null}>
                                      <RefreshCw size={13}/>
                                    </button>
                                  </>
                                )}
                                {isRendering && (
                                  <button className="vs-gen-btn" disabled style={{opacity:0.5}}>
                                    <span className="spinner" style={{width:"12px",height:"12px",borderTopColor:"#020817",borderColor:"rgba(2,8,23,0.3)"}} /> Rendering…
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Full preview of selected video */}
                      {selectedVideoStyle && adVideoUrls[selectedVideoStyle] && (
                        <div className="vs-full-preview">
                          <div className="vs-full-header">
                            <h4><Play size={14} color="#00ff99"/>Full Preview — {VIDEO_STYLES.find(v=>v.id===selectedVideoStyle)?.label}</h4>
                            <button className="download-video-btn" onClick={() => downloadAdVideo(selectedVideoStyle)}>
                              <Download size={14}/>Download Video (.webm)
                            </button>
                          </div>
                          <video
                            key={selectedVideoStyle}
                            src={adVideoUrls[selectedVideoStyle]}
                            controls autoPlay loop muted
                            className="ad-video-player"
                          />
                          <p className="video-format-note">
                            <Info size={11}/> .webm works directly on Meta Ads Manager. Convert to .mp4 free at{" "}
                            <a href="https://cloudconvert.com" target="_blank" rel="noreferrer">cloudconvert.com</a>
                          </p>
                        </div>
                      )}

                      {/* Generate all button */}
                      {Object.keys(adVideoUrls).length < 3 && !generatingStyle && (
                        <button
                          className="gen-all-btn"
                          onClick={async () => {
                            for (const vs of VIDEO_STYLES) {
                              if (!adVideoUrls[vs.id]) await generateAdVideo(vs.id);
                            }
                          }}
                        >
                          <Play size={14}/>Generate All 3 Styles
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="result-actions">
                  <button className="back-btn" onClick={()=>setActiveSection("form")}>← Edit Product Info</button>
                  <button className="next-btn" onClick={()=>setActiveSection("launch")}><Megaphone size={14}/>Launch This Ad →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 3: LAUNCH ══ */}
            {activeSection==="launch" && (
              <div className="launch-layout">

                {/* Part A: Manual copy */}
                <div className="launch-card">
                  <div className="launch-badge part-a">Part A — Free Option</div>
                  <h2><Copy size={16} color="#00ff99"/>Copy to Meta Ads Manager</h2>
                  <p className="launch-desc">No API setup needed. Copy your AI-generated ad content and paste it manually into Meta Ads Manager.</p>

                  <div className="manual-steps">
                    <div className="manual-step">
                      <span className="step-num">1</span>
                      <div>
                        <strong>Open Meta Ads Manager</strong>
                        <a href="https://adsmanager.facebook.com/adsmanager/creation" target="_blank" rel="noreferrer" className="open-link">
                          <ExternalLink size={12}/>Open Ads Manager
                        </a>
                      </div>
                    </div>
                    <div className="manual-step">
                      <span className="step-num">2</span>
                      <div>
                        <strong>Create Campaign</strong>
                        <p>Objective: <code>{generatedAd?.objective}</code></p>
                      </div>
                    </div>
                    <div className="manual-step">
                      <span className="step-num">3</span>
                      <div>
                        <strong>Ad Set Settings</strong>
                        <p>Budget: <code>${budget}/day</code> · Duration: <code>{duration} days</code></p>
                        <p>Locations: <code>{location}</code> · Age: <code>{generatedAd?.targetingAge.min}-{generatedAd?.targetingAge.max}</code></p>
                      </div>
                    </div>
                    <div className="manual-step">
                      <span className="step-num">4</span>
                      <div>
                        <strong>Ad Creative — Copy these:</strong>
                        {generatedAd && (
                          <div className="copy-fields">
                            {[
                              {label:"Headline",    value:generatedAd.primaryHeadline, key:"lh"},
                              {label:"Body Text",   value:generatedAd.primaryText,     key:"lb"},
                              {label:"Description", value:generatedAd.description,     key:"ld"},
                              {label:"CTA Button",  value:generatedAd.callToAction.replace(/_/g," "), key:"lc"},
                            ].map(f=>(
                              <div key={f.key} className="copy-field-row">
                                <div>
                                  <span className="cf-label">{f.label}</span>
                                  <span className="cf-value">{f.value}</span>
                                </div>
                                <button className="copy-btn" onClick={()=>copyText(f.value,f.key)}>
                                  {copied===f.key?<Check size={12}/>:<Copy size={12}/>}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Part B: API launch */}
                <div className="launch-card api-card">
                  <div className="launch-badge part-b">Part B — Auto Launch (API)</div>
                  <h2><Megaphone size={16} color="#1877f2"/>Direct API Launch</h2>
                  <p className="launch-desc">Connect your Meta Ad Account to launch campaigns directly from Fatila — no copy-pasting needed.</p>

                  <div className="setup-warning">
                    <h4><AlertTriangle size={13} color="#ffd700"/>One-time Setup Required</h4>
                    <ol>
                      <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a> → Create App</li>
                      <li>Add <strong>Marketing API</strong> product → Request Advanced Access</li>
                      <li>Get your <strong>Ad Account ID</strong> from <a href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer">Ads Manager</a></li>
                      <li>Generate a <strong>System User Access Token</strong> with <code>ads_management</code> permission</li>
                      <li>Add to your <code>.env</code>: <code>META_APP_ID</code> and <code>META_APP_SECRET</code></li>
                    </ol>
                  </div>

                  <div className="api-fields">
                    <div className="field-group">
                      <label>Ad Account ID</label>
                      <input
                        value={adAccountId}
                        onChange={e=>setAdAccountId(e.target.value)}
                        placeholder="e.g. 1234567890 (from Ads Manager)"
                      />
                    </div>
                    <div className="field-group">
                      <label>Access Token</label>
                      <input
                        type="password"
                        value={accessToken}
                        onChange={e=>setAccessToken(e.target.value)}
                        placeholder="Your Meta System User Access Token"
                      />
                    </div>
                    <div className="field-group">
                      <label>Facebook Page ID</label>
                      <input
                        value={pageId}
                        onChange={e=>setPageId(e.target.value)}
                        placeholder="Your Facebook Page ID"
                      />
                    </div>
                  </div>

                  {launchResult ? (
                    <div className={`launch-result ${launchResult.success?"success":"error"}`}>
                      {launchResult.success ? (
                        <>
                          <h3><Check size={16} color="#00ff99"/>Ad Campaign Created!</h3>
                          <p>{launchResult.message}</p>
                          <p>Campaign ID: <code>{launchResult.campaignId}</code></p>
                          <a href={launchResult.reviewUrl} target="_blank" rel="noreferrer" className="review-link">
                            <ExternalLink size={13}/>Review in Meta Ads Manager
                          </a>
                        </>
                      ) : (
                        <>
                          <h3><AlertTriangle size={16} color="#ff4d4d"/>Launch Failed</h3>
                          <p>{launchResult.error}</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="coming-soon-block">
                      <div className="cs-icon"><Construction size={36} color="#ffa500" strokeWidth={1.4}/></div>
                      <h3>Auto-Launch Coming Soon</h3>
                      <p>We are currently getting Meta API approval. Once approved, you will be able to launch ads directly from here with one click.</p>
                      <div className="cs-steps">
                        <div className="cs-step done"><Check size={13}/>AI Ad Copy Generation</div>
                        <div className="cs-step done"><Check size={13}/>Audience Targeting</div>
                        <div className="cs-step done"><Check size={13}/>Manual Copy to Meta Ads Manager</div>
                        <div className="cs-step pending"><Clock size={13}/>Direct Auto-Launch (Pending Meta Approval)</div>
                      </div>
                      <a href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer" className="manual-ads-link">
                        <ExternalLink size={13}/>Use Manual Method: Open Meta Ads Manager
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { color:white; overflow-x:hidden; }
        .sidebar { position:fixed; left:0; top:0; width:240px; height:100%; background:#06102a; padding:22px 14px; transition:.3s; z-index:1000; border-right:1px solid rgba(0,255,153,.07); display:flex; flex-direction:column; }
        .sb-logo { display:flex; align-items:center; gap:9px; margin-bottom:24px; padding:0 4px; color:#00ff99; font-size:17px; font-weight:700; }
        .logo-dot { width:8px; height:8px; border-radius:50%; background:#00ff99; box-shadow:0 0 8px #00ff99; }
        nav { display:flex; flex-direction:column; gap:2px; flex:1; }
        nav a { display:flex; align-items:center; gap:9px; color:#8899bb; text-decoration:none; font-size:13px; padding:9px 10px; border-radius:8px; transition:.2s; }
        nav a:hover, nav a.active { color:#00ff99; background:rgba(0,255,153,.08); }
        .sb-footer { border-top:1px solid rgba(255,255,255,.06); padding-top:12px; display:flex; align-items:center; justify-content:space-between; }
        .sb-upgrade { font-size:11px; background:rgba(0,255,153,.1); color:#00ff99; border:1px solid rgba(0,255,153,.25); padding:3px 10px; border-radius:20px; text-decoration:none; }
        .menu-btn { display:none; position:fixed; top:15px; left:15px; z-index:1100; background:#06102a; border:1px solid rgba(0,255,153,.15); color:white; padding:8px 10px; border-radius:8px; cursor:pointer; }
        .main { margin-left:240px; padding:24px 28px; min-height:100vh; }

        .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
        .page-header h1 { font-size:24px; font-weight:700; }
        .page-header p { color:#8899bb; font-size:13px; margin-top:3px; }
        .header-badges { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .badge-fb { display:flex; align-items:center; gap:5px; background:rgba(24,119,242,0.15); color:#1877f2; border:1px solid rgba(24,119,242,0.3); padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600; }
        .badge-ig { display:flex; align-items:center; gap:5px; background:rgba(225,48,108,0.12); color:#e1306c; border:1px solid rgba(225,48,108,0.3); padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600; }
        .plan-badge { display:flex; align-items:center; gap:5px; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600; }
        .plan-badge.paid { background:rgba(0,255,153,0.1); color:#00ff99; border:1px solid rgba(0,255,153,0.3); }
        .plan-badge.free { background:rgba(255,77,77,0.1); color:#ff4d4d; border:1px solid rgba(255,77,77,0.2); }

        /* Plan gate */
        .plan-gate { display:flex; justify-content:center; align-items:center; min-height:60vh; }
        .gate-content { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:48px; text-align:center; max-width:600px; }
        .gate-icon-wrap { width:72px; height:72px; border-radius:50%; background:rgba(136,153,187,.1); display:flex; align-items:center; justify-content:center; margin:0 auto 18px; }
        .gate-content h2 { font-size:24px; font-weight:700; margin-bottom:10px; }
        .gate-content p { color:#8899bb; margin-bottom:24px; }
        .gate-features { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:28px; }
        .gate-feat { display:flex; align-items:center; gap:8px; background:rgba(0,255,153,0.05); border:1px solid rgba(0,255,153,0.1); border-radius:8px; padding:10px 14px; font-size:13px; color:#ccc; }
        .upgrade-btn { display:inline-block; background:linear-gradient(135deg,#00ff99,#00cc66); color:#020817; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:800; font-size:15px; transition:.2s; }
        .upgrade-btn:hover { transform:translateY(-2px); box-shadow:0 6px 24px rgba(0,255,153,0.4); }

        /* Steps */
        .steps-row { display:flex; gap:0; margin-bottom:28px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; }
        .step-btn { flex:1; padding:14px; background:none; border:none; color:#8899bb; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-size:14px; font-weight:500; transition:.2s; border-right:1px solid rgba(255,255,255,0.07); }
        .step-btn:last-child { border-right:none; }
        .step-btn:hover:not(.disabled) { background:rgba(0,255,153,0.05); color:#ccc; }
        .step-btn.active { background:rgba(0,255,153,0.1); color:#00ff99; }
        .step-btn.disabled { opacity:.4; cursor:not-allowed; }

        /* Form */
        .form-layout { display:grid; grid-template-columns:1.4fr 1fr; gap:24px; }
        .form-main { display:flex; flex-direction:column; gap:20px; }
        .form-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:18px; }
        .form-card h2 { display:flex; align-items:center; gap:9px; font-size:18px; font-weight:600; }

        .upload-area { border:2px dashed rgba(0,255,153,0.25); border-radius:12px; padding:24px; text-align:center; cursor:pointer; transition:.2s; min-height:160px; display:flex; align-items:center; justify-content:center; }
        .upload-area:hover { border-color:rgba(0,255,153,0.5); background:rgba(0,255,153,0.03); }
        .upload-placeholder { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .upload-icon { display:flex; align-items:center; justify-content:center; }
        .upload-placeholder p { color:#ccc; font-size:14px; }
        .upload-hint { font-size:11px; color:#8899bb; }
        .preview-img { max-height:200px; border-radius:8px; object-fit:cover; }
        .remove-img { background:rgba(255,77,77,0.1); border:1px solid rgba(255,77,77,0.2); color:#ff4d4d; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px; align-self:flex-start; }

        .field-group { display:flex; flex-direction:column; gap:6px; position:relative; }
        .field-group label { font-size:11px; color:#8899bb; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; }
        .field-group input, .field-group select, .field-group textarea { background:#081633; border:1px solid rgba(255,255,255,0.1); color:white; padding:10px 12px; border-radius:8px; font-size:13px; transition:.2s; resize:none; font-family:'Inter',sans-serif; }
        .field-group input:focus, .field-group select:focus, .field-group textarea:focus { outline:none; border-color:rgba(0,255,153,0.4); }
        .field-group select option { background:#081633; }
        .char-count { font-size:11px; color:#8899bb; align-self:flex-end; }
        .input-with-icon { display:flex; align-items:center; background:#081633; border:1px solid rgba(255,255,255,0.1); border-radius:8px; overflow:hidden; }
        .input-with-icon span { padding:0 10px; color:#8899bb; font-weight:600; }
        .input-with-icon input { border:none; background:none; flex:1; }

        .fields-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .objective-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .objective-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; cursor:pointer; transition:.2s; display:flex; flex-direction:column; gap:3px; }
        .objective-card:hover { border-color:rgba(0,255,153,0.25); }
        .objective-card.selected { background:rgba(0,255,153,0.08); border-color:rgba(0,255,153,0.4); }
        .obj-label { font-size:13px; font-weight:600; }
        .obj-desc { font-size:11px; color:#8899bb; }
        .generate-btn { background:linear-gradient(135deg,#00ff99,#00cc66); color:#020817; border:none; padding:14px; border-radius:10px; font-weight:800; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:.2s; }
        .generate-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(0,255,153,0.4); }
        .generate-btn:disabled { opacity:.6; cursor:not-allowed; }

        /* Form sidebar */
        .form-sidebar { display:flex; flex-direction:column; gap:16px; }
        .info-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px; }
        .info-card h3 { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:600; color:#00ff99; margin-bottom:14px; }
        .how-steps { display:flex; flex-direction:column; gap:10px; }
        .how-step { display:flex; gap:10px; align-items:flex-start; font-size:13px; color:#ccc; }
        .how-num { width:22px; height:22px; border-radius:50%; background:#00ff99; color:#020817; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ai-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .ai-list li { display:flex; align-items:center; gap:8px; font-size:13px; color:#ccc; }
        .check { color:#00ff99; font-size:12px; }
        .total-cost-card { background:rgba(0,255,153,0.05); border:1px solid rgba(0,255,153,0.15); border-radius:14px; padding:18px; }
        .total-cost-card h3 { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:600; color:#00ff99; margin-bottom:12px; }
        .cost-breakdown { display:flex; flex-direction:column; gap:8px; }
        .cost-row { display:flex; justify-content:space-between; font-size:13px; color:#ccc; }
        .cost-row.total { font-weight:700; color:#00ff99; border-top:1px solid rgba(0,255,153,0.2); padding-top:8px; margin-top:4px; }
        .cost-note { font-size:11px; color:#8899bb; margin-top:10px; line-height:1.4; }

        /* Result */
        .reach-banner { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
        .reach-item { background:rgba(0,255,153,0.05); border:1px solid rgba(0,255,153,0.15); border-radius:12px; padding:16px; text-align:center; }
        .reach-val { display:block; font-size:22px; font-weight:800; color:#00ff99; }
        .reach-lbl { font-size:11px; color:#8899bb; display:block; margin-top:3px; }
        .result-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }

        .ad-preview-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; }
        .ad-preview-card h3 { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:600; margin-bottom:14px; }
        .fb-ad-mock { background:white; border-radius:12px; overflow:hidden; color:#1c1e21; }
        .fb-header { display:flex; gap:10px; align-items:center; padding:12px; }
        .fb-avatar { width:38px; height:38px; border-radius:50%; background:#1877f2; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; }
        .fb-page { font-weight:600; font-size:13px; }
        .fb-sponsored { font-size:11px; color:#65676b; }
        .fb-text { padding:0 12px 10px; font-size:13px; line-height:1.5; color:#1c1e21; }
        .fb-img { width:100%; height:180px; object-fit:cover; }
        .fb-img-placeholder { width:100%; height:160px; background:#e4e6ea; display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; color:#8899bb; border-radius:4px; }
        .fb-bottom { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f0f2f5; gap:10px; }
        .fb-headline-block { flex:1; }
        .fb-headline { font-weight:700; font-size:13px; }
        .fb-desc { font-size:11px; color:#65676b; }
        .fb-cta { background:#1877f2; color:white; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; }

        .copy-cards { display:flex; flex-direction:column; gap:14px; }
        .copy-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; }
        .copy-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:13px; font-weight:600; color:#00ff99; }
        .copy-text { font-size:13px; color:#ccc; line-height:1.6; }
        .copy-btn { display:inline-flex; align-items:center; gap:5px; background:rgba(0,255,153,0.1); border:1px solid rgba(0,255,153,0.2); color:#00ff99; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; transition:.2s; }
        .copy-btn:hover { background:rgba(0,255,153,0.18); }
        .copy-btn.sm { padding:3px 8px; }
        .alt-item { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#ccc; }
        .alt-item:last-child { border-bottom:none; }
        .hashtags { display:flex; flex-wrap:wrap; gap:6px; }
        .hashtag { background:rgba(24,119,242,0.12); color:#1877f2; border:1px solid rgba(24,119,242,0.2); padding:4px 10px; border-radius:20px; font-size:12px; }

        .targeting-section { margin-bottom:20px; }
        .targeting-section h3 { display:flex; align-items:center; gap:8px; font-size:16px; font-weight:600; margin-bottom:14px; }
        .targeting-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .targeting-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; }
        .targeting-card h4 { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#00ff99; margin-bottom:8px; }
        .targeting-card p { font-size:13px; color:#ccc; }
        .interest-tags { display:flex; flex-wrap:wrap; gap:6px; }
        .interest-tag { background:rgba(167,139,250,0.12); color:#a78bfa; border:1px solid rgba(167,139,250,0.2); padding:3px 10px; border-radius:20px; font-size:11px; }
        .insight-text { font-size:12px; color:#8899bb; line-height:1.6; }

        .tips-section { margin-bottom:24px; }
        .tips-section h3 { display:flex; align-items:center; gap:8px; font-size:16px; font-weight:600; margin-bottom:14px; }
        .tips-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .tip-card { background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.15); border-radius:10px; padding:14px; display:flex; gap:10px; align-items:flex-start; }
        .tip-num { width:24px; height:24px; border-radius:50%; background:#ffd700; color:#020817; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .tip-card p { font-size:12px; color:#ccc; line-height:1.5; }
        .result-actions { display:flex; justify-content:space-between; align-items:center; }
        .back-btn { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:#ccc; padding:11px 22px; border-radius:8px; cursor:pointer; font-size:14px; transition:.2s; }
        .back-btn:hover { background:rgba(255,255,255,0.12); }
        .next-btn { display:inline-flex; align-items:center; gap:7px; background:linear-gradient(135deg,#00ff99,#00cc66); color:#020817; border:none; padding:11px 28px; border-radius:8px; font-weight:800; font-size:14px; cursor:pointer; transition:.2s; }
        .next-btn:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,255,153,.35); }

        /* ✅ AI Ad Video Section */
        .ad-video-section { background:rgba(255,255,255,0.03); border:1px solid rgba(0,255,153,0.15); border-radius:18px; padding:28px; margin-bottom:24px; }
        .ad-video-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; flex-wrap:wrap; gap:12px; }
        .ad-video-header h3 { display:flex; align-items:center; gap:8px; font-size:20px; font-weight:700; margin-bottom:4px; }
        .ad-video-header p { font-size:13px; color:#8899bb; }
        .video-no-image { text-align:center; padding:40px; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .video-no-image span { font-size:44px; }
        .video-no-image p { color:#8899bb; font-size:14px; }

        /* 3-style grid */
        .video-styles-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:24px; }
        .vs-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:12px; transition:.25s; }
        .vs-card:hover { border-color:rgba(0,255,153,0.25); background:rgba(0,255,153,0.03); }
        .vs-card.selected { border-color:rgba(0,255,153,0.5); background:rgba(0,255,153,0.06); }
        .vs-card-top { display:flex; justify-content:space-between; align-items:center; }
        .vs-label { font-size:15px; font-weight:700; color:#fff; }
        .vs-done-badge { display:inline-flex; align-items:center; gap:4px; background:rgba(0,255,153,0.12); color:#00ff99; border:1px solid rgba(0,255,153,0.3); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }
        .vs-rendering-badge { display:inline-flex; align-items:center; gap:4px; background:rgba(255,215,0,0.1); color:#ffd700; border:1px solid rgba(255,215,0,0.25); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }
        .vs-desc { font-size:12px; color:#8899bb; line-height:1.5; }
        .vs-thumb-wrap { border-radius:10px; overflow:hidden; height:160px; position:relative; }
        .vs-thumb-video { width:100%; height:160px; object-fit:cover; display:block; border-radius:10px; cursor:pointer; transition:.2s; }
        .vs-thumb-video.active { box-shadow:0 0 0 3px #00ff99; }
        .vs-thumb-placeholder { width:100%; height:160px; position:relative; border-radius:10px; overflow:hidden; }
        .vs-thumb-placeholder.cinematic { background:linear-gradient(135deg,#061228,#020817); }
        .vs-thumb-placeholder.minimal   { background:linear-gradient(135deg,#111,#0a0a0a); }
        .vs-thumb-placeholder.bold      { background:linear-gradient(135deg,#0a0020,#1a0040); }
        .vs-thumb-overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
        .vs-thumb-icon { font-size:36px; }
        .vs-progress-wrap { display:flex; flex-direction:column; gap:6px; }
        .vs-progress-track { height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden; }
        .vs-progress-fill { height:100%; background:linear-gradient(90deg,#00ff99,#00cc66); border-radius:3px; transition:width .3s ease; }
        .vs-progress-label { font-size:11px; color:#8899bb; }
        .vs-actions { display:flex; gap:6px; flex-wrap:wrap; }
        .vs-gen-btn { flex:1; background:linear-gradient(135deg,#00ff99,#00cc66); border:none; color:#020817; padding:9px 14px; border-radius:8px; font-weight:800; font-size:13px; cursor:pointer; transition:.2s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .vs-gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,255,153,0.3); }
        .vs-gen-btn:disabled { opacity:.55; cursor:not-allowed; }
        .vs-select-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; background:rgba(0,255,153,0.08); border:1px solid rgba(0,255,153,0.25); color:#00ff99; padding:9px 12px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; transition:.2s; }
        .vs-select-btn:hover { background:rgba(0,255,153,0.15); }
        .vs-download-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); color:#ccc; padding:9px 12px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; transition:.2s; }
        .vs-download-btn:hover { background:rgba(255,255,255,0.12); color:#fff; }
        .vs-regen-btn { display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#8899bb; padding:9px 10px; border-radius:8px; cursor:pointer; transition:.2s; }
        .vs-regen-btn:hover:not(:disabled) { background:rgba(255,255,255,0.1); color:white; }
        .vs-regen-btn:disabled { opacity:.4; cursor:not-allowed; }

        /* Full preview */
        .vs-full-preview { border-top:1px solid rgba(255,255,255,0.08); padding-top:22px; display:flex; flex-direction:column; align-items:center; gap:14px; }
        .vs-full-header { display:flex; justify-content:space-between; align-items:center; width:100%; max-width:540px; flex-wrap:wrap; gap:10px; }
        .vs-full-header h4 { font-size:15px; font-weight:600; color:#00ff99; }
        .ad-video-player { width:100%; max-width:500px; border-radius:16px; border:2px solid rgba(0,255,153,0.2); box-shadow:0 0 40px rgba(0,255,153,0.1); }
        .video-format-note { font-size:12px; color:#8899bb; text-align:center; }
        .video-format-note a { color:#00ff99; }

        /* Generate all */
        .gen-all-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin-top:8px; background:rgba(0,255,153,0.08); border:1px solid rgba(0,255,153,0.25); color:#00ff99; padding:13px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; transition:.2s; }
        .gen-all-btn:hover { background:rgba(0,255,153,0.14); transform:translateY(-1px); }

        .download-video-btn { background:linear-gradient(135deg,#00ff99,#00cc66); border:none; color:#020817; padding:10px 22px; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; transition:.2s; display:flex; align-items:center; gap:8px; }
        .download-video-btn:hover { transform:translateY(-1px); box-shadow:0 4px 20px rgba(0,255,153,0.35); }

        @media(max-width:900px) { .video-styles-grid { grid-template-columns:1fr; } }

        /* Launch */
        .launch-layout { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
        .launch-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:18px; }
        .launch-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; width:fit-content; }
        .launch-badge.part-a { background:rgba(0,255,153,0.1); color:#00ff99; border:1px solid rgba(0,255,153,0.25); }
        .launch-badge.part-b { background:rgba(24,119,242,0.12); color:#1877f2; border:1px solid rgba(24,119,242,0.25); }
        .launch-card h2 { font-size:18px; font-weight:600; }
        .launch-desc { color:#8899bb; font-size:13px; line-height:1.6; }
        .api-card { border-color:rgba(24,119,242,0.2); }

        .manual-steps { display:flex; flex-direction:column; gap:14px; }
        .manual-step { display:flex; gap:12px; align-items:flex-start; }
        .manual-step .step-num { width:28px; height:28px; border-radius:50%; background:rgba(0,255,153,0.12); border:1px solid rgba(0,255,153,0.3); color:#00ff99; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .manual-step strong { font-size:14px; display:block; margin-bottom:4px; }
        .manual-step p { font-size:12px; color:#8899bb; margin-top:2px; }
        .open-link { color:#00ff99; text-decoration:none; font-size:13px; display:block; margin-top:4px; }
        .open-link:hover { text-decoration:underline; }

        .copy-fields { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
        .copy-field-row { display:flex; justify-content:space-between; align-items:center; gap:10px; background:rgba(255,255,255,0.04); border-radius:8px; padding:10px 12px; }
        .cf-label { font-size:11px; color:#8899bb; display:block; }
        .cf-value { font-size:13px; color:#ccc; display:block; margin-top:2px; }

        .setup-warning { background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.15); border-radius:10px; padding:16px; }
        .setup-warning h4 { display:flex; align-items:center; gap:6px; color:#ffd700; font-size:13px; margin-bottom:10px; }
        .setup-warning ol { padding-left:18px; display:flex; flex-direction:column; gap:6px; }
        .setup-warning li { font-size:12px; color:#ccc; line-height:1.5; }
        .setup-warning a { color:#00ff99; }
        .setup-warning code { background:rgba(0,255,153,0.1); color:#00ff99; padding:1px 6px; border-radius:4px; font-size:11px; }

        .api-fields { display:flex; flex-direction:column; gap:12px; }
        .launch-btn { background:linear-gradient(135deg,#1877f2,#0d5fd8); border:none; color:white; padding:14px; border-radius:10px; font-weight:800; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:.2s; }
        .launch-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(24,119,242,0.4); }
        .launch-btn:disabled { opacity:.5; cursor:not-allowed; }
        .launch-result { border-radius:10px; padding:16px; }
        .launch-result.success { background:rgba(0,255,153,0.08); border:1px solid rgba(0,255,153,0.25); }
        .launch-result.error { background:rgba(255,77,77,0.08); border:1px solid rgba(255,77,77,0.25); color:#ff6b6b; }
        .launch-result h3 { display:flex; align-items:center; gap:7px; font-size:16px; margin-bottom:8px; }
        .launch-result code { background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:4px; font-size:12px; }
        .review-link { display:inline-flex; align-items:center; gap:6px; margin-top:10px; color:#00ff99; text-decoration:none; font-weight:600; }

        /* Under Development Banner */
        .dev-banner { background:rgba(255,165,0,0.08); border:1px solid rgba(255,165,0,0.25); border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
        .dev-banner-left { display:flex; align-items:center; gap:14px; }
        .dev-icon { flex-shrink:0; }
        .dev-banner-left strong { font-size:15px; color:#ffa500; display:block; margin-bottom:3px; }
        .dev-banner-left p { font-size:13px; color:#8899bb; }
        .dev-badge { background:rgba(255,165,0,0.12); color:#ffa500; border:1px solid rgba(255,165,0,0.3); padding:5px 14px; border-radius:20px; font-size:12px; font-weight:700; white-space:nowrap; }

        /* Coming Soon Block */
        .coming-soon-block { background:rgba(255,165,0,0.05); border:1px solid rgba(255,165,0,0.2); border-radius:14px; padding:28px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }
        .cs-icon { display:flex; align-items:center; justify-content:center; }
        .coming-soon-block h3 { font-size:18px; font-weight:700; color:#ffa500; }
        .coming-soon-block p { font-size:13px; color:#8899bb; line-height:1.6; max-width:400px; }
        .cs-steps { display:flex; flex-direction:column; gap:8px; width:100%; max-width:380px; }
        .cs-step { display:flex; align-items:center; gap:8px; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:500; text-align:left; }
        .cs-step.done { background:rgba(0,255,153,0.07); color:#00ff99; border:1px solid rgba(0,255,153,0.15); }
        .cs-step.pending { background:rgba(255,165,0,0.07); color:#ffa500; border:1px solid rgba(255,165,0,0.2); }
        .manual-ads-link { display:inline-flex; align-items:center; gap:6px; color:#00ff99; text-decoration:none; font-size:13px; font-weight:600; padding:10px 20px; border:1px solid rgba(0,255,153,0.25); border-radius:8px; transition:.2s; }
        .manual-ads-link:hover { background:rgba(0,255,153,0.08); }

        .spinner { width:16px; height:16px; border:2px solid rgba(2,8,23,0.3); border-top-color:currentColor; border-radius:50%; animation:spin .6s linear infinite; display:inline-block; }
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:1100px){ .result-grid{grid-template-columns:1fr;} .launch-layout{grid-template-columns:1fr;} .tips-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:900px){
          .menu-btn{display:flex;} .sidebar{left:-240px;} .sidebar.active{left:0;}
          .main{margin-left:0;padding:70px 16px 20px;}
          .form-layout{grid-template-columns:1fr;}
          .fields-grid{grid-template-columns:1fr;}
          .reach-banner{grid-template-columns:repeat(2,1fr);}
          .targeting-grid{grid-template-columns:1fr;}
          .tips-grid{grid-template-columns:1fr;}
          .steps-row{flex-direction:column;}
        }
      `}</style>
    </>
  );
}
