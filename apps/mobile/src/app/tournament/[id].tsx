import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

interface TournamentDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  entryFee: number;
  maxTeams: number | null;
  scoringFormatType: string | null;
}

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

const STATUS_LABEL: Record<string, string> = {
  open: "Open for Registration",
  active: "Live Now 🔴",
  completed: "Completed",
  draft: "Coming Soon",
};

const STATUS_COLOR: Record<string, string> = {
  open: "#166534",
  active: "#1e40af",
  completed: "#6b7280",
  draft: "#854d0e",
};

const STATUS_BG: Record<string, string> = {
  open: "#dcfce7",
  active: "#dbeafe",
  completed: "#f3f4f6",
  draft: "#fef9c3",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(iso));
}

function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatScore(score: number, format: string): string {
  if (format === "weight") {
    const lbs = Math.floor(score / 16);
    const oz = (score % 16).toFixed(2);
    return `${lbs} lb ${oz} oz`;
  }
  if (format === "length") return `${score.toFixed(1)} in`;
  return `${score} fish`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [tRes, lRes] = await Promise.all([
        fetch(`${API_URL}/api/public/tournaments/${id}`),
        fetch(`${API_URL}/api/leaderboards/${id}`),
      ]);

      if (!tRes.ok) throw new Error(`Tournament not found (HTTP ${tRes.status})`);
      const tJson = (await tRes.json()) as { data: TournamentDetail };
      setTournament(tJson.data);

      if (lRes.ok) {
        const lJson = (await lRes.json()) as { data: LeaderboardData };
        setLeaderboard(lJson.data);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tournament");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tournament) {
      navigation.setOptions({ title: tournament.name });
    }
  }, [tournament, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d6b3e" />
      </View>
    );
  }

  if (error || !tournament) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Tournament not found"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[tournament.status] ?? "#6b7280";
  const statusBg = STATUS_BG[tournament.status] ?? "#f3f4f6";
  const scoringFormat = leaderboard?.tournament.scoringFormat ?? tournament.scoringFormatType ?? "weight";
  const topEntries = leaderboard?.leaderboard.slice(0, 5) ?? [];

  const registrationUrl = `${WEB_URL}/tournaments/${tournament.id}/register`;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: statusBg, alignSelf: "flex-start" }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </Text>
        </View>

        {/* Info cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Start Date</Text>
            <Text style={styles.infoValue}>{formatDate(tournament.startDate)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>End Date</Text>
            <Text style={styles.infoValue}>{formatDate(tournament.endDate)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Entry Fee</Text>
            <Text style={styles.infoValue}>{formatCents(tournament.entryFee)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Max Teams</Text>
            <Text style={styles.infoValue}>{tournament.maxTeams ?? "Unlimited"}</Text>
          </View>
        </View>

        {/* Description */}
        {tournament.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{tournament.description}</Text>
          </View>
        ) : null}

        {/* Scoring format */}
        {tournament.scoringFormatType ? (
          <View style={styles.formatRow}>
            <Text style={styles.formatLabel}>Scoring Format</Text>
            <Text style={styles.formatValue}>{tournament.scoringFormatType.charAt(0).toUpperCase() + tournament.scoringFormatType.slice(1)}</Text>
          </View>
        ) : null}

        {/* Registration deadline */}
        {tournament.registrationDeadline && tournament.status === "open" ? (
          <View style={styles.deadlineRow}>
            <Text style={styles.deadlineText}>
              ⏰ Registration closes {formatDate(tournament.registrationDeadline)}
            </Text>
          </View>
        ) : null}

        {/* Register button */}
        {tournament.status === "open" ? (
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => void Linking.openURL(registrationUrl)}
          >
            <Text style={styles.registerBtnText}>
              Register Now {tournament.entryFee > 0 ? `— ${formatCents(tournament.entryFee)}` : "— Free"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Leaderboard preview */}
        {topEntries.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {tournament.status === "active" ? "Live Standings" : "Final Results"}
              </Text>
              <Text style={styles.catchCount}>
                {leaderboard?.totalCatches ?? 0} catch{leaderboard?.totalCatches !== 1 ? "es" : ""}
              </Text>
            </View>
            {topEntries.map((entry) => (
              <View
                key={entry.teamId}
                style={[styles.entryRow, entry.rank === 1 && styles.entryRowFirst]}
              >
                <Text style={styles.entryMedal}>
                  {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
                </Text>
                <Text style={styles.entryTeam} numberOfLines={1}>{entry.teamName}</Text>
                <Text style={styles.entryScore}>{formatScore(entry.score, scoringFormat)}</Text>
              </View>
            ))}
          </View>
        ) : leaderboard !== null ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Standings</Text>
            <View style={styles.emptyStandings}>
              <Text style={styles.emptyStandingsIcon}>🎣</Text>
              <Text style={styles.emptyStandingsText}>No catches recorded yet</Text>
            </View>
          </View>
        ) : null}

        {/* Tournament ID (for catch submission) */}
        <View style={styles.idSection}>
          <Text style={styles.idLabel}>Tournament ID</Text>
          <Text style={styles.idValue} selectable>{id}</Text>
          <Text style={styles.idHint}>Copy this ID to submit a catch</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const GREEN = "#1d6b3e";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 14, color: "#dc2626", textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: GREEN, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  infoCard: { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  infoLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  description: { fontSize: 14, color: "#374151", lineHeight: 21 },
  formatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  formatLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  formatValue: { fontSize: 13, color: "#1a1a1a", fontWeight: "700" },
  deadlineRow: { backgroundColor: "#fef3c7", borderRadius: 10, padding: 12, marginBottom: 16 },
  deadlineText: { fontSize: 13, color: "#92400e", fontWeight: "600" },
  registerBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  catchCount: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 10 },
  entryRowFirst: { backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0, marginBottom: 4 },
  entryMedal: { fontSize: 20, width: 32, textAlign: "center" },
  entryTeam: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  entryScore: { fontSize: 14, fontWeight: "700", color: GREEN },
  emptyStandings: { alignItems: "center", paddingVertical: 16 },
  emptyStandingsIcon: { fontSize: 36, marginBottom: 8 },
  emptyStandingsText: { fontSize: 13, color: "#6b7280" },
  idSection: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 14, marginTop: 4 },
  idLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  idValue: { fontSize: 12, fontFamily: "monospace", color: "#374151", marginBottom: 4 },
  idHint: { fontSize: 11, color: "#9ca3af" },
});
