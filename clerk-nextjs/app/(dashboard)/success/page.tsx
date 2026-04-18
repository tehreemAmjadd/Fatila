"use client";

export default function Success() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#020817",
        color: "#00ff99",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>✅ Payment Successful!</h1>
      <p style={{ fontSize: "18px", marginBottom: "30px", color: "#ccc" }}>
        Thank you for subscribing. You can now access your plan features.
      </p>
      <a
        href="/dashboard"
        style={{
          padding: "12px 25px",
          borderRadius: "25px",
          background: "#00ff99",
          color: "#081633",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}