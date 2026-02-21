"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible client component that refreshes the page on an interval
 * to pull updated leaderboard data during a live tournament.
 */
export default function LeaderboardRefresher({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [router, intervalSeconds]);

  return null;
}
