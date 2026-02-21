import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Mode = "sign-in" | "sign-up" | "verify";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!signInLoaded || !signIn) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        router.replace("/(tabs)/tournaments");
      } else {
        Alert.alert("Error", "Sign in incomplete. Please try again.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed. Check your credentials.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  }, [signIn, signInLoaded, email, password, setSignInActive, router]);

  const handleSignUp = useCallback(async () => {
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign up failed.";
      Alert.alert("Sign Up Failed", msg);
    } finally {
      setLoading(false);
    }
  }, [signUp, signUpLoaded, email, password]);

  const handleVerify = useCallback(async () => {
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        router.replace("/(tabs)/tournaments");
      } else {
        Alert.alert("Error", "Verification incomplete. Please try again.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code. Please try again.";
      Alert.alert("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  }, [signUp, signUpLoaded, code, setSignUpActive, router]);

  if (mode === "verify") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.logoRow}>
              <Text style={styles.logo}>🎣</Text>
              <Text style={styles.appName}>TourneyForge</Text>
            </View>
            <Text style={styles.heading}>Check Your Email</Text>
            <Text style={styles.subheading}>
              We sent a 6-digit code to {email}. Enter it below to verify your account.
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                textAlign="center"
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify Email</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode("sign-up")}>
              <Text style={styles.linkText}>Back to sign up</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <Text style={styles.logo}>🎣</Text>
            <Text style={styles.appName}>TourneyForge</Text>
          </View>

          <Text style={styles.heading}>
            {mode === "sign-in" ? "Welcome Back" : "Create Account"}
          </Text>
          <Text style={styles.subheading}>
            {mode === "sign-in"
              ? "Sign in to submit catches and track your tournament performance."
              : "Create an account to submit catches and join tournaments."}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "sign-in" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {mode === "sign-in" ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.switchLink}>
                {mode === "sign-in" ? "Sign Up" : "Sign In"}
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.skipRow}>
            <Text style={styles.skipText}>Continue without signing in →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#1d6b3e";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 28, paddingTop: 48, paddingBottom: 48 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
  logo: { fontSize: 36 },
  appName: { fontSize: 24, fontWeight: "800", color: "#1a1a1a" },
  heading: { fontSize: 28, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  subheading: { fontSize: 14, color: "#6b7280", lineHeight: 21, marginBottom: 32 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: "#1a1a1a" },
  codeInput: { fontSize: 24, fontWeight: "700", letterSpacing: 8, paddingVertical: 16 },
  primaryBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 16 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  switchRow: { alignItems: "center", marginBottom: 16 },
  switchText: { fontSize: 14, color: "#6b7280" },
  switchLink: { color: GREEN, fontWeight: "700" },
  linkText: { fontSize: 14, color: GREEN, fontWeight: "600", textAlign: "center", marginTop: 8 },
  skipRow: { alignItems: "center", marginTop: 8 },
  skipText: { fontSize: 13, color: "#9ca3af" },
});
