"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Star, MessageSquare, Filter, Trash2, RefreshCw } from "lucide-react";

interface Feedback {
  id: string;
  name: string;
  email: string;
  rating: number;
  category: string;
  message: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  ui: "UI / Design",
  performance: "Performance",
  features: "Features",
  pricing: "Pricing",
  support: "Support",
  other: "Other",
};

const RATING_COLORS = ["", "#ff4d4d", "#ff9900", "#ffd700", "#99dd33", "#00ff99"];

export default function AdminFeedbackPage() {
  const { user } = useUser();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(0);

  const email = user?.primaryEmailAddress?.emailAddress;

  // Check admin access
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((u) => {
        if (u?.role !== "admin") {
          router.push("/dashboard");
        } else {
          setIsAdmin(true);
        }
      });
  }, [email]);

  // Fetch feedbacks
  const fetchFeedbacks = () => {
    setLoading(true);
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((data) => {
        setFeedbacks(data.feedbacks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) fetchFeedbacks();
  }, [isAdmin]);

  const filtered = feedbacks.filter((f) => {
    const catMatch = filter === "all" || f.category === filter;
    const ratingMatch = ratingFilter === 0 || f.rating === ratingFilter;
    return catMatch && ratingMatch;
  });

  const avgRating =
    feedbacks.length > 0
      ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
      : "—";

  const ratingCounts = [1, 2, 3, 4, 5].map(
    (r) => feedbacks.filter((f) => f.rating === r).length
  );

  if (!isAdmin && !loading) return null;

  return (
    <div className="main">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MessageSquare size={22} style={{ color: "#00ff99" }} />
            User Feedback
          </h1>
          <p className="page-sub">All feedback submitted from the Contact page</p>
        </div>
        <button className="refresh-btn" onClick={fetchFeedbacks}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-num">{feedbacks.length}</span>
          <span className="stat-label">Total Responses</span>
        </div>
        <div className="stat-card">
          <span className="stat-num" style={{ color: "#ffd700" }}>
            {avgRating} <Star size={14} style={{ display: "inline", verticalAlign: "middle" }} />
          </span>
          <span className="stat-label">Avg Rating</span>
        </div>
        {[5, 4, 3].map((r) => (
          <div className="stat-card" key={r}>
            <span className="stat-num" style={{ color: RATING_COLORS[r] }}>
              {ratingCounts[r - 1]}
            </span>
            <span className="stat-label">{"★".repeat(r)} Reviews</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="filter-group">
          <Filter size={13} style={{ color: "#8899bb" }} />
          <span className="filter-label">Category:</span>
          {["all", "ui", "performance", "features", "pricing", "support", "other"].map((c) => (
            <button
              key={c}
              className={`filter-btn ${filter === c ? "active" : ""}`}
              onClick={() => setFilter(c)}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Rating:</span>
          {[0, 5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              className={`filter-btn ${ratingFilter === r ? "active" : ""}`}
              onClick={() => setRatingFilter(r)}
              style={r > 0 ? { color: RATING_COLORS[r] } : {}}
            >
              {r === 0 ? "All" : "★".repeat(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading feedback...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={40} style={{ color: "#8899bb", marginBottom: 12 }} />
          <p>No feedback found</p>
        </div>
      ) : (
        <div className="feedback-grid">
          {filtered.map((f) => (
            <div key={f.id} className="feedback-card">
              <div className="card-top">
                <div className="user-info">
                  <div className="avatar">{f.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="user-name">{f.name}</div>
                    <div className="user-email">{f.email}</div>
                  </div>
                </div>
                <div className="card-meta">
                  <span className="rating-badge" style={{ color: RATING_COLORS[f.rating] }}>
                    {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                  </span>
                  <span className="cat-badge">{CATEGORY_LABELS[f.category] || f.category}</span>
                </div>
              </div>
              <p className="card-message">{f.message}</p>
              <div className="card-footer">
                <span className="card-date">
                  {new Date(f.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .main { padding: 28px 24px; min-height: 100vh; }

        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .page-title { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 700; color: white; margin-bottom: 4px; }
        .page-sub { color: #8899bb; font-size: 13px; }

        .refresh-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; background: rgba(0,255,153,.08); border: 1px solid rgba(0,255,153,.2); color: #00ff99; font-size: 13px; cursor: pointer; transition: .2s; }
        .refresh-btn:hover { background: rgba(0,255,153,.15); }

        .stats-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-card { background: rgba(255,255,255,.04); border: 1px solid rgba(0,255,153,.1); border-radius: 12px; padding: 16px 20px; min-width: 110px; }
        .stat-num { display: block; font-size: 24px; font-weight: 700; color: #00ff99; }
        .stat-label { font-size: 11px; color: #8899bb; margin-top: 2px; display: block; }

        .filters-row { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 12px; padding: 14px 16px; }
        .filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .filter-label { color: #8899bb; font-size: 12px; margin-right: 4px; }
        .filter-btn { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,.1); background: none; color: #8899bb; font-size: 12px; cursor: pointer; transition: .2s; }
        .filter-btn:hover { border-color: rgba(0,255,153,.3); color: #00ff99; }
        .filter-btn.active { background: rgba(0,255,153,.1); border-color: rgba(0,255,153,.4); color: #00ff99; }

        .loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; color: #8899bb; }
        .spinner { width: 32px; height: 32px; border: 2px solid rgba(0,255,153,.2); border-top-color: #00ff99; border-radius: 50%; animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { text-align: center; padding: 60px; color: #8899bb; }

        .feedback-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
        .feedback-card { background: rgba(255,255,255,.04); border: 1px solid rgba(0,255,153,.1); border-radius: 14px; padding: 18px; transition: .2s; }
        .feedback-card:hover { border-color: rgba(0,255,153,.25); box-shadow: 0 0 20px rgba(0,255,153,.05); }

        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,255,153,.15); border: 1px solid rgba(0,255,153,.3); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #00ff99; flex-shrink: 0; }
        .user-name { font-size: 14px; font-weight: 600; color: white; }
        .user-email { font-size: 11px; color: #8899bb; }

        .card-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
        .rating-badge { font-size: 13px; letter-spacing: 1px; }
        .cat-badge { font-size: 10px; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: #cdd9ff; }

        .card-message { font-size: 13px; color: #cdd9ff; line-height: 1.6; margin-bottom: 12px; }
        .card-footer { display: flex; justify-content: flex-end; }
        .card-date { font-size: 11px; color: #8899bb; }

        @media (max-width: 600px) {
          .main { padding: 16px 12px; }
          .stats-row { gap: 8px; }
          .stat-card { min-width: 80px; padding: 12px; }
          .feedback-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
