import { View, Text, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TourneyForge</Text>
      <Text style={styles.subtitle}>Fishing Tournament Management</Text>
      <Text style={styles.status}>Phase 0 setup in progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  status: {
    fontSize: 14,
    color: "#666",
  },
});
