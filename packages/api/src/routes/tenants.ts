import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { tenants } from "@tourneyforge/db";
import { createTenantSchema, updateTenantSchema } from "@tourneyforge/validators";

export const tenantRouter = new Hono();

// Get all tenants (admin only - will add auth middleware later)
tenantRouter.get("/", async (c) => {
  const allTenants = await db.select().from(tenants);
  return c.json({ data: allTenants });
});

// Get tenant by slug
tenantRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const tenant = await db.select().from(tenants).where(eq(tenants.slug, slug));

  if (!tenant.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  return c.json({ data: tenant[0] });
});

// Create tenant
tenantRouter.post("/", zValidator("json", createTenantSchema), async (c) => {
  const body = c.req.valid("json");
  const newTenant = await db.insert(tenants).values(body).returning();
  return c.json({ data: newTenant[0] }, 201);
});

// Update tenant
tenantRouter.patch("/:id", zValidator("json", updateTenantSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const updated = await db.update(tenants).set(body).where(eq(tenants.id, id)).returning();

  if (!updated.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  return c.json({ data: updated[0] });
});

import { eq } from "drizzle-orm";
