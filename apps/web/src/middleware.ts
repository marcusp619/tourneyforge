import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk Middleware + Tenant Resolution
 *
 * 1. Custom domain → Redis lookup (tenant_slug)
 * 2. Subdomain → {slug}.tourneyforge.com
 * 3. Null → platform marketing site
 */

// Protected routes that require auth
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const hostname = url.hostname;

  // Skip for API routes and static assets
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  // Check if this is a tenant subdomain
  // Format: {slug}.tourneyforge.com
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";

  if (hostname.endsWith(`.${rootDomain}`) && hostname !== `www.${rootDomain}`) {
    const subdomain = hostname.replace(`.${rootDomain}`, "").replace(`www.${rootDomain}`, "");

    if (subdomain && subdomain !== "www") {
      // This is a tenant subdomain - rewrite to tenant routes
      const newUrl = new URL(`/${subdomain}${url.pathname}`, req.url);

      // Add tenant slug header for downstream use
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-tenant-slug", subdomain);

      return NextResponse.rewrite(newUrl, {
        request: { headers: requestHeaders },
      });
    }
  }

  // Custom domain lookup would go here (Redis)
  // For now, skip custom domain resolution

  // Protect routes that require auth
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
