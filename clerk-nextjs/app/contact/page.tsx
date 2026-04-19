"use client";

import { useState } from "react";
import LegalLayout from "../../components/LegalLayout";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    topic: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      // Option 1: Formspree — replace YOUR_FORM_ID with your actual Formspree form ID
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

  const contactCards = [
    { icon: "📧", title: "General Inquiries", desc: "Questions about Fatila or our company.", email: "hello@fatilaai.com", time: "Within 1 business day" },
    { icon: "🛠️", title: "Customer Support", desc: "Technical issues, account help, how-to questions.", email: "support@fatilaai.com", time: "Within 24 hours" },
    { icon: "💳", title: "Billing & Refunds", desc: "Subscription questions, invoices, refund requests.", email: "billing@fatilaai.com", time: "Within 2 business days" },
    { icon: "🔒", title: "Privacy & Legal", desc: "Data requests, GDPR/CCPA inquiries, legal matters.", email: "privacy@fatilaai.com", time: "Within 30 days" },
    { icon: "🤝", title: "Partnerships", desc: "Integration partners, affiliates, media inquiries.", email: "partnerships@fatilaai.com", time: "Within 3 business days" },
    { icon: "🏢", title: "Enterprise Sales", desc: "Custom plans, API access, volume pricing.", email: "sales@fatilaai.com", time: "Within 1 business day" },
  ];

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
        <p>
          <strong>Headquarters / Registered Office:</strong>
          <br />
          Rawalpindi, Punjab
          <br />
          Islamic Republic of Pakistan
        </p>
        <p>
          <strong>Business Hours:</strong>
          <br />
          Monday – Friday: 9:00 AM – 6:00 PM (PKT / GMT+5)
          <br />
          Saturday – Sunday: Email support only
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

      <h2>Send Us a Message</h2>

      <form onSubmit={handleSubmit} className="bg-[rgba(255,255,255,0.04)] p-8 rounded-xl border border-[rgba(0,170,255,.2)] my-6 not-prose">
        <p className="text-[#cdd9ff] text-sm mb-6">Use the form below, and we'll route your message to the right team.</p>

        <div className="mb-5">
          <label className="block text-white font-semibold mb-2 text-sm">Your Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block text-white font-semibold mb-2 text-sm">Email Address *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block text-white font-semibold mb-2 text-sm">Company (Optional)</label>
          <input
            type="text"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block text-white font-semibold mb-2 text-sm">Topic *</label>
          <select
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all"
          >
            <option value="">— Select a topic —</option>
            <option value="general">General Inquiry</option>
            <option value="support">Technical Support</option>
            <option value="billing">Billing / Refund</option>
            <option value="privacy">Privacy / Data Request</option>
            <option value="partnership">Partnership</option>
            <option value="sales">Enterprise Sales</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-white font-semibold mb-2 text-sm">Your Message *</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={5}
            className="w-full px-4 py-3 rounded-lg bg-[rgba(7,25,65,0.6)] border border-[rgba(0,170,255,.25)] text-white focus:outline-none focus:border-[#39d353] focus:shadow-[0_0_12px_rgba(57,211,83,.2)] transition-all resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="px-9 py-3 rounded-[40px] font-semibold bg-gradient-to-r from-[#39d353] to-[#2fa4ff] text-[#081633] transition-transform duration-300 hover:scale-105 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "Sending..." : "Send Message"}
        </button>

        {status === "sent" && (
          <p className="mt-4 text-[#39d353] font-semibold">✓ Message sent successfully! We'll be in touch soon.</p>
        )}
        {status === "error" && (
          <p className="mt-4 text-red-400 font-semibold">✗ Something went wrong. Please email us directly at hello@fatilaai.com</p>
        )}

        <p className="text-xs text-[#9fb8e6] mt-5">
          By submitting this form, you agree to our <a href="/privacy" className="text-[#39d353] hover:underline">Privacy Policy</a>.
        </p>
      </form>
    </LegalLayout>
  );
}
