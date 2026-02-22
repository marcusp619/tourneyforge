"use client";

import { useState, useTransition } from "react";
import { aiVerifyCatch } from "@/actions/catches";

interface AiVerifyButtonProps {
  catchId: string;
  tournamentId: string;
  photoUrl: string;
  speciesName: string | null;
}

interface VerifyResult {
  isValidFish: boolean;
  detectedSpecies: string | null;
  confidence: "high" | "medium" | "low";
  estimatedWeightOz: number | null;
  estimatedLengthIn: number | null;
  notes: string;
  autoApproved: boolean;
}

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  low: { bg: "#fee2e2", text: "#991b1b" },
};

export function AiVerifyButton({ catchId, tournamentId, photoUrl, speciesName }: AiVerifyButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await aiVerifyCatch(catchId, tournamentId, photoUrl, speciesName ?? undefined);
        setResult(res);
        setShowResult(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI verification failed");
      }
    });
  }

  const colors = result ? (CONFIDENCE_COLORS[result.confidence] ?? CONFIDENCE_COLORS.low!) : null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleVerify}
        disabled={isPending}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition w-full disabled:opacity-50"
      >
        {isPending ? "Analyzing…" : "AI Verify"}
      </button>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {showResult && result && (
        <div
          className="mt-2 p-3 rounded-lg border text-xs space-y-1 min-w-[200px]"
          style={{ backgroundColor: colors?.bg, borderColor: colors?.text + "40" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold" style={{ color: colors?.text }}>
              {result.isValidFish ? "✓ Valid Catch" : "✗ Not a Valid Catch"}
            </span>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: colors?.text + "20", color: colors?.text }}
            >
              {result.confidence}
            </span>
          </div>

          {result.detectedSpecies && (
            <p style={{ color: colors?.text }}>
              Species: <strong>{result.detectedSpecies}</strong>
            </p>
          )}

          {(result.estimatedWeightOz ?? result.estimatedLengthIn) && (
            <p style={{ color: colors?.text }}>
              {result.estimatedWeightOz
                ? `~${(result.estimatedWeightOz / 16).toFixed(1)} lb`
                : ""}
              {result.estimatedWeightOz && result.estimatedLengthIn ? " · " : ""}
              {result.estimatedLengthIn ? `~${result.estimatedLengthIn}"` : ""}
            </p>
          )}

          <p className="text-gray-600 leading-relaxed">{result.notes}</p>

          {result.autoApproved && (
            <p className="font-semibold text-green-700 mt-1">Auto-approved and verified!</p>
          )}

          <button
            type="button"
            onClick={() => setShowResult(false)}
            className="text-gray-400 hover:text-gray-600 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
