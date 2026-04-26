"use client";

import { useState } from "react";
import LegalLayout from "../components/LegalLayout";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    topic: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Feedback form state
  const [feedbackData, setFeedbackData] = useState({
    name: "",
    email: "",
    rating: 0,
    category: "",
    message: "",
  });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFeedbackData({ ...feedbackData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const response = await fetch("https://formspree.io/f/YOUR_FORM_ID", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", company: "", topic: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackData.rating === 0) return;
    setFeedbackStatus("sending");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      if (response.ok) {
        setFeedbackStatus("sent");
        setFeedbackData({ name: "", email: "", rating: 0, category: "", message: "" });
      } else {
        setFeedbackStatus("error");
      }
    } catch {
      setFeedbackStatus("error");
    }
  };

  const contactCards = [
    { icon: "📧", title: "General Inquiries", desc: "Questions about Fatila or our company.", email: "info@ftisolutions.tech", time: "Within 3 business day" },
    { icon: "🛠️", title: "Customer Support", desc: "Technical issues, account help, how-to questions.", email: "info@ftisolutions.tech", time: "Within 3 business days" },
    { icon: "💳", title: "Billing & Refunds", desc: "Subscription questions, invoices, refund requests.", email: "info@ftisolutions.tech", time: "Within 3 business days" },
    { icon: "🔒", title: "Privacy & Legal", desc: "Data requests, GDPR/CCPA inquiries, legal matters.", email: "info@ftisolutions.tech", time: "Within 3 days" },
    { icon: "🤝", title: "Partnerships", desc: "Integration partners, affiliates, media inquiries.", email: "info@ftisolutions.tech", time: "Within 3 business days" },
    { icon: "🏢", title: "Enterprise Sales", desc: "Custom plans, API access, volume pricing.", email: "info@ftisolutions.tech", time: "Within 3 business day" },
  ];

  const starLabels = ["Terrible", "Poor", "Okay", "Good", "Excellent"];

  return (
    <LegalLayout title="Contact Us">
      <p>
        We're here to help. Whether you have a question about Fatila, need billing assistance, want to report an
        issue, or explore a partnership — our team is ready to listen.
      </p>

      <h2>Direct Contact Channels</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-8 not-prose">
        {contactCards.map((card) => (
          <div
            key={card.title}
            className="bg-[rgba(255,255,255,0.04)] p-6 rounded-xl border border-[rgba(0,170,255,.2)] hover:border-[#39d353] hover:shadow-[0_0_20px_rgba(57,211,83,.2)] transition-all duration-300"
          >
            <h3 className="text-[#39d353] font-semibold text-lg mb-2" style={{ color: "#39d353", marginTop: 0 }}>
              {card.icon} {card.title}
            </h3>
            <p className="text-[#cdd9ff] text-sm mb-3">{card.desc}</p>
            <p className="text-sm mb-1" style={{ marginBottom: "4px" }}>
              <strong style={{ color: "#fff" }}>Email:</strong>{" "}
              <a href={`mailto:${card.email}`} className="text-[#39d353]">{card.email}</a>
            </p>
            <p className="text-sm text-[#9fb8e6]" style={{ marginBottom: 0 }}>
              <strong style={{ color: "#fff" }}>Response:</strong> {card.time}
            </p>
          </div>
        ))}
      </div>

      <h2>Company Information</h2>
      <div className="highlight-box">
        <p>
          <strong>Fatila Techno Innovations</strong>
          <br />
          A multinational technology group with operations across Pakistan, UAE, Saudi Arabia, and Jordan.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Website:</strong> <a href="https://fatilaai.com">fatilaai.com</a>
          <br />
          <strong>Parent Company:</strong>{" "}
          <a href="https://ftisolutions.tech" target="_blank" rel="noopener noreferrer">
            Fatila Techno Innovations
          </a>
        </p>
      </div>

      {/* ── Feedback Form ── */}
      <h2>Leave Feedback</h2>
      <p>We'd love to hear what you think. Your feedback helps us improve Fatila for everyone.</p>

      <div className="bg-[rgba(255,255,255,0.04)] p-8 rounded-xl border border-[rgba(0,170,255,.2)] my-6 not-prose">
        {feedbackStatus === "sent" ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-[#39d353] text-xl font-semibold mb-2">Thank you for your feedback!</p>
            <p className="text-[#cdd9ff] text-sm">Your response has been recorded and helps us build a better product.</p>
            <button
              onClick={() => setFeedbackStatus("idle")}
              className="mt-6 px-6 py-2 rounded-[40px] text-sm font-semibold bg-[rgba(57,211,83,0.1)] border border-[#39d353] text-[#39d353] hover:bg-[rgba(57,211,83,0.2)] transition-all cursor-pointer"
            >
              Submit another response
            </button>
          </div>
        ) : (
          <>
            <p className="text-[#cdd9ff] text-sm mb-6">
              All fields are required. Your feedback is stored securely and only used to improve our services.
            </p>

            {/* Star Rating */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-3 text-sm">
                Overall Rating *
              </label>
              <div className="flex gap-2 items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackData({ ...feedbackData, rating: star })}
                    className="text-3xl transition-transform duration-150 hover:scale-125 cursor-pointer bg-transparent border-none p-0 leading-none"
                    aria-label={`Rate ${star} out of 5`}
                  >
                    <span className={star <= feedbackData.rating ? "text-yellow-400" : "text-[rgba(255,255,255,0.2)]"}>
                      ★
                    </span>
                  </button>
                ))}
                {feedbackData.rating > 0 && (
                  <span className="ml-3 text-[#9fb8e6] text-sm">
                    {starLabels[feedbackData.rating - 1]}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-white font-semibold mb-2 text-sm">Your Name *</label>
              <input
                type="text"
                name="name"
                value={feedbackData.name}
                onChange={handleFeedbackChange}
                required
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
              />
            </div>

            <div className="mb-5">
              <label className="block text-white font-semibold mb-2 text-sm">Email Address *</label>
              <input
                type="email"
                name="email"
                value={feedbackData.email}
                onChange={handleFeedbackChange}
                required
                placeholder="jane@example.com"
                className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
              />
            </div>

            <div className="mb-5">
              <label className="block text-white font-semibold mb-2 text-sm">Feedback Category *</label>
              <select
                name="category"
                value={feedbackData.category}
                onChange={handleFeedbackChange}
                required
                className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
              >
                <option value="">— Select a category —</option>
                <option value="ui">User Interface / Design</option>
                <option value="performance">Performance / Speed</option>
                <option value="features">Features & Functionality</option>
                <option value="pricing">Pricing & Plans</option>
                <option value="support">Customer Support</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-white font-semibold mb-2 text-sm">Your Feedback *</label>
              <textarea
                name="message"
                value={feedbackData.message}
                onChange={handleFeedbackChange}
                required
                rows={4}
                placeholder="Tell us what you love, what could be better, or anything else on your mind..."
                className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all resize-y"
              />
            </div>

            <button
              onClick={handleFeedbackSubmit}
              disabled={feedbackStatus === "sending" || feedbackData.rating === 0}
              className="px-9 py-3 rounded-[40px] font-semibold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {feedbackStatus === "sending" ? "Submitting..." : "Submit Feedback"}
            </button>

            {feedbackData.rating === 0 && (
              <p className="mt-3 text-[#9fb8e6] text-xs">Please select a star rating before submitting.</p>
            )}

            {feedbackStatus === "error" && (
              <p className="mt-4 text-red-400 font-semibold">
                ✗ Something went wrong. Please try again or email us at{" "}
                <a href="mailto:info@ftisolutions.tech" className="underline">info@ftisolutions.tech</a>.
              </p>
            )}

            <p className="text-xs text-[#9fb8e6] mt-5">
              By submitting, you agree to our{" "}
              <a href="/privacy" className="text-[#39d353] hover:underline">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </LegalLayout>
  );
}
