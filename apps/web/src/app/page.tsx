import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trophy, CreditCard, BarChart3, Smartphone, Bot, Store, ArrowRight } from "lucide-react";

const features = [
  { icon: Trophy, title: "Branded Tournament Sites", desc: "Custom domain, colors, logo, and theme. Your club — your brand." },
  { icon: CreditCard, title: "Online Registration & Payments", desc: "Stripe Connect sends entry fees straight to your bank. 1.5–3.5% platform fee." },
  { icon: BarChart3, title: "Live Leaderboards", desc: "Real-time standings as catches come in. Multiple scoring formats supported." },
  { icon: Smartphone, title: "Mobile Catch Submission", desc: "Anglers submit catches from the field with GPS, weight, and photo evidence." },
  { icon: Bot, title: "AI Catch Verification", desc: "Claude AI analyzes fish photos to confirm species and flag suspicious submissions." },
  { icon: Store, title: "Sponsor Marketplace", desc: "Connect with brands looking to sponsor local, regional, and national tournaments." },
];

const plans = [
  { name: "Free", price: "$0", features: ["1 tournament", "Basic scoring", "TourneyForge branding"] },
  { name: "Starter", price: "$19/mo", features: ["5 tournaments", "Custom colors", "Email support"], highlight: false },
  { name: "Pro", price: "$49/mo", features: ["Unlimited tournaments", "Analytics", "Custom domain", "Sponsors"], highlight: true },
  { name: "Enterprise", price: "$149/mo", features: ["Everything in Pro", "Public API", "White label", "Priority support"] },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>🎣</span> TourneyForge
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse Tournaments
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get Started Free</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <Badge variant="secondary" className="mb-4">Now in production</Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-5">
          Run Better Fishing Tournaments
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Professional tournament sites, online registration, Stripe payments, and live leaderboards — up and running in minutes.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button asChild size="lg">
            <Link href="/sign-up">Start Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace">Browse Tournaments</Link>
          </Button>
        </div>
      </section>

      <Separator />

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">Everything you need to run a professional tournament</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader className="pb-2">
                  <Icon className="h-5 w-5 text-muted-foreground mb-2" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.desc}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-3">Simple, transparent pricing</h2>
        <p className="text-center text-muted-foreground mb-12">Start free. Upgrade when you&apos;re ready.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.highlight ? "border-primary shadow-md" : ""}>
              <CardHeader>
                {plan.highlight && <Badge className="w-fit mb-2">Most Popular</Badge>}
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="text-2xl font-bold">{plan.price}</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="text-primary">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.highlight ? "default" : "outline"} size="sm" className="w-full">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <footer className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
        <span>🎣 TourneyForge</span>
        <span>&copy; {new Date().getFullYear()} TourneyForge. All rights reserved.</span>
      </footer>
    </div>
  );
}
