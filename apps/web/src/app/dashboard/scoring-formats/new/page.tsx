import Link from "next/link";
import { createScoringFormat } from "@/actions/scoring-formats";

export const metadata = { title: "New Scoring Format | Dashboard" };

export default function NewScoringFormatPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/dashboard/scoring-formats" className="text-gray-400 hover:text-gray-600">
          ← Scoring Formats
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">New Scoring Format</h1>
      </div>

      <form action={createScoringFormat} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
              Format Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. 5-Fish Weight Limit"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="type">
              Scoring Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              name="type"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="weight">Weight — sum of top fish by weight (lbs)</option>
              <option value="length">Length (CPR) — sum of top fish by length (inches)</option>
              <option value="count">Count — total number of fish caught</option>
              <option value="custom">Custom — define your own rules</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="fishLimit">
                Fish Limit
              </label>
              <input
                id="fishLimit"
                name="fishLimit"
                type="number"
                min="1"
                max="100"
                placeholder="e.g. 5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Max fish counted per team</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="minimumSize">
                Minimum Size
              </label>
              <input
                id="minimumSize"
                name="minimumSize"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">In lbs (weight) or inches (length/count)</p>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1.5"
              htmlFor="deadFishPenalty"
            >
              Dead Fish Penalty (lbs)
            </label>
            <input
              id="deadFishPenalty"
              name="deadFishPenalty"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 0.25"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Weight deducted per dead fish (weight format only)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="requirePhoto"
              name="requirePhoto"
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="requirePhoto" className="text-sm font-medium text-gray-700">
              Require photo for each catch
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Create Format
          </button>
          <Link
            href="/dashboard/scoring-formats"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
