import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Palette, BarChart3, Store, ArrowRight, CheckCircle2 } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  const cards = [
    {
      label: "Tournaments",
      description: "Create and manage your fishing tournaments",
      href: "/dashboard/tournaments",
      cta: "Manage Tournaments",
      Icon: Trophy,
    },
    {
      label: "Site & Theme",
      description: "Customize your public site — colors, logo, tagline",
      href: "/dashboard/settings",
      cta: "Customize Site",
      Icon: Palette,
    },
    {
      label: "Analytics",
      description: "Registration trends, revenue, and catch analytics",
      href: "/dashboard/analytics",
      cta: "View Analytics",
      Icon: BarChart3,
    },
    {
      label: "Sponsor Marketplace",
      description: "Find brands looking to sponsor fishing tournaments",
      href: "/dashboard/marketplace",
      cta: "Browse Sponsors",
      Icon: Store,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground mt-1">
          Manage your tournaments and public site from here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        {cards.map((card) => {
          const Icon = card.Icon;
          return (
            <Card key={card.label} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{card.label}</CardTitle>
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={card.href}>
                    {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started</CardTitle>
          <CardDescription>Follow these steps to launch your first tournament</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              { step: "Customize your site — choose a theme and upload your logo", href: "/dashboard/settings", label: "Go to Settings" },
              { step: "Create your first tournament — set dates, divisions, and scoring format", href: "/dashboard/tournaments", label: "Create Tournament" },
              { step: "Share your tournament link with anglers to register" },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground flex-1">
                  {item.href ? (
                    <>
                      <Link href={item.href} className="font-medium text-foreground hover:underline">{item.label}</Link>
                      {" — "}{item.step.split("—")[1]}
                    </>
                  ) : item.step}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
