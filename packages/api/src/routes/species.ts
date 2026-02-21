import { Hono } from "hono";
import { db, species } from "@tourneyforge/db";
import { eq, ilike } from "drizzle-orm";

export const speciesRouter = new Hono();

// Get all species (system-wide, no tenant scope)
speciesRouter.get("/", async (c) => {
  const search = c.req.query("q");

  let results;
  if (search) {
    results = await db
      .select()
      .from(species)
      .where(ilike(species.name, `%${search}%`));
  } else {
    results = await db.select().from(species);
  }

  return c.json({ data: results });
});

// Get a single species by ID
speciesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [s] = await db.select().from(species).where(eq(species.id, id)).limit(1);

  if (!s) {
    return c.json({ error: { code: "NOT_FOUND", message: "Species not found" } }, 404);
  }

  return c.json({ data: s });
});
