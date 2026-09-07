import { test, expect, type Page } from "@playwright/test";
import { tournamentIdByName, teamIdsByName, seedCatches } from "./fixtures/db";

/**
 * THE MONEY PATH: director creates a tournament -> anglers register -> the leaderboard
 * ranks them correctly. Every page is reached by clicking. No id is ever typed into a
 * URL, because if the test needs to know a uuid to get somewhere, a human would too —
 * and that is the defect this whole harness was built to catch.
 *
 * TWO THINGS THIS TEST DOES NOT PROVE, stated plainly rather than buried:
 *
 *  1. **Catch submission.** No web UI creates a catch — `apps/web/src/actions/catches.ts`
 *     exports only verifyCatch and deleteCatch. Catches here are inserted through a
 *     fixture. Task 18 closes this.
 *  2. **Payment.** Registration branches on entry fee: a paid tournament redirects to
 *     Stripe Checkout, which needs a live connected account. This test therefore creates
 *     a FREE tournament, and the Stripe leg of the money path is not exercised at all.
 *     Nothing offline can exercise it, and stubbing the network is forbidden here.
 *
 * The finishing order below is neither alphabetical nor registration order, so a
 * leaderboard that silently fell back to either would be visibly wrong rather than
 * accidentally right.
 */

const TENANT = "midwest-bass";
const TENANT_ORIGIN = `http://${TENANT}.localhost:3000`;

// registration order:  Alpha, Zebra, Midnight
// alphabetical order:  Alpha, Midnight, Zebra
// CORRECT BY WEIGHT:   Midnight, Zebra, Alpha   <- matches neither
const TEAMS = [
  { name: "Alpha Anglers", oz: [60, 55, 45] }, // 160
  { name: "Zebra Crew", oz: [70, 60, 50] }, //     180
  { name: "Midnight Runners", oz: [80, 65, 55] }, // 200
] as const;
const EXPECTED_ORDER = ["Midnight Runners", "Zebra Crew", "Alpha Anglers"] as const;

// The form's date fields are type="datetime-local", which accepts YYYY-MM-DDTHH:MM and
// rejects a bare date with "Malformed value".
function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 16);
}

async function fillDate(page: Page, name: string, value: string): Promise<void> {
  const field = page.locator(`[name="${name}"]`);
  await field.fill(value);
}

test("director creates a tournament, anglers register, the leaderboard ranks them", async ({
  page,
}) => {
  const tournamentName = `E2E Money Path ${Date.now()}`;

  // ---------------------------------------------------------------- director
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /tournaments/i }).first().click();
  await page.getByRole("link", { name: /new tournament/i }).first().click();

  await page.locator('[name="name"]').fill(tournamentName);
  await fillDate(page, "startDate", isoDate(7));
  await fillDate(page, "endDate", isoDate(8));
  await fillDate(page, "registrationDeadline", isoDate(5));
  await page.locator('[name="entryFee"]').fill("0"); // free: see the Stripe note above
  const format = page.locator('[name="scoringFormatId"]');
  await format.selectOption({ index: 1 });
  await page.getByRole("button", { name: /create|save|submit/i }).first().click();

  await expect(page.getByText(tournamentName).first()).toBeVisible();

  // A new tournament is created as `draft`, and the public tenant listing excludes
  // draft. The director must publish it — so the test clicks that too, rather than
  // reaching around the flow by flipping the status in the database.
  await page.getByRole("button", { name: /publish \(open for registration\)/i })
    .first()
    .click();
  await expect(page.getByText(/^Open$/).first()).toBeVisible();

  // ---------------------------------------------------------------- anglers
  for (const team of TEAMS) {
    await page.goto(TENANT_ORIGIN);
    await page.getByRole("link", { name: /tournaments/i }).first().click();
    // Reached by its NAME, not by a constructed /tournaments/<uuid> URL.
    await page.getByRole("link", { name: tournamentName }).first().click();
    // "Register Now", not /register/i — the site header also has a Register link
    // pointing at /sign-up, and .first() picked that instead. (On a tenant subdomain
    // /sign-up 404s, because the rewrite makes it /<slug>/sign-up. Recorded as a
    // finding; out of scope for this task.)
    await page.getByRole("link", { name: /register now/i }).first().click();
    await page.locator('[name="teamName"]').fill(team.name);
    await page.locator('[name="anglerName"]').fill(`${team.name} Captain`);
    await page.getByRole("button", { name: /register|complete/i }).first().click();
    await expect(page.getByText(/registered|success|confirmed/i).first()).toBeVisible();
  }

  // ------------------------------------------------- director starts the tournament
  // The public leaderboard link only renders once a tournament is `active` — it lives in
  // the "Tournament is Live!" block. So the director has to start it, by clicking.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /tournaments/i }).first().click();
  await page
    .getByRole("row", { name: new RegExp(tournamentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .getByRole("link", { name: /manage/i })
    .first()
    .click();
  await page.getByRole("button", { name: /start tournament/i }).first().click();
  await expect(page.getByText(/^Live$/).first()).toBeVisible();

  // ------------------------------------------------- catches (fixture — see note 1)
  const tournamentId = await tournamentIdByName(tournamentName);
  const teamIds = await teamIdsByName(tournamentId);
  expect(teamIds.size, "all three teams registered through the UI").toBe(3);
  for (const team of TEAMS) {
    const id = teamIds.get(team.name);
    expect(id, `team "${team.name}" was created by the browser`).toBeTruthy();
    await seedCatches(tournamentId, id!, [...team.oz]);
  }

  // ---------------------------------------------------------------- leaderboard
  await page.goto(TENANT_ORIGIN);
  await page.getByRole("link", { name: /tournaments/i }).first().click();
  await page.getByRole("link", { name: tournamentName }).first().click();
  await page.getByRole("link", { name: /leaderboard/i }).first().click();

  // Wait for the standings to actually render before reading the page. Clicking returns
  // as soon as navigation starts, and innerText on a half-rendered page produced a
  // failure that looked exactly like a missing team.
  await expect(page.getByText(EXPECTED_ORDER[0]).first()).toBeVisible();
  await expect(page.getByText(EXPECTED_ORDER[2]).first()).toBeVisible();

  // The whole ordered list, not merely "the winner is present". Asserting only the top
  // row passes on a leaderboard that is otherwise entirely wrong.
  const body = await page.locator("body").innerText();
  const positions = EXPECTED_ORDER.map((name) => body.indexOf(name));
  for (const [i, pos] of positions.entries()) {
    expect(pos, `"${EXPECTED_ORDER[i]}" appears on the leaderboard`).toBeGreaterThan(-1);
  }
  expect(positions, "teams appear in descending weight order").toEqual(
    [...positions].sort((a, b) => a - b)
  );
});
