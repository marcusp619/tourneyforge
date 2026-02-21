import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  details: Record<string, number>;
}

interface LeaderboardData {
  tournament: { id: string; name: string; status: string; scoringFormat: string };
  leaderboard: LeaderboardEntry[];
  totalCatches: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const LIVE_POLL_MS = 15_000; // 15 seconds for live tournaments

function formatScore(score: number, format: string): string {
  if (format === "weight") {
    const lbs = Math.floor(score / 16);
    const oz = (score % 16).toFixed(1);
    return lbs > 0 ? `${lbs} lb ${oz} oz` : `${oz} oz`;
  }
  if (format === "length") return `${score.toFixed(1)}"`;
  return `${score} fish`;
}

export default function LeaderboardScreen() {
  const [tournamentId, setTournamentId] = useState("");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async (id: string, silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leaderboards/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: LeaderboardData };
      setData(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Start/stop live polling
  useEffect(() => {
    if (data?.tournament.status === "active" && tournamentId) {
      pollRef.current = setInterval(() => { void fetch_(tournamentId, true); }, LIVE_POLL_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [data?.tournament.status, tournamentId, fetch_]);

  const handleLoad = useCallback(() => {
    void fetch_(tournamentId.trim());
  }, [tournamentId, fetch_]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={tournamentId}
          onChangeText={setTournamentId}
          placeholder="Paste tournament ID…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleLoad}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleLoad} disabled={loading}>
          <Text style={styles.searchBtnText}>Load</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1d6b3e" />
        </View>
      )}

      {error && !loading && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {data && !loading && (
        <>
          {/* Tournament header */}
          <View style={styles.tournamentHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tournamentName} numberOfLines={1}>{data.tournament.name}</Text>
              <Text style={styles.catchCount}>{data.totalCatches} catches recorded</Text>
            </View>
            {data.tournament.status === "active" && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            )}
          </View>

          {data.leaderboard.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🎣</Text>
              <Text style={styles.emptyText}>No catches yet</Text>
            </View>
          ) : (
            <FlatList
              data={data.leaderboard}
              keyExtractor={(e) => e.teamId}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); void fetch_(tournamentId, false); }}
                  tintColor="#1d6b3e"
                />
              }
              renderItem={({ item }) => {
                const medal = MEDALS[item.rank - 1] ?? null;
                const isFirst = item.rank === 1;
                return (
                  <View style={[styles.card, isFirst && styles.cardFirst]}>
                    <View style={styles.rankCol}>
                      {medal ? (
                        <Text style={styles.medal}>{medal}</Text>
                      ) : (
                        <Text style={styles.rankNum}>{item.rank}</Text>
                      )}
                    </View>
                    <View style={styles.teamCol}>
                      <Text style={styles.teamName} numberOfLines={1}>{item.teamName}</Text>
                      <Text style={styles.catchesText}>
                        {item.details["catchCount"] ?? 0} {(item.details["catchCount"] ?? 0) === 1 ? "catch" : "catches"}
                      </Text>
                    </View>
                    <Text style={[styles.score, isFirst && styles.scoreFirst]}>
                      {formatScore(item.score, data.tournament.scoringFormat)}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {!data && !loading && !error && (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>Enter a tournament ID to view standings</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  searchBar: { flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  searchInput: { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#1a1a1a" },
  searchBtn: { backgroundColor: "#1d6b3e", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tournamentHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tournamentName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  catchCount: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  liveDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: "#16a34a" },
  liveText: { fontSize: 12, fontWeight: "700", color: "#166534" },
  list: { padding: 12, gap: 8 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  cardFirst: { borderColor: "#1d6b3e", borderWidth: 2 },
  rankCol: { width: 36, alignItems: "center" },
  medal: { fontSize: 22 },
  rankNum: { fontSize: 16, fontWeight: "700", color: "#9ca3af" },
  teamCol: { flex: 1, minWidth: 0 },
  teamName: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  catchesText: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  score: { fontSize: 15, fontWeight: "800", color: "#1d6b3e" },
  scoreFirst: { color: "#1d6b3e" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 14, color: "#dc2626", textAlign: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
});
