import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1d6b3e",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: { borderTopColor: "#e5e7eb" },
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#1a1a1a",
      }}
    >
      <Tabs.Screen
        name="tournaments"
        options={{
          title: "Tournaments",
          tabBarLabel: "Tournaments",
          tabBarIcon: ({ color }) => <TabIcon symbol="🏆" color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Submit Catch",
          tabBarLabel: "Submit",
          tabBarIcon: ({ color }) => <TabIcon symbol="🎣" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarLabel: "Standings",
          tabBarIcon: ({ color }) => <TabIcon symbol="📊" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  const { Text } = require("react-native") as typeof import("react-native");
  return <Text style={{ fontSize: 18, color }}>{symbol}</Text>;
}
