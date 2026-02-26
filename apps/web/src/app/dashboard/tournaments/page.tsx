import { requireTenant } from "@/lib/tenant";
import { db, tournaments } from "@tourneyforge/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateTournamentStatus } from "@/actions/tournaments";
import { Plus, Trophy } from "lucide-react";

const STATUS: Record<string, { label: string; variant: "success" | "info" | "warning" | "secondary" }> = {
  draft:     { label: "Draft",     variant: "secondary" },
  open:      { label: "Open",      variant: "success" },
  active:    { label: "Live",      variant: "info" },
  completed: { label: "Completed", variant: "secondary" },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default async function TournamentsPage() {
  const { tenant } = await requireTenant();

  const allTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.tenantId, tenant.id))
    .orderBy(desc(tournaments.createdAt));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tournaments</h1>
          <p className="text-muted-foreground mt-0.5">Manage your fishing tournaments</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tournaments/new">
            <Plus className="h-4 w-4" /> New Tournament
          </Link>
        </Button>
      </div>

      {allTournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No tournaments yet</CardTitle>
            <CardDescription className="mb-6">Create your first tournament to get started.</CardDescription>
            <Button asChild>
              <Link href="/dashboard/tournaments/new">
                <Plus className="h-4 w-4" /> Create Tournament
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTournaments.map((t) => {
                const s = STATUS[t.status] ?? STATUS.draft!;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/dashboard/tournaments/${t.id}`}
                          className="font-medium hover:underline"
                        >
                          {t.name}
                        </Link>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(t.startDate)}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/tournaments/${t.id}`}>Manage</Link>
                        </Button>
                        {t.status === "draft" && (
                          <form
                            action={async () => {
                              "use server";
                              await updateTournamentStatus(t.id, "open");
                            }}
                          >
                            <Button variant="outline" size="sm" type="submit">
                              Publish
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
