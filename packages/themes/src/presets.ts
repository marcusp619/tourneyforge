export interface ThemePreset {
  name: string;
  slug: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  fontFamily: string;
  heroStyle: "minimal" | "gradient" | "split";
}

export const themePresets: Record<string, ThemePreset> = {
  classic: {
    name: "Classic",
    slug: "classic",
    description: "Clean blue tones — timeless and professional",
    primaryColor: "#1d4ed8",
    accentColor: "#f59e0b",
    backgroundColor: "#ffffff",
    surfaceColor: "#f8fafc",
    textColor: "#0f172a",
    mutedTextColor: "#64748b",
    borderColor: "#e2e8f0",
    fontFamily: "Inter, system-ui, sans-serif",
    heroStyle: "minimal",
  },
  coastal: {
    name: "Coastal",
    slug: "coastal",
    description: "Ocean-inspired teal and aqua — fresh and inviting",
    primaryColor: "#0d9488",
    accentColor: "#f97316",
    backgroundColor: "#f0fdfa",
    surfaceColor: "#ccfbf1",
    textColor: "#134e4a",
    mutedTextColor: "#5eead4",
    borderColor: "#99f6e4",
    fontFamily: "Inter, system-ui, sans-serif",
    heroStyle: "gradient",
  },
  forest: {
    name: "Forest",
    slug: "forest",
    description: "Earthy greens — rugged and natural",
    primaryColor: "#166534",
    accentColor: "#ca8a04",
    backgroundColor: "#f0fdf4",
    surfaceColor: "#dcfce7",
    textColor: "#14532d",
    mutedTextColor: "#4ade80",
    borderColor: "#86efac",
    fontFamily: "'Merriweather', Georgia, serif",
    heroStyle: "minimal",
  },
  bold: {
    name: "Bold",
    slug: "bold",
    description: "High contrast red and black — aggressive and modern",
    primaryColor: "#dc2626",
    accentColor: "#fbbf24",
    backgroundColor: "#0a0a0a",
    surfaceColor: "#1a1a1a",
    textColor: "#fafafa",
    mutedTextColor: "#a1a1aa",
    borderColor: "#27272a",
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    heroStyle: "split",
  },
  sport: {
    name: "Sport",
    slug: "sport",
    description: "Energetic orange and charcoal — dynamic and competitive",
    primaryColor: "#ea580c",
    accentColor: "#0ea5e9",
    backgroundColor: "#ffffff",
    surfaceColor: "#fff7ed",
    textColor: "#1c1917",
    mutedTextColor: "#78716c",
    borderColor: "#fed7aa",
    fontFamily: "'Barlow', system-ui, sans-serif",
    heroStyle: "gradient",
  },
  midnight: {
    name: "Midnight",
    slug: "midnight",
    description: "Deep navy and silver — sophisticated and premium",
    primaryColor: "#3b82f6",
    accentColor: "#a78bfa",
    backgroundColor: "#0f172a",
    surfaceColor: "#1e293b",
    textColor: "#f1f5f9",
    mutedTextColor: "#94a3b8",
    borderColor: "#334155",
    fontFamily: "Inter, system-ui, sans-serif",
    heroStyle: "gradient",
  },
};

export const DEFAULT_PRESET_SLUG = "classic";
