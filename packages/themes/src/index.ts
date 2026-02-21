import { createTamagui, createTokens } from "@tamagui/web";

// Define design tokens
const tokens = createTokens({
  color: {
    // Brand colors
    primary: "#0ea5e9",
    primaryHover: "#0284c7",
    primaryActive: "#0369a1",

    // Neutral colors
    white: "#ffffff",
    black: "#000000",

    // Semantic colors
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
  },
  radius: {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    6: 12,
    8: 16,
    12: 24,
  },
  fontSize: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 30,
    8: 36,
    9: 48,
    10: 60,
  },
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
  },
});

// Create Tamagui configuration
const tamaguiConfig = createTamagui({
  tokens,
  themes: {
    light: {
      bg: tokens.color.white,
      color: tokens.color.black,
      borderColor: "#e5e5e5",
      primary: tokens.color.primary,
      primaryHover: tokens.color.primaryHover,
      primaryActive: tokens.color.primaryActive,
    },
    dark: {
      bg: "#0a0a0a",
      color: "#ededed",
      borderColor: "#404040",
      primary: "#38bdf8",
      primaryHover: "#7dd3fc",
      primaryActive: "#bae6fd",
    },
  },
  defaultTheme: "light",
  shorthands: {
    px: "paddingHorizontal",
    py: "paddingVertical",
    pt: "paddingTop",
    pb: "paddingBottom",
    pl: "paddingLeft",
    pr: "paddingRight",
    mx: "marginHorizontal",
    my: "marginVertical",
    mt: "marginTop",
    mb: "marginBottom",
    ml: "marginLeft",
    mr: "marginRight",
    ta: "textAlign",
    w: "width",
    h: "height",
    minh: "minHeight",
    maxw: "maxWidth",
    maxh: "maxHeight",
    ai: "alignItems",
    jc: "justifyContent",
    fs: "fontSize",
    fw: "fontWeight",
    ff: "fontFamily",
    lh: "lineHeight",
    ls: "letterSpacing",
    br: "borderRadius",
    bw: "borderWidth",
    bc: "borderColor",
    bg: "backgroundColor",
    ov: "overflow",
    pos: "position",
    zIndex: "zIndex",
  },
  media: {
    sm: { maxWidth: 640 },
    md: { maxWidth: 768 },
    lg: { maxWidth: 1024 },
    xl: { maxWidth: 1280 },
    "2xl": { maxWidth: 1536 },
  },
});

export type TamaguiConfig = typeof tamaguiConfig;

// Augment the Tamagui types
declare module "@tamagui/web" {
  interface TamaguiCustomConfig extends TamaguiConfig {}
}

export default tamaguiConfig;
