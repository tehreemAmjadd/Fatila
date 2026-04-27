"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Search, Bookmark, MapPin, Globe, Star, Lock,
  ExternalLink, AlertTriangle, Zap,
  RefreshCw, Filter, Bot, Mail, Phone,
  Briefcase, Send, ChevronRight, Building2, Clock,
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb", leadsMax:50   },
  trial:    { label:"Trial",        color:"#ffd700", leadsMax:50   },
  starter:  { label:"Starter",      color:"#00ff99", leadsMax:100  },
  pro:      { label:"Professional", color:"#3b9eff", leadsMax:1000 },
  business: { label:"Business",     color:"#a78bfa", leadsMax:Infinity },
  expired:  { label:"Expired",      color:"#ff6b6b", leadsMax:0    },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

const INDUSTRIES = [
  "Technology","Healthcare","Finance","Retail","Education",
  "Real Estate","Food & Beverage","Automotive","Hospitality",
  "Legal","Fitness","Beauty","Manufacturing",
];

const PRIORITY_COLOR: Record<string,string> = { High:"#ff4d4d", Medium:"#ffd700", Low:"#00ff99" };

interface LeadResult {
  placeId: string;
  company: string;
  address: string;
  phone: string;
  phones: string[];       // all phone numbers
  email: string | null;
  emails: string[];       // all emails from website scraping
  website: string;
  industry: string;
  rating: number | null;
  reviewCount: number;
  score: number;
  priority: string;
  aiInsight: string;
  linkedinUrl: string;
  fromCache?: boolean;
}

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  postedAt: string;
  description: string;
  applyUrl: string;
  source: string;
  salary?: string;
}

// ─── sessionStorage helpers ────────────────────────────────────────────────
// Results tab tak persist rehte hain, tab close hone pe clear ho jate hain

function saveResultsToSession(
  results: LeadResult[],
  keyword: string,
  location: string,
  industry: string
) {
  try {
    sessionStorage.setItem("leadSearch_results",  JSON.stringify(results));
    sessionStorage.setItem("leadSearch_keyword",  keyword);
    sessionStorage.setItem("leadSearch_location", location);
    sessionStorage.setItem("leadSearch_industry", industry);
    sessionStorage.setItem("leadSearch_searched", "true");
  } catch {}
}

function loadResultsFromSession(): {
  results: LeadResult[];
  keyword: string;
  location: string;
  industry: string;
  searched: boolean;
} {
  try {
    const raw = sessionStorage.getItem("leadSearch_results");
    return {
      results:  raw ? JSON.parse(raw) : [],
      keyword:  sessionStorage.getItem("leadSearch_keyword")  || "",
      location: sessionStorage.getItem("leadSearch_location") || "",
      industry: sessionStorage.getItem("leadSearch_industry") || "",
      searched: sessionStorage.getItem("leadSearch_searched") === "true",
    };
  } catch {
    return { results: [], keyword: "", location: "", industry: "", searched: false };
  }
}

// ─── Query-specific seen leads helpers ────────────────────────────────────
// Har keyword+location combination ka apna seen pool hai
// Taake "Software Companies Lahore" aur "Dental Clinics Dubai" alag track hon

function makeSeenKey(userEmail: string, keyword: string, location: string): string {
  const k = (keyword + "_" + location).toLowerCase().trim().replace(/\s+/g, "_");
  return `seenLeads_${userEmail}_${k}`;
}

function getSeenLeadIds(userEmail: string, keyword: string, location: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(makeSeenKey(userEmail, keyword, location));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markLeadsAsSeen(userEmail: string, keyword: string, location: string, placeIds: string[]) {
  try {
    const existing = getSeenLeadIds(userEmail, keyword, location);
    placeIds.forEach(id => existing.add(id));
    sessionStorage.setItem(makeSeenKey(userEmail, keyword, location), JSON.stringify([...existing]));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LeadSearchPage() {
  const { user } = useUser();

  // Filters — restored from session on mount
  const [industry,      setIndustry]      = useState("");
  const [location,      setLocation]      = useState("");
  const [keyword,       setKeyword]       = useState("");
  const [companySize,   setCompanySize]   = useState("");
  const [resultsLimit,  setResultsLimit]  = useState(20);

  // Results
  const [results,     setResults]     = useState<LeadResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched,    setSearched]    = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [savedIds,    setSavedIds]    = useState<Set<string>>(new Set());
  const [savingId,    setSavingId]    = useState<string|null>(null);
  const [saveError,   setSaveError]   = useState("");

  // Job Search
  const [jobPrompt,       setJobPrompt]       = useState("");
  const [jobResults,      setJobResults]       = useState<JobResult[]>([]);
  const [jobLoading,      setJobLoading]       = useState(false);
  const [jobSearched,     setJobSearched]      = useState(false);
  const [jobError,        setJobError]         = useState("");
  const [jobResultsUsed,  setJobResultsUsed]   = useState(0);
  const [jobLimitReached, setJobLimitReached]  = useState(false);
  const [numJobResults,   setNumJobResults]    = useState(10);
  const [savedJobIds,     setSavedJobIds]      = useState<Set<string>>(new Set());
  const [savingJobId,     setSavingJobId]      = useState<string|null>(null);

  // Plan
  const [dbUser,     setDbUser]     = useState<any>(null);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const session = loadResultsFromSession();
    if (session.searched && session.results.length > 0) {
      setResults(session.results);
      setKeyword(session.keyword);
      setLocation(session.location);
      setIndustry(session.industry);
      setSearched(true);
    }
  }, []);

  // ── Fetch plan + real lead count ──────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    if (!email) return;
    try {
      const [uRes, sRes] = await Promise.all([
        fetch("/api/get-user",        { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) }),
        fetch("/api/dashboard/stats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) }),
      ]);
      const uData = await uRes.json();
      const sData = await sRes.json();
      setDbUser(uData);
      const raw = sData?.totalLeads ?? uData?.totalLeads ?? uData?.leadsUsed ?? 0;
      const count = typeof raw === "number" ? raw
                  : Array.isArray(raw)       ? raw.length
                  : Number(raw) || 0;
      setLeadsCount(count);

      const usedFromDb = Number(uData?.jobResultsUsed ?? 0);
      setJobResultsUsed(usedFromDb);
    } catch(e) { console.error(e); }
  }, [email]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // ── Derived plan info ─────────────────────────────────────────────────────
  const isAdmin       = dbUser?.role === "admin";
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey) || "free");
  const planCfg       = isAdmin ? PLAN_CONFIG.business : (PLAN_CONFIG[effectivePlan] || PLAN_CONFIG.free);
  const canSearch     = isAdmin || effectivePlan !== "expired";
  const leadsUsed     = leadsCount;
  const leadsMax      = planCfg.leadsMax;
  const atLimit       = !isAdmin && leadsMax !== Infinity && leadsUsed >= leadsMax;

  // ── Job Search plan gating ────────────────────────────────────────────────
  const JOB_LIMITS_BY_PLAN: Record<string,number> = {
    trial:    20,
    starter:  100,
    pro:      500,
    business: Infinity,
  };
  const TRIAL_JOB_LIMIT    = 20;
  const canUseJobSearch    = isAdmin || ["trial","starter","pro","business"].includes(effectivePlan) && effectivePlan !== "free" && effectivePlan !== "expired";
  const isJobSearchLimited = !isAdmin && ["trial","starter","pro"].includes(effectivePlan);
  const jobLimit           = isAdmin ? Infinity : (JOB_LIMITS_BY_PLAN[effectivePlan] ?? 0);
  const derivedLimitReached = isJobSearchLimited && jobLimit !== Infinity && jobResultsUsed >= jobLimit;

  // ── Lead Search ───────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!canSearch || atLimit) return;
    if (!location && !keyword) {
      alert("Please enter at least a location or keyword.");
      return;
    }
    setLoading(true);
    setSearched(true);
    setSaveError("");
    setHasMore(false);

    // Fresh search — seen IDs reset karo (naya keyword/location)
    if (email) {
      try { sessionStorage.removeItem(makeSeenKey(email, keyword, location)); } catch {}
    }

    try {
      const res = await fetch("/api/leads/search", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          industry, location, keyword, email,
          excludePlaceIds: [],
          resultsLimit,
        }),
      });
      const data = await res.json();
      const newLeads: LeadResult[] = data.leads || [];

      setResults(newLeads);
      saveResultsToSession(newLeads, keyword, location, industry);

      // Jo leads show hue unhe seen mark karo
      if (email && newLeads.length > 0) {
        markLeadsAsSeen(email, keyword, location, newLeads.map(l => l.placeId));
      }

      // Agar pool mein aur bhi hain toh "Load More" dikhao
      setHasMore((data.remainingUnseen ?? 0) > 0);

      await fetchUser();
    } catch(err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Load More (next batch — same keyword/location, seen exclude) ──────────
  const handleLoadMore = async () => {
    if (!canSearch || loadingMore) return;
    setLoadingMore(true);
    setSaveError("");

    const seenIds = email ? [...getSeenLeadIds(email, keyword, location)] : [];

    try {
      const res = await fetch("/api/leads/search", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          industry, location, keyword, email,
          excludePlaceIds: seenIds,
          resultsLimit,
        }),
      });
      const data = await res.json();
      const newLeads: LeadResult[] = data.leads || [];

      if (newLeads.length === 0) {
        setHasMore(false);
        return;
      }

      const combined = [...results, ...newLeads];
      setResults(combined);
      saveResultsToSession(combined, keyword, location, industry);

      if (email) {
        markLeadsAsSeen(email, keyword, location, newLeads.map(l => l.placeId));
      }

      setHasMore((data.remainingUnseen ?? 0) > 0);
    } catch(err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Job Search ────────────────────────────────────────────────────────────
  const handleJobSearch = async () => {
    if (!canUseJobSearch || !jobPrompt.trim()) return;
    if (isJobSearchLimited && (jobLimitReached || derivedLimitReached)) return;

    setJobLoading(true);
    setJobSearched(true);
    setJobError("");
    setJobResults([]);
    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: jobPrompt,
          email,
          plan: isAdmin ? "admin" : effectivePlan,
          numResults: numJobResults,
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        setJobLimitReached(true);
        setJobResultsUsed(data.jobResultsUsed ?? TRIAL_JOB_LIMIT);
        setJobResults([]);
        return;
      }

      if (data.error) {
        setJobError(data.error);
      } else {
        // Sort by most recent first
        const jobs: JobResult[] = (data.jobs || []).sort((a: JobResult, b: JobResult) => {
          const order = ["Today","Yesterday","1 week ago"];
          const ai = order.indexOf(a.postedAt); const bi = order.indexOf(b.postedAt);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1; if (bi !== -1) return 1;
          // parse "X days ago"
          const da = parseInt(a.postedAt) || 999; const db2 = parseInt(b.postedAt) || 999;
          return da - db2;
        });
        setJobResults(jobs);
        if (isJobSearchLimited) {
          setJobResultsUsed(data.jobResultsUsed ?? 0);
          setJobLimitReached(data.limitReached ?? false);
        }
      }
    } catch (err) {
      console.error(err);
      setJobError("Something went wrong. Please try again.");
    } finally {
      setJobLoading(false);
    }
  };

  // ── Save Job ──────────────────────────────────────────────────────────────
  const handleSaveJob = async (job: JobResult) => {
    if (!email) return;
    setSavingJobId(job.id);
    try {
      await fetch("/api/jobs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, job }),
      });
      setSavedJobIds(prev => new Set([...prev, job.id]));
    } catch(err) { console.error(err); }
    finally { setSavingJobId(null); }
  };

  // ── Save lead ─────────────────────────────────────────────────────────────
  const handleSave = async (lead: LeadResult) => {
    if (!email) return;
    setSavingId(lead.placeId);
    setSaveError("");
    try {
      const res = await fetch("/api/leads/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email,
          lead: {
            placeId:     lead.placeId,
            company:     lead.company     || "",
            address:     lead.address     || "",
            phone:       lead.phone       || "",
            email:       lead.email       || null,
            website:     lead.website     || "",
            industry:    lead.industry    || "",
            rating:      lead.rating      ?? null,
            reviewCount: lead.reviewCount ?? 0,
            score:       lead.score       ?? 0,
            priority:    lead.priority    || "Medium",
            aiInsight:   lead.aiInsight   || "",
            linkedinUrl: lead.linkedinUrl || "",
          },
        }),
      });
      const data = await res.json();
      if (data.error) { setSaveError(data.error); }
      else { setSavedIds(prev => new Set([...prev, lead.placeId])); }
    } catch { setSaveError("Save failed. Try again."); }
    finally { setSavingId(null); }
  };

  const priorityBg = (p:string) => p==="High"?"rgba(255,77,77,.12)":p==="Medium"?"rgba(255,215,0,.12)":"rgba(0,255,153,.12)";

  return (
    <>
      <div className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Lead Search</h1>
            <p>Find businesses using Google Places + AI scoring</p>
          </div>
          <div className="header-right">
            {searched && results.length > 0 && (
              <span className="result-badge">
                <Search size={13}/>{results.length} results
              </span>
            )}
            <span className="plan-chip" style={{color:planCfg.color,borderColor:`${planCfg.color}44`,background:`${planCfg.color}11`}}>
              {planCfg.label}
            </span>
          </div>
        </div>

        {/* ── EXPIRED GATE ── */}
        {!canSearch && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>Your trial has expired</h3>
            <p>Your 7-day trial has ended. Upgrade to keep searching for leads and accessing all platform features.</p>
            <a href="/billing" className="gate-cta">Choose a Plan</a>
          </div>
        )}

        {/* ── LIMIT WARNING ── */}
        {canSearch && atLimit && (
          <div className="limit-banner">
            <AlertTriangle size={15} color="#ff6b6b"/>
            <span>You've reached your <strong>{leadsMax} lead limit</strong> for this plan.</span>
            <a href="/billing">Upgrade now</a>
          </div>
        )}

        {/* ── SEARCH FILTERS ── */}
        {canSearch && (
          <div className="filters-panel">
            <div className="filters-title">
              <Filter size={15} color="#00ff99"/>
              <h3>Search Filters</h3>
            </div>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Location <span className="req">*</span></label>
                <input value={location} onChange={e=>setLocation(e.target.value)}
                  placeholder="e.g. Dubai, London, Lahore"
                  onKeyDown={e=>e.key==="Enter"&&handleSearch()} />
              </div>
              <div className="filter-group">
                <label>Keyword</label>
                <input value={keyword} onChange={e=>setKeyword(e.target.value)}
                  placeholder="e.g. dental clinic, software house"
                  onKeyDown={e=>e.key==="Enter"&&handleSearch()} />
              </div>
              <div className="filter-group">
                <label>Company Size</label>
                <select value={companySize} onChange={e=>setCompanySize(e.target.value)}>
                  <option value="">Any Size</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="10-50">10–50 employees</option>
                  <option value="50-200">50–200 employees</option>
                  <option value="200+">200+ employees</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Results to Show</label>
                <select value={resultsLimit} onChange={e=>setResultsLimit(Number(e.target.value))}>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                </select>
              </div>
            </div>

            {leadsMax !== Infinity && (
              <div className="usage-row">
                <span className="usage-lbl">
                  Lead usage: <strong style={{color:atLimit?"#ff6b6b":planCfg.color}}>{leadsUsed} / {leadsMax}</strong>
                </span>
                <div className="usage-track">
                  <div className="usage-fill" style={{
                    width:`${Math.min((leadsUsed/leadsMax)*100,100)}%`,
                    background:atLimit?"#ff6b6b":leadsUsed/leadsMax>=.8?"#ffd700":"#00ff99",
                  }}/>
                </div>
              </div>
            )}

            <button className="search-btn" onClick={handleSearch} disabled={loading||atLimit}>
              {loading
                ? <><RefreshCw size={15} className="spin"/>Searching...</>
                : <><Search size={15}/>Search Leads</>
              }
            </button>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="error-banner">
            <AlertTriangle size={14} color="#ff6b6b"/>{saveError}
            <a href="/saved-leads">Check Saved Leads</a>
          </div>
        )}

        {/* ── LEAD RESULTS ── */}
        {searched && canSearch && (
          <div className="results-section">
            <div className="results-hdr">
              <h2>
                {loading
                  ? "Searching..."
                  : `${results.length} result${results.length!==1?"s":""} found${hasMore?" (more available)":""}`}
              </h2>
              {savedIds.size > 0 && (
                <a href="/saved-leads" className="saved-pill">
                  <Bookmark size={13}/>{savedIds.size} saved — View all
                </a>
              )}
            </div>

            {loading ? (
              <div className="skeleton-grid">
                {[...Array(4)].map((_,i)=><div key={i} className="skeleton-card"/>)}
              </div>
            ) : results.length === 0 ? (
              <div className="no-results">
                <Search size={32} color="#8899bb" strokeWidth={1.4}/>
                <p>No more new results for this search — all available leads have been shown. Try a different keyword or location.</p>
              </div>
            ) : (
              <div className="results-grid">
                {results.map(lead => {
                  const isSaved   = savedIds.has(lead.placeId);
                  const isSaving  = savingId === lead.placeId;
                  return (
                    <div key={lead.placeId} className={`lead-card ${isSaved?"saved":""}`}>
                      <div className="card-top">
                        <div className="company-avatar">{lead.company.charAt(0).toUpperCase()}</div>
                        <div className="company-info">
                          <h3 className="company-name">{lead.company}</h3>
                          <span className="industry-tag">{lead.industry}</span>
                        </div>
                        <div className="score-wrap">
                          <div className="score-circle">{lead.score}</div>
                          <span className="score-lbl">score</span>
                        </div>
                      </div>

                      <div className="priority-row">
                        <span className="priority-badge"
                          style={{color:PRIORITY_COLOR[lead.priority],background:priorityBg(lead.priority),border:`1px solid ${PRIORITY_COLOR[lead.priority]}33`}}>
                          {lead.priority} Priority
                        </span>
                        {lead.rating && (
                          <span className="rating">
                            <Star size={12} color="#ffd700"/>{lead.rating}
                            <span className="review-count">({lead.reviewCount})</span>
                          </span>
                        )}
                        {lead.fromCache && (
                          <span className="cache-tag"><Zap size={10} color="#ffd700"/>Cached</span>
                        )}
                      </div>

                      <div className="contact-list">
                        {lead.address && (
                          <div className="contact-row">
                            <MapPin size={13} color="#8899bb" strokeWidth={1.8}/>
                            <span>{lead.address.split(",").slice(-2).join(",").trim()}</span>
                          </div>
                        )}

                        {/* All phone numbers */}
                        {(lead.phones?.length > 0 ? lead.phones : lead.phone ? [lead.phone] : []).map((ph, idx) => (
                          <div className="contact-row" key={`ph-${idx}`}>
                            <Phone size={13} color={idx === 0 ? "#8899bb" : "#556677"} strokeWidth={1.8}/>
                            <a href={`tel:${ph}`}>{ph}</a>
                            {idx > 0 && <span style={{fontSize:"10px",color:"#556677",marginLeft:"4px"}}>(alt)</span>}
                          </div>
                        ))}

                        {/* All emails from website scraping */}
                        {(lead.emails?.length > 0 ? lead.emails : lead.email ? [lead.email] : []).map((em, idx) => (
                          <div className="contact-row" key={`em-${idx}`}>
                            <Mail size={13} color={idx === 0 ? "#00ff99" : "#556677"} strokeWidth={1.8}/>
                            <a href={`mailto:${em}`} style={{color: idx === 0 ? "#00ff99" : "#8899bb"}}>{em}</a>
                            {idx === 0 && lead.emails?.length > 1 && (
                              <span style={{fontSize:"10px",color:"#00ff99",marginLeft:"4px",background:"rgba(0,255,153,.1)",padding:"1px 5px",borderRadius:"8px"}}>
                                +{lead.emails.length - 1} more
                              </span>
                            )}
                          </div>
                        ))}

                        {lead.website && (
                          <div className="contact-row">
                            <Globe size={13} color="#8899bb" strokeWidth={1.8}/>
                            <a href={lead.website.startsWith("http")?lead.website:"https://"+lead.website} target="_blank" rel="noreferrer">
                              {lead.website.replace(/https?:\/\//,"").split("/")[0]}
                            </a>
                          </div>
                        )}
                      </div>

                      {lead.aiInsight && (
                        <div className="ai-insight">
                          <div className="insight-label"><Bot size={12} color="#00ff99"/>AI Insight</div>
                          <p>{lead.aiInsight.split("\n")[0]}</p>
                        </div>
                      )}

                      <div className="card-actions">
                        <button
                          className={`save-btn ${isSaved?"saved":""}`}
                          onClick={()=>!isSaved&&handleSave(lead)}
                          disabled={isSaved||isSaving}
                        >
                          <Bookmark size={14} strokeWidth={1.8}/>
                          {isSaving?"Saving...":isSaved?"Saved":"Save Lead"}
                        </button>
                        {lead.linkedinUrl && (
                          <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="li-btn">
                            <ExternalLink size={13}/>LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── LOAD MORE BUTTON ── */}
            {!loading && hasMore && results.length > 0 && (
              <div style={{textAlign:"center",marginTop:"20px"}}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    display:"inline-flex",alignItems:"center",gap:"8px",
                    background:"rgba(59,158,255,.12)",border:"1px solid rgba(59,158,255,.35)",
                    color:"#3b9eff",padding:"12px 32px",borderRadius:"30px",
                    fontSize:"14px",fontWeight:"700",cursor:loadingMore?"not-allowed":"pointer",
                    transition:".2s",opacity:loadingMore?.7:1,
                  }}
                >
                  {loadingMore
                    ? <><RefreshCw size={15} className="spin"/>Loading more...</>
                    : <><ChevronRight size={15}/>Load More Results</>
                  }
                </button>
                <p style={{marginTop:"8px",fontSize:"12px",color:"#8899bb"}}>
                  New companies will be shown — previously seen results will not repeat
                </p>
              </div>
            )}

            {/* Pool exhausted message */}
            {!loading && !hasMore && searched && results.length > 0 && (
              <p style={{textAlign:"center",marginTop:"16px",fontSize:"12px",color:"#556677"}}>
                ✓ All available results for this search have been shown
              </p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── JOB SEARCH SECTION ─────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="job-section">
          <div className="job-section-header">
            <div className="job-section-title">
              <div className="job-icon-wrap"><Briefcase size={16} color="#3b9eff"/></div>
              <div>
                <h2>
                  Job Search
                  <span className="job-ai-badge"><Bot size={10}/>AI-Powered</span>
                  <span className="job-paid-badge"><Lock size={9}/>Paid Feature</span>
                </h2>
                <p>Type the job role and location — get real listings from LinkedIn, Rozee.pk, Indeed & more</p>
              </div>
            </div>
          </div>

          {/* ── FREE PLAN GATE ── */}
          {!canUseJobSearch ? (
            <div className="job-gate-box">
              <div className="job-gate-icon"><Lock size={26} strokeWidth={1.4} color="#8899bb"/></div>
              <h3>Upgrade to Access Job Search</h3>
              <p>Job Search is a paid feature. Start a free trial or upgrade to a paid plan to search for real job listings with direct apply links.</p>
              <a href="/billing" className="gate-cta">View Plans</a>
            </div>
          ) : (
            <>
              {/* ── TRIAL USAGE BAR ── */}
              {isJobSearchLimited && (
                <div className="job-trial-banner">
                  <Zap size={13} color="#ffd700"/>
                  <span><strong>{jobResultsUsed} / {jobLimit === Infinity ? "∞" : jobLimit}</strong> job results used</span>
                  <div className="job-usage-track">
                    <div className="job-usage-fill" style={{
                      width:`${Math.min((jobResultsUsed/TRIAL_JOB_LIMIT)*100,100)}%`,
                      background: (jobLimitReached||derivedLimitReached) ? "#ff6b6b" : jobResultsUsed/jobLimit >= 0.8 ? "#ff9900" : "#ffd700",
                    }}/>
                  </div>
                  <a href="/billing">Upgrade for unlimited</a>
                </div>
              )}

              {/* ── SEARCH BAR or LIMIT GATE ── */}
              {isJobSearchLimited && (jobLimitReached || derivedLimitReached) ? (
                <div className="job-limit-banner">
                  <Lock size={14} color="#ff6b6b"/>
                  <span>You've used all <strong>20 job results</strong> in your trial.</span>
                  <a href="/billing" className="job-upgrade-link">Upgrade Now →</a>
                </div>
              ) : (
                <>
                  {/* ── SEARCH BAR ── */}
                  <div className="job-search-bar">
                    <div className="job-input-wrap">
                      <Search size={15} color="#8899bb" className="job-search-icon"/>
                      <input
                        className="job-input"
                        value={jobPrompt}
                        onChange={e => setJobPrompt(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleJobSearch()}
                        placeholder='e.g. "Software developer jobs in Lahore Pakistan", "React developer Karachi"'
                      />
                    </div>
                    <select
                      value={numJobResults}
                      onChange={e => setNumJobResults(Number(e.target.value))}
                      style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",color:"white",padding:"10px 12px",borderRadius:"10px",fontSize:"13px",cursor:"pointer",outline:"none",minWidth:"120px"}}
                    >
                      <option value={5}>5 results</option>
                      <option value={10}>10 results</option>
                      <option value={20}>20 results</option>
                      <option value={50}>50 results</option>
                    </select>
                    <button className="job-search-btn" onClick={handleJobSearch} disabled={jobLoading || !jobPrompt.trim()}>
                      {jobLoading
                        ? <><RefreshCw size={14} className="spin"/>Searching...</>
                        : <><Send size={14}/>Find Jobs</>
                      }
                    </button>
                  </div>

                  {/* Job error */}
                  {jobError && (
                    <div className="error-banner" style={{marginTop:"12px"}}>
                      <AlertTriangle size={14} color="#ff6b6b"/>{jobError}
                    </div>
                  )}
                </>
              )}

              {/* Job results */}
              {jobSearched && (
                <div className="job-results-section">
                  <div className="results-hdr" style={{marginBottom:"14px"}}>
                    <h2>
                      {jobLoading ? "Searching for jobs..."
                        : jobResults.length > 0
                          ? `${jobResults.length} job${jobResults.length !== 1 ? "s" : ""} found`
                          : !jobLimitReached ? "No jobs found" : ""}
                    </h2>
                  </div>

                  {jobLoading ? (
                    <div className="job-skeleton-list">
                      {[...Array(3)].map((_,i) => <div key={i} className="job-skeleton-card"/>)}
                    </div>
                  ) : jobResults.length === 0 && !jobError && !jobLimitReached ? (
                    <div className="no-results">
                      <Briefcase size={32} color="#8899bb" strokeWidth={1.4}/>
                      <p>No jobs found. Try rephrasing your search.</p>
                    </div>
                  ) : jobResults.length > 0 ? (
                    <>
                      <div className="job-list">
                        {jobResults.map(job => (
                          <div key={job.id} className="job-card">
                            <div className="job-card-left">
                              <div className="job-avatar">{job.company.charAt(0).toUpperCase()}</div>
                              <div className="job-info">
                                <h3 className="job-title">{job.title}</h3>
                                <div className="job-meta">
                                  <span className="job-meta-item"><Building2 size={11}/>{job.company}</span>
                                  {job.location && <span className="job-meta-item"><MapPin size={11}/>{job.location}</span>}
                                  {job.type && <span className="job-type-badge">{job.type}</span>}
                                  {job.salary && <span className="job-salary">{job.salary}</span>}
                                </div>
                                <p className="job-desc">{job.description}</p>
                                <div className="job-footer">
                                  {job.postedAt && <span className="job-posted"><Clock size={10}/>{job.postedAt}</span>}
                                  <span className="job-source">via {job.source}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:"8px",alignItems:"flex-end",flexShrink:0}}>
                              <a
                                href={job.applyUrl && job.applyUrl !== "#" ? job.applyUrl : undefined}
                                onClick={job.applyUrl && job.applyUrl !== "#"
                                  ? (e) => { e.preventDefault(); window.open(job.applyUrl, "_blank", "noopener,noreferrer"); }
                                  : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`job-apply-btn ${!job.applyUrl || job.applyUrl === "#" ? "btn-disabled" : ""}`}
                                style={!job.applyUrl || job.applyUrl === "#" ? {opacity:0.4, cursor:"not-allowed"} : {}}
                                title={`Apply on ${job.source}`}
                              >
                                Apply on {job.source} <ChevronRight size={14}/>
                              </a>
                              <button
                                onClick={() => handleSaveJob(job)}
                                disabled={savedJobIds.has(job.id) || savingJobId === job.id}
                                style={{
                                  display:"flex",alignItems:"center",gap:"6px",
                                  background: savedJobIds.has(job.id) ? "rgba(0,255,153,.12)" : "rgba(255,255,255,.05)",
                                  border: savedJobIds.has(job.id) ? "1px solid rgba(0,255,153,.3)" : "1px solid rgba(255,255,255,.1)",
                                  color: savedJobIds.has(job.id) ? "#00ff99" : "#8899bb",
                                  padding:"7px 14px",borderRadius:"8px",fontSize:"12px",
                                  cursor: savedJobIds.has(job.id) ? "default" : "pointer",
                                  transition:".2s",whiteSpace:"nowrap",
                                }}
                              >
                                <Bookmark size={12}/>
                                {savingJobId === job.id ? "Saving..." : savedJobIds.has(job.id) ? "Saved" : "Save Job"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {isJobSearchLimited && (
                        <div className="job-upgrade-nudge">
                          <Lock size={13} color="#a78bfa"/>
                          <span>
                            {jobLimitReached
                              ? <><strong>Trial limit reached.</strong> Upgrade for unlimited job searches.</>
                              : <><strong>{TRIAL_JOB_LIMIT - jobResultsUsed}</strong> trial results remaining.</>
                            }
                          </span>
                          <a href="/billing" className="job-upgrade-link">Upgrade now →</a>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      <style jsx>{`
        .main{
          margin-left:240px;
          padding:20px 24px;
          min-height:100vh;
          box-sizing:border-box;
          width:calc(100vw - 240px);
          overflow-x:hidden;
        }

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
        .page-header h1{font-size:22px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .header-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .result-badge{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;}
        .plan-chip{font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;border:1px solid;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}

        /* Limit banner */
        .limit-banner{display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#ff6b6b;}
        .limit-banner a{margin-left:6px;color:#ff6b6b;font-weight:600;}
        .limit-banner strong{color:#fff;}

        /* Filters */
        .filters-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px 20px;margin-bottom:20px;}
        .filters-title{display:flex;align-items:center;gap:8px;margin-bottom:16px;}
        .filters-title h3{font-size:14px;font-weight:600;}
        .filters-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;}
        .filter-group{display:flex;flex-direction:column;gap:5px;}
        .filter-group label{font-size:12px;color:#8899bb;font-weight:500;}
        .req{color:#ff6b6b;}
        .filter-group input,.filter-group select{
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.1);
          color:white;padding:8px 11px;
          border-radius:9px;font-size:13px;
          font-family:'Inter',sans-serif;
          transition:.2s;width:100%;box-sizing:border-box;
        }
        .filter-group input:focus,.filter-group select:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .filter-group select option{background:#081633;}

        .usage-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
        .usage-lbl{font-size:12px;color:#8899bb;white-space:nowrap;}
        .usage-track{flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden;}
        .usage-fill{height:100%;border-radius:5px;transition:width .4s ease;}

        .search-btn{display:flex;align-items:center;gap:8px;background:#00ff99;color:#020817;border:none;padding:10px 22px;border-radius:30px;font-size:14px;font-weight:700;cursor:pointer;transition:.2s;}
        .search-btn:hover:not(:disabled){background:#00cc66;}
        .search-btn:disabled{opacity:.6;cursor:not-allowed;}
        .spin{animation:spin .7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Error */
        .error-banner{display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:10px;padding:11px 15px;margin-bottom:16px;font-size:13px;color:#ff6b6b;}
        .error-banner a{margin-left:6px;color:#ff6b6b;font-weight:600;}

        /* Results */
        .results-section{margin-top:6px;}
        .results-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;}
        .results-hdr h2{font-size:15px;font-weight:600;}
        .saved-pill{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;font-size:12px;padding:5px 12px;border-radius:20px;text-decoration:none;}

        .skeleton-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
        .skeleton-card{height:240px;border-radius:14px;background:rgba(255,255,255,.04);animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}

        .no-results{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#8899bb;font-size:14px;text-align:center;}

        .results-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:14px;
          align-items:start;
          width:100%;
        }

        /* Lead Card */
        .lead-card{
          background:rgba(255,255,255,.03);
          border:1px solid rgba(255,255,255,.07);
          border-radius:14px;
          padding:16px;
          display:flex;
          flex-direction:column;
          gap:10px;
          transition:.2s;
          min-width:0;
          width:100%;
          box-sizing:border-box;
        }
        .lead-card:hover{border-color:rgba(0,255,153,.2);background:rgba(0,255,153,.03);}
        .lead-card.saved{border-color:rgba(0,255,153,.3);background:rgba(0,255,153,.04);}

        .card-top{display:flex;align-items:flex-start;gap:10px;}
        .company-avatar{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#00ff99,#004d33);color:#020817;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
        .company-info{flex:1;min-width:0;overflow:hidden;}
        .company-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}
        .industry-tag{font-size:10px;background:rgba(255,255,255,.07);color:#8899bb;padding:2px 7px;border-radius:8px;display:inline-block;margin-top:3px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .score-wrap{text-align:center;flex-shrink:0;}
        .score-circle{width:34px;height:34px;border-radius:50%;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.25);color:#00ff99;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .score-lbl{font-size:10px;color:#8899bb;margin-top:2px;display:block;}

        .priority-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .priority-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;}
        .rating{display:flex;align-items:center;gap:3px;font-size:11px;color:#ffd700;}
        .review-count{color:#8899bb;font-size:10px;}
        .cache-tag{display:flex;align-items:center;gap:3px;font-size:10px;color:#ffd700;background:rgba(255,215,0,.1);padding:2px 7px;border-radius:10px;}

        .contact-list{display:flex;flex-direction:column;gap:4px;}
        .contact-row{display:flex;align-items:center;gap:6px;font-size:11px;color:#8899bb;min-width:0;overflow:hidden;}
        .contact-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .contact-row a{color:#3b9eff;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;min-width:0;}
        .contact-row a:hover{text-decoration:underline;}

        .ai-insight{background:rgba(0,255,153,.04);border:1px solid rgba(0,255,153,.1);border-radius:9px;padding:8px 10px;}
        .insight-label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#00ff99;margin-bottom:4px;}
        .ai-insight p{font-size:11px;color:#8899bb;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0;}

        .card-actions{display:flex;gap:7px;margin-top:auto;}
        .save-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:9px;border:1px solid rgba(0,255,153,.25);background:rgba(0,255,153,.08);color:#00ff99;font-size:12px;font-weight:600;cursor:pointer;transition:.2s;white-space:nowrap;}
        .save-btn:hover:not(:disabled){background:rgba(0,255,153,.15);}
        .save-btn.saved{background:rgba(0,255,153,.15);color:#00ff99;cursor:default;}
        .save-btn:disabled{opacity:.7;}
        .li-btn{display:flex;align-items:center;gap:5px;padding:8px 12px;border-radius:9px;border:1px solid rgba(0,119,181,.3);background:rgba(0,119,181,.1);color:#0077b5;font-size:12px;font-weight:600;text-decoration:none;transition:.2s;white-space:nowrap;}
        .li-btn:hover{background:rgba(0,119,181,.2);}

        /* ══════════════════════════════════════════════════════════════ */
        /* JOB SEARCH STYLES                                             */
        /* ══════════════════════════════════════════════════════════════ */

        .job-section{
          margin-top:32px;
          background:rgba(255,255,255,.02);
          border:1px solid rgba(59,158,255,.15);
          border-radius:16px;
          padding:22px 22px 26px;
        }

        .job-section-header{margin-bottom:18px;}
        .job-section-title{display:flex;align-items:flex-start;gap:12px;}
        .job-icon-wrap{
          width:36px;height:36px;border-radius:10px;
          background:rgba(59,158,255,.1);border:1px solid rgba(59,158,255,.2);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;
        }
        .job-section-title h2{font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:4px;}
        .job-section-title p{font-size:13px;color:#8899bb;}
        .job-dev-notice{font-size:11px;color:#ffd700;margin-top:4px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);display:inline-block;padding:2px 10px;border-radius:20px;}
        .job-ai-badge{
          display:inline-flex;align-items:center;gap:4px;
          font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;
          background:rgba(59,158,255,.12);border:1px solid rgba(59,158,255,.25);color:#3b9eff;
        }
        .job-paid-badge{
          display:inline-flex;align-items:center;gap:4px;
          font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;
          background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.25);color:#a78bfa;
        }

        .job-gate-box{text-align:center;padding:50px 20px;max-width:420px;margin:8px auto;}
        .job-gate-icon{
          width:56px;height:56px;border-radius:50%;
          background:rgba(136,153,187,.1);border:1px solid rgba(136,153,187,.15);
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px;
        }
        .job-gate-box h3{font-size:18px;font-weight:600;margin-bottom:10px;}
        .job-gate-box p{color:#8899bb;font-size:13px;line-height:1.6;margin-bottom:20px;}

        .job-trial-banner{
          display:flex;align-items:center;gap:8px;
          background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.18);
          border-radius:10px;padding:10px 14px;margin-bottom:14px;
          font-size:13px;color:#ffd700;flex-wrap:wrap;
        }
        .job-trial-banner strong{color:#fff;}
        .job-trial-banner a{margin-left:auto;color:#ffd700;font-weight:600;font-size:12px;white-space:nowrap;}
        .job-trial-banner a:hover{text-decoration:underline;}
        .job-usage-track{flex:1;min-width:60px;height:4px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;}
        .job-usage-fill{height:100%;border-radius:4px;transition:width .4s ease;}

        .job-limit-banner{
          display:flex;align-items:center;gap:8px;
          background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);
          border-radius:10px;padding:12px 16px;margin-bottom:14px;
          font-size:13px;color:#ff6b6b;
        }
        .job-limit-banner strong{color:#fff;}
        .job-limit-banner a{margin-left:auto;white-space:nowrap;}

        .job-upgrade-nudge{
          display:flex;align-items:center;gap:8px;
          background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.18);
          border-radius:10px;padding:12px 16px;margin-top:14px;
          font-size:13px;color:#a78bfa;
        }
        .job-upgrade-nudge strong{color:#fff;}
        .job-upgrade-link{margin-left:auto;color:#a78bfa;font-weight:700;font-size:12px;white-space:nowrap;text-decoration:none;}
        .job-upgrade-link:hover{text-decoration:underline;}

        .job-search-bar{display:flex;gap:10px;align-items:center;}
        .job-input-wrap{
          flex:1;position:relative;display:flex;align-items:center;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
          border-radius:30px;padding:0 14px;transition:.2s;
        }
        .job-input-wrap:focus-within{border-color:rgba(59,158,255,.4);}
        .job-search-icon{flex-shrink:0;margin-right:8px;}
        .job-input{
          flex:1;background:transparent;border:none;outline:none;
          color:white;font-size:13px;font-family:'Inter',sans-serif;
          padding:10px 0;
        }
        .job-input::placeholder{color:#8899bb;}
        .job-search-btn{
          display:flex;align-items:center;gap:7px;
          background:#3b9eff;color:#fff;border:none;
          padding:10px 22px;border-radius:30px;
          font-size:14px;font-weight:700;cursor:pointer;transition:.2s;white-space:nowrap;
          flex-shrink:0;
        }
        .job-search-btn:hover:not(:disabled){background:#2280e0;}
        .job-search-btn:disabled{opacity:.6;cursor:not-allowed;}

        .job-results-section{margin-top:20px;}
        .job-skeleton-list{display:flex;flex-direction:column;gap:10px;}
        .job-skeleton-card{height:90px;border-radius:12px;background:rgba(255,255,255,.04);animation:pulse 1.4s ease infinite;}

        .job-list{display:flex;flex-direction:column;gap:10px;}
        .job-card{
          display:flex;align-items:center;justify-content:space-between;gap:14px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
          border-radius:12px;padding:14px 16px;transition:.2s;
        }
        .job-card:hover{border-color:rgba(59,158,255,.25);background:rgba(59,158,255,.03);}
        .job-card-left{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;}
        .job-avatar{
          width:38px;height:38px;border-radius:10px;flex-shrink:0;
          background:linear-gradient(135deg,#3b9eff,#0044aa);
          color:#fff;font-weight:800;font-size:15px;
          display:flex;align-items:center;justify-content:center;
        }
        .job-info{flex:1;min-width:0;}
        .job-title{font-size:13px;font-weight:600;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .job-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;}
        .job-meta-item{display:flex;align-items:center;gap:4px;font-size:11px;color:#8899bb;}
        .job-type-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;}
        .job-salary{font-size:11px;font-weight:600;color:#ffd700;}
        .job-desc{font-size:11px;color:#8899bb;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;}
        .job-footer{display:flex;align-items:center;gap:10px;}
        .job-posted{display:flex;align-items:center;gap:4px;font-size:10px;color:#8899bb;}
        .job-source{font-size:10px;color:#8899bb;background:rgba(255,255,255,.06);padding:2px 7px;border-radius:8px;}
        .job-apply-btn{
          display:flex;align-items:center;gap:4px;
          background:rgba(59,158,255,.12);border:1px solid rgba(59,158,255,.25);
          color:#3b9eff;font-size:12px;font-weight:700;
          padding:8px 16px;border-radius:9px;text-decoration:none;
          white-space:nowrap;transition:.2s;flex-shrink:0;
        }
        .job-apply-btn:hover{background:rgba(59,158,255,.22);color:#fff;}

        /* ── Responsive breakpoints ── */
        @media(max-width:1280px){
          .filters-grid{grid-template-columns:repeat(2,1fr);}
        }
        @media(max-width:1024px){
          .main{margin-left:240px;padding:16px 18px;width:calc(100vw - 240px);}
          .results-grid{gap:12px;}
          .lead-card{padding:14px;gap:9px;}
        }
        @media(max-width:900px){
          .main{margin-left:0;padding:14px;width:100vw;}
          .results-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
          .filters-grid{grid-template-columns:repeat(2,1fr);}
          .lead-card{padding:12px;gap:8px;}
          .filters-panel{padding:14px;}
          .page-header h1{font-size:20px;}
          .skeleton-grid{grid-template-columns:repeat(2,1fr);}
          .skeleton-card{height:180px;}
          .ai-insight p{-webkit-line-clamp:2;}
          .job-search-bar{flex-direction:column;}
          .job-search-btn{width:100%;justify-content:center;}
        }
        @media(max-width:600px){
          .main{padding:10px;width:100vw;}
          .results-grid{grid-template-columns:1fr;}
          .filters-grid{grid-template-columns:1fr;}
          .skeleton-grid{grid-template-columns:1fr;}
          .lead-card{padding:12px;gap:8px;}
          .company-name{font-size:12px;}
          .card-actions{flex-direction:column;}
          .li-btn{justify-content:center;}
          .ai-insight{display:none;}
          .job-card{flex-direction:column;align-items:flex-start;}
          .job-apply-btn{width:100%;justify-content:center;}
        }
      `}</style>
    </>
  );
}
