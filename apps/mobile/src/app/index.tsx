import { Redirect } from "expo-router";

// Root redirects straight to the tabs navigator
export default function Index() {
  return <Redirect href="/(tabs)/tournaments" />;
}
