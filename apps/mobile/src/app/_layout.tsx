import { ClerkProvider, useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inProtected = segments[1] === "submit";
    if (!isSignedIn && inProtected) {
      router.replace("/sign-in");
    }
  }, [isSignedIn, isLoaded, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthGate />
        <Stack
          screenOptions={{ headerStyle: { backgroundColor: "#fff" }, headerTintColor: "#1a1a1a" }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tournament/[id]" options={{ title: "Tournament" }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign In", headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
