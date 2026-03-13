import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface SpeciesOption {
  id: string;
  name: string;
  commonName: string | null;
}

interface TeamOption {
  id: string;
  name: string;
}

export default function SubmitCatchScreen() {
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [tournamentId, setTournamentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [speciesId, setSpeciesId] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [lengthIn, setLengthIn] = useState("");
  const [species, setSpecies] = useState<SpeciesOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [locating, setLocating] = useState(false);
  const [latitude, setLatitude] = useState<string | null>(null);
  const [longitude, setLongitude] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load species list
  useEffect(() => {
    fetch(`${API_URL}/api/species`)
      .then((r) => r.json())
      .then((j: { data: SpeciesOption[] }) => setSpecies(j.data ?? []))
      .catch(() => {/* best effort */});
  }, []);

  // Load teams when tournament ID changes
  useEffect(() => {
    if (tournamentId.length < 36) return;
    fetch(`${API_URL}/api/public/teams?tournamentId=${tournamentId}`)
      .then((r) => r.json())
      .then((j: { data: TeamOption[] }) => setTeams(j.data ?? []))
      .catch(() => setTeams([]));
  }, [tournamentId]);

  const getLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required for GPS tagging.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(String(loc.coords.latitude));
      setLongitude(String(loc.coords.longitude));
    } catch {
      Alert.alert("Error", "Could not get location. Please try again.");
    } finally {
      setLocating(false);
    }
  }, []);

  const pickPhoto = useCallback(async (source: "camera" | "library") => {
    const permissionResult =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        source === "camera"
          ? "Camera access is required to take a photo."
          : "Photo library access is required to select a photo."
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoUrl(null); // reset previous upload

    // Upload photo
    setUploadingPhoto(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "catch.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);

      const uploadRes = await fetch(`${API_URL}/api/uploads/catch-photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (uploadRes.ok) {
        const data = (await uploadRes.json()) as { url?: string };
        if (data.url) setPhotoUrl(data.url);
      }
      // If upload fails we still allow submission without a remote URL
    } catch {
      // best effort — photo submission can proceed without upload
    } finally {
      setUploadingPhoto(false);
    }
  }, [getToken]);

  const showPhotoPicker = useCallback(() => {
    Alert.alert("Add Photo", "Choose a photo source", [
      { text: "Camera", onPress: () => pickPhoto("camera") },
      { text: "Photo Library", onPress: () => pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickPhoto]);

  const handleSubmit = useCallback(async () => {
    if (!tournamentId || !teamId || !speciesId) {
      Alert.alert("Missing Fields", "Please fill in tournament ID, team, and species.");
      return;
    }
    const lbs = parseFloat(weightLbs || "0");
    const oz = parseFloat(weightOz || "0");
    const totalOz = lbs * 16 + oz;
    const length = parseFloat(lengthIn || "0");
    if (totalOz <= 0 && length <= 0) {
      Alert.alert("Missing Fields", "Please enter weight or length.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/catches`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tournamentId,
          teamId,
          speciesId,
          weight: totalOz,
          length,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          photoUrl: photoUrl ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      Alert.alert("Success! 🎣", "Your catch has been submitted and is pending verification.", [
        {
          text: "Submit Another",
          onPress: () => {
            setWeightLbs(""); setWeightOz(""); setLengthIn("");
            setSpeciesId(""); setLatitude(null); setLongitude(null);
            setPhotoUri(null); setPhotoUrl(null);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Submission Failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [tournamentId, teamId, speciesId, weightLbs, weightOz, lengthIn, latitude, longitude, photoUrl, getToken]);

  // Show sign-in wall if not authenticated
  if (isLoaded && !isSignedIn) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.authGate}>
          <Text style={styles.authGateIcon}>🎣</Text>
          <Text style={styles.authGateTitle}>Sign In to Submit</Text>
          <Text style={styles.authGateBody}>
            Sign in or create a free account to submit catches to your tournament.
          </Text>
          <TouchableOpacity style={styles.authGateBtn} onPress={() => router.push("/sign-in")}>
            <Text style={styles.authGateBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Submit a Catch</Text>

          {/* Tournament ID */}
          <View style={styles.field}>
            <Text style={styles.label}>Tournament ID *</Text>
            <TextInput
              style={styles.input}
              value={tournamentId}
              onChangeText={setTournamentId}
              placeholder="Paste tournament UUID"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Team */}
          {teams.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Team *</Text>
              <View style={styles.pills}>
                {teams.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.pill, teamId === t.id && styles.pillActive]}
                    onPress={() => setTeamId(t.id)}
                  >
                    <Text style={[styles.pillText, teamId === t.id && styles.pillTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {teams.length === 0 && tournamentId.length === 36 && (
            <View style={styles.field}>
              <Text style={styles.label}>Team ID *</Text>
              <TextInput
                style={styles.input}
                value={teamId}
                onChangeText={setTeamId}
                placeholder="Paste team UUID"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* Species */}
          {species.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Species *</Text>
              <View style={styles.pills}>
                {species.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pill, speciesId === s.id && styles.pillActive]}
                    onPress={() => setSpeciesId(s.id)}
                  >
                    <Text style={[styles.pillText, speciesId === s.id && styles.pillTextActive]}>
                      {s.commonName ?? s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Weight */}
          <View style={styles.field}>
            <Text style={styles.label}>Weight</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrap, { flex: 1, marginRight: 8 }]}>
                <TextInput
                  style={styles.inputInline}
                  value={weightLbs}
                  onChangeText={setWeightLbs}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.unit}>lbs</Text>
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <TextInput
                  style={styles.inputInline}
                  value={weightOz}
                  onChangeText={setWeightOz}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.unit}>oz</Text>
              </View>
            </View>
          </View>

          {/* Length */}
          <View style={styles.field}>
            <Text style={styles.label}>Length</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInline}
                value={lengthIn}
                onChangeText={setLengthIn}
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>inches</Text>
            </View>
          </View>

          {/* GPS */}
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            {latitude && longitude ? (
              <Text style={styles.gpsText}>
                📍 {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
              </Text>
            ) : (
              <TouchableOpacity style={styles.gpsBtn} onPress={getLocation} disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.gpsBtnText}>Get GPS Location</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Photo */}
          <View style={styles.field}>
            <Text style={styles.label}>Photo</Text>
            {photoUri ? (
              <View>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                {uploadingPhoto && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.photoOverlayText}>Uploading…</Text>
                  </View>
                )}
                {!uploadingPhoto && photoUrl && (
                  <Text style={styles.photoUploaded}>✓ Photo uploaded</Text>
                )}
                <TouchableOpacity style={styles.photoChangeBtn} onPress={showPhotoPicker}>
                  <Text style={styles.photoChangeBtnText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={showPhotoPicker}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || uploadingPhoto) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || uploadingPhoto}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Catch 🎣</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#1d6b3e";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1a1a1a" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14 },
  inputInline: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#1a1a1a" },
  unit: { fontSize: 13, color: "#6b7280", marginLeft: 4 },
  row: { flexDirection: "row" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db" },
  pillActive: { backgroundColor: GREEN, borderColor: GREEN },
  pillText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  gpsBtn: { backgroundColor: "#6b7280", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  gpsText: { fontSize: 13, color: "#166534", fontWeight: "500" },
  photoBtn: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#d1d5db", borderStyle: "dashed", borderRadius: 12, paddingVertical: 24, alignItems: "center", gap: 8 },
  photoBtnIcon: { fontSize: 32 },
  photoBtnText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  photoPreview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },
  photoOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 200, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", gap: 8 },
  photoOverlayText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  photoUploaded: { fontSize: 12, color: "#166534", fontWeight: "600", marginBottom: 6 },
  photoChangeBtn: { alignSelf: "flex-start" },
  photoChangeBtnText: { fontSize: 13, color: "#6b7280", textDecorationLine: "underline" },
  submitBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  authGate: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  authGateIcon: { fontSize: 64, marginBottom: 16 },
  authGateTitle: { fontSize: 24, fontWeight: "800", color: "#1a1a1a", marginBottom: 10 },
  authGateBody: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  authGateBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  authGateBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
