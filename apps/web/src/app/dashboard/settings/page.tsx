import { requireTenant } from "@/lib/tenant";
import { ThemeSettingsClient } from "./ThemeSettingsClient";

export const metadata = { title: "Settings | Dashboard" };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_connected: { label: "Not Connected", color: "#92400e", bg: "#fef3c7" },
  pending: { label: "Pending Verification", color: "#1e40af", bg: "#dbeafe" },
  active: { label: "Active", color: "#166534", bg: "#dcfce7" },
};

export default async function SettingsPage() {
  const { tenant } = await requireTenant();

  const stripeStatus = tenant.stripeAccountStatus ?? "not_connected";
  const statusCfg = STATUS_CONFIG[stripeStatus] ?? STATUS_CONFIG["not_connected"]!;
  const isConnected = stripeStatus === "active";

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your site appearance and payment settings.
        </p>
      </div>

      {/* Stripe Connect */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Stripe Payments</h2>
            <p className="text-sm text-gray-500">
              Connect your Stripe account to collect entry fees from anglers. Payments go directly
              to your account minus a small platform fee.
            </p>
          </div>
          <span
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full mt-1"
            style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {isConnected ? (
            <>
              <span className="text-sm text-gray-700 font-medium">
                Account ID:{" "}
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {tenant.stripeConnectedAccountId}
                </code>
              </span>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that redirects to Stripe, not a Next.js page */}
              <a href="/api/stripe/connect" className="text-sm font-medium text-blue-600 hover:underline">
                Reconnect
              </a>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that redirects to Stripe, not a Next.js page */}
              <a
                href="/api/stripe/connect"
                className="inline-block bg-[#635BFF] text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#5851ea] transition"
              >
                Connect with Stripe
              </a>
              <p className="text-xs text-gray-400">
                You will be redirected to Stripe to complete setup.
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400 border-t border-gray-100 pt-4">
          Platform fee:{" "}
          {tenant.plan === "free" ? "3.5%" :
           tenant.plan === "starter" ? "2.5%" :
           tenant.plan === "pro" ? "1.75%" : "1.5%"}{" "}
          per transaction on the{" "}
          <span className="font-semibold capitalize">{tenant.plan}</span> plan.
        </p>
      </section>

      {/* Theme & appearance (client component) */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Site & Theme</h2>
        <p className="text-gray-500 text-sm">
          Customize how your public tournament site looks to visitors.
        </p>
      </div>
      <ThemeSettingsClient />
    </div>
  );
}
