import { requireTenant } from "@/lib/tenant";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { updateCustomDomain, generateApiKey, revokeApiKey } from "@/actions/settings";
import { SUBSCRIPTION_LIMITS } from "@tourneyforge/types";

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

  const limits = SUBSCRIPTION_LIMITS[tenant.plan];
  const canCustomDomain = limits.customDomain;

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

      {/* Custom Domain */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Custom Domain</h2>
            <p className="text-sm text-gray-500">
              Point your own domain (e.g. <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">tournaments.yourclub.com</code>) to your TourneyForge site.
              Set a CNAME record pointing to <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">cname.tourneyforge.com</code>.
            </p>
          </div>
          {!canCustomDomain && (
            <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 mt-1">
              Pro Feature
            </span>
          )}
        </div>

        {canCustomDomain ? (
          <form action={updateCustomDomain} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="customDomain">
                Domain
              </label>
              <input
                id="customDomain"
                name="customDomain"
                type="text"
                defaultValue={tenant.customDomain ?? ""}
                placeholder="tournaments.yourclub.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            Custom domains are available on the <strong>Pro</strong> and <strong>Enterprise</strong> plans.{" "}
            <a href="#upgrade" className="underline font-medium">Upgrade your plan</a> to unlock this feature.
          </div>
        )}

        {canCustomDomain && tenant.customDomain && (
          <p className="mt-3 text-xs text-gray-500">
            Current domain:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">{tenant.customDomain}</code>.
            {" "}Save an empty value to remove the custom domain.
          </p>
        )}
      </section>

      {/* Public API Access */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Public API Access</h2>
            <p className="text-sm text-gray-500">
              Use your API key to query tournament data, leaderboards, and registrations
              programmatically. Authenticate requests with the{" "}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">x-api-key</code> header.
            </p>
          </div>
          {!limits.apiAccess && (
            <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 mt-1">
              Enterprise
            </span>
          )}
        </div>

        {limits.apiAccess ? (
          <>
            {tenant.apiKey ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Your API Key</p>
                  <code className="block w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 break-all">
                    {tenant.apiKey}
                  </code>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Keep this key secret. Anyone with it can read all your tournament data.
                </p>
                <div className="flex gap-3">
                  <form action={generateApiKey}>
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Rotate Key
                    </button>
                  </form>
                  <form action={revokeApiKey}>
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                    >
                      Revoke Key
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <form action={generateApiKey}>
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
                >
                  Generate API Key
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 text-sm text-purple-800">
            Public API access is available on the <strong>Enterprise</strong> plan.
          </div>
        )}
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
