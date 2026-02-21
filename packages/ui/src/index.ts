// Re-export Tamagui theme
import "@tourneyforge/themes";
export type { TamaguiConfig } from "@tourneyforge/themes";
export { default as tamaguiConfig } from "@tourneyforge/themes";

// Core Tamagui components (includes react-native-web)
export * from "@tamagui/core";
