import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

/**
 * Clerk Middleware + Tenant Resolution
 *
 * 1. Custom domain → Redis lookup (`custom_domain:{host}` → tenantSlug)
 * 2. Subdomain → {slug}.tourneyforge.com
 * 3. Null → platform marketing site
 */

// Protected routes that require auth
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
]);

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const hostname = url.hostname;

  // Skip for API routes and static assets
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";

  // 1. Custom domain lookup via Redis
  const isRootOrWww =
    hostname === rootDomain ||
    hostname === `www.${rootDomain}` ||
    hostname === "localhost";

  if (!isRootOrWww && !hostname.endsWith(`.${rootDomain}`)) {
    // Not a subdomain of our root — treat as potential custom domain
    const redis = getRedis();
    if (redis) {
      try {
        const tenantSlug = await redis.get<string>(`custom_domain:${hostname}`);
        if (tenantSlug) {
          const newUrl = new URL(`/${tenantSlug}${url.pathname}`, req.url);
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set("x-tenant-slug", tenantSlug);
          return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
        }
      } catch {
        // Redis unavailable — fall through to normal routing
      }
    }
  }

  // 2. Subdomain routing: {slug}.tourneyforge.com
  if (hostname.endsWith(`.${rootDomain}`) && hostname !== `www.${rootDomain}`) {
    const subdomain = hostname.replace(`.${rootDomain}`, "");

    if (subdomain && subdomain !== "www") {
      const newUrl = new URL(`/${subdomain}${url.pathname}`, req.url);
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-tenant-slug", subdomain);
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
  }

  // 3. Protect routes that require auth
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
