import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#fff" }, headerTintColor: "#1a1a1a" }}>
        <Stack.Screen name="index" options={{ title: "TourneyForge", headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tournament/[id]" options={{ title: "Tournament" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
