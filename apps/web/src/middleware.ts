import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

/**
 * Clerk Middleware + Tenant Resolution
 *
 * 1. Custom domain → Redis lookup (`custom_domain:{host}` → tenantSlug)
 * 2. Subdomain → {slug}.tourneyforge.com  (or {slug}.localhost in local dev)
 * 3. Null → platform marketing site
 *
 * LOCAL_DEV=true bypasses Clerk auth enforcement so the app works without
 * real Clerk keys.  Tenant routing via *.localhost still works.
 */

const LOCAL_DEV = process.env.LOCAL_DEV === "true";

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

/**
 * Resolve tenant slug and inject x-tenant-slug header.
 * Returns a rewritten response when a tenant is resolved, or null to continue.
 */
async function resolveTenant(req: NextRequest): Promise<NextResponse | null> {
  const url = req.nextUrl;
  const hostname = url.hostname;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";

  // *.localhost — local dev subdomain routing (e.g. demo.localhost)
  if (hostname.endsWith(".localhost")) {
    const subdomain = hostname.replace(/\.localhost$/, "");
    if (subdomain && subdomain !== "www") {
      const newUrl = new URL(`/${subdomain}${url.pathname}`, req.url);
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-tenant-slug", subdomain);
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
    return null;
  }

  const isRootOrWww =
    hostname === rootDomain ||
    hostname === `www.${rootDomain}` ||
    hostname === "localhost";

  // Custom domain lookup via Redis
  if (!isRootOrWww && !hostname.endsWith(`.${rootDomain}`)) {
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

  // Subdomain routing: {slug}.tourneyforge.com
  if (hostname.endsWith(`.${rootDomain}`) && hostname !== `www.${rootDomain}`) {
    const subdomain = hostname.replace(`.${rootDomain}`, "");
    if (subdomain && subdomain !== "www") {
      const newUrl = new URL(`/${subdomain}${url.pathname}`, req.url);
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-tenant-slug", subdomain);
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;

  // Skip for API routes and static assets
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/static")
  ) {
    return NextResponse.next();
  }

  // Resolve tenant subdomain / custom domain
  const tenantResponse = await resolveTenant(req);
  if (tenantResponse) return tenantResponse;

  // Protect routes that require auth (skipped in LOCAL_DEV mode)
  if (!LOCAL_DEV && isProtectedRoute(req)) {
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
