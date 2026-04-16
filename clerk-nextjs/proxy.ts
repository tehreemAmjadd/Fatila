import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pages jahan trial expire hone par redirect hoga
const PROTECTED_PAGES = [
  "/dashboard",
  "/ai-assistant",
  "/lead-search",
  "/saved-leads",
  "/analytics",
  "/emails",
  "/calls",
  "/tasks",
  "/export",
  "/meta-ads",
];

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const url = new URL(req.url);
  const pathname = url.pathname;

  // ✅ Skip checkout AND webhook (same as before)
  if (
    pathname === "/api/checkout" ||
    pathname === "/api/webhook" ||
    pathname === "/api/trial/start" ||
    pathname === "/api/get-user" ||
    pathname === "/billing" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up"
  ) {
    return;
  }

  // ✅ Protect APIs (same as before)
  if (pathname.startsWith("/api") && !userId) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${url.origin}/sign-in`,
      },
    });
  }

  // ✅ NEW: Trial expiry check for protected pages
  if (userId && PROTECTED_PAGES.some(p => pathname.startsWith(p))) {
    try {
      // Step 1: Clerk se user email lo
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      });
      const clerkUser = await clerkRes.json();
      const email = clerkUser.email_addresses?.[0]?.email_address;

      if (!email) return; // email na mile to block mat karo

      // Step 2: Hamari DB se user ka status check karo
      const userRes = await fetch(`${url.origin}/api/get-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const userData = await userRes.json();

      // Step 3: Trial expire ho gayi aur koi paid plan nahi → billing pe bhejo
      if (userData.isTrialExpired) {
        const redirectUrl = new URL("/billing", url.origin);
        redirectUrl.searchParams.set("reason", "trial_expired");
        return NextResponse.redirect(redirectUrl);
      }

    } catch (err) {
      // Koi error aaye to user ko block mat karo, aage jaane do
      console.error("proxy.ts trial check error:", err);
    }
  }
});

export const config = {
  matcher: [
    "/api(.*)",
    "/dashboard(.*)",
    "/ai-assistant(.*)",
    "/lead-search(.*)",
    "/saved-leads(.*)",
    "/analytics(.*)",
    "/emails(.*)",
    "/calls(.*)",
    "/tasks(.*)",
    "/export(.*)",
    "/meta-ads(.*)",
  ],
};