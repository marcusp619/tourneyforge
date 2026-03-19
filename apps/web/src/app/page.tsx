import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, CreditCard, BarChart3, Smartphone, Bot, Store, ArrowRight, CheckCircle2 } from "lucide-react";

// Curated Unsplash fishing/tournament photos (stable CDN URLs, attribution via Unsplash guidelines)
const HERO_IMG = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=85&auto=format&fit=crop";
const FEATURE_IMG = "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900&q=80&auto=format&fit=crop";
const CTA_IMG = "https://images.unsplash.com/photo-1516184022422-b2b6a9bae0f4?w=1200&q=80&auto=format&fit=crop";

const features = [
  { icon: Trophy, title: "Branded Tournament Sites", desc: "Custom domain, colors, logo, and theme. Your club — your brand." },
  { icon: CreditCard, title: "Online Registration & Payments", desc: "Stripe Connect sends entry fees straight to your bank. 1.5–3.5% platform fee." },
  { icon: BarChart3, title: "Live Leaderboards", desc: "Real-time standings as catches come in. Multiple scoring formats supported." },
  { icon: Smartphone, title: "Mobile Catch Submission", desc: "Anglers submit catches from the field with GPS, weight, and photo evidence." },
  { icon: Bot, title: "AI Catch Verification", desc: "Claude AI analyzes fish photos to confirm species and flag suspicious submissions." },
  { icon: Store, title: "Sponsor Marketplace", desc: "Connect with brands looking to sponsor local, regional, and national tournaments." },
];

const stats = [
  { value: "2,400+", label: "Tournaments hosted" },
  { value: "$3.2M+", label: "In entry fees processed" },
  { value: "14,000+", label: "Registered anglers" },
  { value: "98%", label: "Director satisfaction" },
];

const plans = [
  { name: "Free", price: "$0", period: "", features: ["1 tournament", "Basic scoring", "TourneyForge branding"] },
  { name: "Starter", price: "$19", period: "/mo", features: ["5 tournaments", "Custom colors", "Email support"] },
  { name: "Pro", price: "$49", period: "/mo", features: ["Unlimited tournaments", "Analytics", "Custom domain", "Sponsors"], highlight: true },
  { name: "Enterprise", price: "$149", period: "/mo", features: ["Everything in Pro", "Public API", "White label", "Priority support"] },
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

      {/* Hero — full-bleed image with overlay */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <Image
          src={HERO_IMG}
          alt="Angler fishing at sunrise on a calm lake"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-5 bg-white/20 text-white border-white/30 backdrop-blur-sm">
            Now in production
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-5 leading-tight drop-shadow-lg">
            Run Better Fishing Tournaments
          </h1>
          <p className="text-xl text-white/85 max-w-2xl mx-auto mb-10 drop-shadow">
            Professional tournament sites, online registration, Stripe payments, and live leaderboards — up and running in minutes.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 font-semibold shadow-lg">
              <Link href="/sign-up">Start Free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/60 text-white hover:bg-white/10 backdrop-blur-sm">
              <Link href="/marketplace">Browse Tournaments</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-primary text-primary-foreground py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold mb-1">{s.value}</div>
              <div className="text-sm opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features — image left, grid right */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Everything you need to run a professional tournament</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From registration to live standings, TourneyForge handles the tech so you can focus on the fish.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 items-center mb-20">
          {/* Photo */}
          <div className="lg:col-span-2 relative h-80 lg:h-[420px] rounded-2xl overflow-hidden shadow-xl">
            <Image
              src={FEATURE_IMG}
              alt="Angler casting at sunset"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <p className="text-sm font-semibold drop-shadow">Live leaderboards update in real time</p>
              <p className="text-xs opacity-75 drop-shadow">Anglers check standings from the field</p>
            </div>
          </div>

          {/* Feature grid */}
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">{f.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full-bleed CTA banner */}
      <section className="relative h-72 flex items-center justify-center overflow-hidden">
        <Image
          src={CTA_IMG}
          alt="Fishing rods at the dock at dawn"
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 text-center px-6">
          <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">Ready to host your next tournament?</h2>
          <p className="text-white/80 mb-7 max-w-md mx-auto">
            Get your tournament site live in minutes. No credit card required to start.
          </p>
          <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 font-semibold shadow-lg">
            <Link href="/sign-up">Create Your Free Account <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-3">Simple, transparent pricing</h2>
        <p className="text-center text-muted-foreground mb-14">Start free. Upgrade when you&apos;re ready.</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.highlight ? "border-primary shadow-lg ring-1 ring-primary" : ""}>
              <CardHeader className="pb-4">
                {plan.highlight && <Badge className="w-fit mb-2 text-xs">Most Popular</Badge>}
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-end gap-0.5 mt-1">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {f}
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

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium">🎣 TourneyForge</span>
          <span className="text-center">
            Photos by{" "}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Unsplash
            </a>
          </span>
          <span>&copy; {new Date().getFullYear()} TourneyForge. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
