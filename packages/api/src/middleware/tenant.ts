import type { MiddlewareHandler } from "hono";
import { db, tenantMembers, users } from "@tourneyforge/db";
import { and, asc, eq } from "drizzle-orm";

/**
 * The tenant boundary.
 *
 * Before this file existed, every scoped route read `x-tenant-id` straight off the
 * request and scoped its queries to whatever it found. That is not a boundary: the
 * header is client-supplied and nothing authenticated it, so
 *
 *     curl -H 'x-tenant-id: <any club uuid>' localhost:3001/api/registrations
 *
 * read and wrote that club's data. The API had no Clerk import, no token
 * verification, and never once joined `tenant_members`.
 *
 * The rule now: **a route may not learn its tenant from the request.** It learns the
 * caller's identity from a verified session, and the tenant from that caller's rows in
 * `tenant_members`. `x-tenant-id` survives only as a *preference* for callers who
 * belong to more than one club, and it is checked against membership before it is
 * honoured — an id the caller is not a member of is a 403, never a silent fallback to
 * a club they do happen to belong to.
 *
 * Two middlewares, because the API has two kinds of caller:
 *   - `requireUser`  — an authenticated person. Anglers are this and nothing more;
 *                      they submit catches to clubs they are not members of.
 *   - `requireTenant` — a person acting *as* a club. Runs after `requireUser`.
 */

export type TenantRole = "owner" | "admin" | "member";

export type AuthVariables = {
  /** Internal `users.id` — not the Clerk id. */
  userId: string;
  /** Resolved from `tenant_members`. Never from the request. */
  tenantId: string;
  tenantRole: TenantRole;
};

export type TenantEnv = { Variables: AuthVariables };

/**
 * `LOCAL_DEV=true` assumes a fixed identity so the offline stack works without Clerk.
 * It assumes an *identity*, never a tenant — the tenant is still resolved from
 * membership below, so the offline stack exercises the same boundary production does.
 *
 * Read at call time rather than module load so tests can set it per-case.
 */
function localDevUserId(): string | null {
  if (process.env.LOCAL_DEV !== "true") return null;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LOCAL_DEV=true in a production build would disable authentication");
  }
  return process.env.LOCAL_DEV_USER_ID ?? "user-1";
}

/** Maps a verified Clerk subject to our own `users` row. Returns null if unknown. */
async function userIdForClerkId(clerkUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return row?.id ?? null;
}

async function resolveUserId(authorization: string | undefined): Promise<string | null> {
  const devUserId = localDevUserId();
  if (devUserId) {
    // Still a database lookup: a dev identity that is not a real user must fail like
    // any other unknown caller, or LOCAL_DEV becomes a way to be nobody in particular.
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, devUserId))
      .limit(1);
    return row?.id ?? null;
  }

  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  // Fail closed. An API with no configured verifier authenticates nobody; it must not
  // fall through to trusting the token.
  if (!secretKey) return null;

  try {
    const { verifyToken } = await import("@clerk/backend");
    const claims = await verifyToken(token, { secretKey });
    return claims.sub ? await userIdForClerkId(claims.sub) : null;
  } catch {
    return null;
  }
}

/** Establishes *who* is calling. Sets `userId`. 401 if the caller is anonymous. */
export const requireUser: MiddlewareHandler<TenantEnv> = async (c, next) => {
  const userId = await resolveUserId(c.req.header("authorization"));
  if (!userId) {
    return c.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
      401
    );
  }
  c.set("userId", userId);
  await next();
  return;
};

/**
 * Establishes *which club* the caller is acting as. Must run after `requireUser`.
 * Sets `tenantId` and `tenantRole`.
 */
export const requireTenant: MiddlewareHandler<TenantEnv> = async (c, next) => {
  const userId = c.get("userId");

  const memberships = await db
    .select({ tenantId: tenantMembers.tenantId, role: tenantMembers.role })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .orderBy(asc(tenantMembers.createdAt));

  if (memberships.length === 0) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Caller belongs to no tenant" } },
      403
    );
  }

  const requested = c.req.header("x-tenant-id");
  let membership;

  if (requested) {
    membership = memberships.find((m) => m.tenantId === requested);
    if (!membership) {
      // The whole point. A tenant id the caller cannot prove membership of is denied,
      // not quietly replaced with one they can.
      return c.json(
        { error: { code: "FORBIDDEN", message: "Not a member of the requested tenant" } },
        403
      );
    }
  } else if (memberships.length > 1) {
    // Choosing one silently would make which club got written to depend on row order.
    return c.json(
      {
        error: {
          code: "TENANT_REQUIRED",
          message: "Caller belongs to multiple tenants; specify x-tenant-id",
        },
      },
      400
    );
  } else {
    membership = memberships[0]!;
  }

  c.set("tenantId", membership.tenantId);
  c.set("tenantRole", membership.role);
  await next();
  return;
};

/**
 * True if the caller is a member of `tenantId`. For routes that are not themselves
 * tenant-scoped but still need to know whether the caller speaks for a club — see
 * catch submission, where a director may submit on an angler's behalf.
 */
export async function isTenantMember(userId: string, tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
    .limit(1);
  return row !== undefined;
}
