"use client";

import { useState, useRef, useEffect } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = "966591060661"; // ← apna number yahan daalo
const WHATSAPP_MESSAGE = "Hello! I need to speak with a human agent from Fatila AI.";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

// ─── WhatsApp SVG ─────────────────────────────────────────────────────────────
function WaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 2px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#25D366",
          display: "inline-block",
          animation: `waDot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm Fatila AI assistant. How can I help you today?\n\nYou can ask me anything about our platform, pricing, or features!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // Add typing indicator
    setMessages(prev => [...prev, { role: "assistant", content: "", isTyping: true }]);

    try {
      const res = await fetch("/api/chat-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages
            .filter(m => !m.isTyping)
            .map(m => ({ role: m.role, content: m.content }))
            .concat({ role: "user", content: userMsg }),
        }),
      });

      const data = await res.json();

      // Replace typing indicator with real reply
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        { role: "assistant", content: data.reply || "Sorry, I couldn't process that. Please try again." },
      ]);
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        { role: "assistant", content: "⚠️ Something went wrong. Please try again or talk to our team directly." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openWhatsApp = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    window.open(url, "_blank");
  };

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(p => !p)}
        aria-label="Open chat"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9998,
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "#25D366",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(37,211,102,0.5)",
          color: "white",
          transition: "transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease",
          transform: open ? "scale(0.9)" : "scale(1)",
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = open ? "scale(0.9)" : "scale(1)";
        }}
      >
        {open ? (
          // Close X icon
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <WaIcon size={28} />
        )}
        {/* Pulse ring — only when closed */}
        {!open && (
          <span style={{
            position: "absolute",
            width: "100%", height: "100%",
            borderRadius: "50%",
            background: "rgba(37,211,102,0.3)",
            animation: "waPulse 2.2s ease-out infinite",
            pointerEvents: "none",
          }} />
        )}
      </button>

      {/* ── Chat Popup ── */}
      <div style={{
        position: "fixed",
        bottom: 100,
        right: 28,
        zIndex: 9997,
        width: 340,
        maxWidth: "calc(100vw - 40px)",
        borderRadius: 16,
        overflow: "hidden",
        background: "#06102a",
        border: "1px solid rgba(0,255,153,0.15)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,153,0.05)",
        display: "flex",
        flexDirection: "column",
        transition: "opacity 0.25s ease, transform 0.3s cubic-bezier(.34,1.56,.64,1)",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(0.96)",
        pointerEvents: open ? "auto" : "none",
      }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #128C7E, #25D366)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", flexShrink: 0,
          }}>
            <WaIcon size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Fatila AI Support</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#90EE90", display: "inline-block" }} />
              Online — typically replies instantly
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: 320,
          minHeight: 200,
          background: "#04102b",
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "82%",
                padding: "9px 13px",
                borderRadius: msg.role === "user"
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                background: msg.role === "user"
                  ? "rgba(37,211,102,0.18)"
                  : "rgba(255,255,255,0.07)",
                color: msg.role === "user" ? "#d0ffe0" : "#e0e8f0",
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {msg.isTyping ? <TypingDots /> : msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Talk to Human Banner */}
        <div style={{
          padding: "8px 12px",
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, color: "#8899bb" }}>Need a human agent?</span>
          <button
            onClick={openWhatsApp}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(37,211,102,0.12)",
              border: "1px solid rgba(37,211,102,0.25)",
              borderRadius: 20,
              color: "#25D366",
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,0.22)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,0.12)"}
          >
            <WaIcon size={12} />
            Talk to Human
          </button>
        </div>

        {/* Input */}
        <div style={{
          display: "flex",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#06102a",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "white",
              padding: "12px 14px",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? "#25D366" : "rgba(255,255,255,0.08)",
              border: "none",
              padding: "0 16px",
              cursor: input.trim() && !loading ? "pointer" : "default",
              color: input.trim() && !loading ? "white" : "#8899bb",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Global Keyframes ── */}
      <style>{`
        @keyframes waPulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          70%  { transform: scale(1.55); opacity: 0;   }
          100% { transform: scale(1.55); opacity: 0;   }
        }
        @keyframes waDot {
          0%, 60%, 100% { transform: translateY(0);   opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1;   }
        }
        @media (max-width: 480px) {
          /* Handled via inline maxWidth calc */
        }
      `}</style>
    </>
  );
}
