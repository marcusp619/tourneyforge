import { themePresets, DEFAULT_PRESET_SLUG } from "./presets";
export type { ThemePreset } from "./presets";
export { themePresets, DEFAULT_PRESET_SLUG };

// Re-export Tamagui config for backward compat (used by @tourneyforge/ui)
export type { TamaguiConfig } from "./tamagui";
export { default } from "./tamagui";

export interface TenantThemeInput {
  themePreset?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
}

export interface ResolvedTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  fontFamily: string;
  heroStyle: "minimal" | "gradient" | "split";
  presetSlug: string;
}

/**
 * Resolve a tenant's effective theme by merging the chosen preset
 * with any per-tenant overrides stored on the tenant record.
 */
export function resolveTheme(tenant: TenantThemeInput): ResolvedTheme {
  const presetSlug = tenant.themePreset ?? DEFAULT_PRESET_SLUG;
  const preset = themePresets[presetSlug] ?? themePresets[DEFAULT_PRESET_SLUG]!;

  return {
    primaryColor: tenant.primaryColor ?? preset.primaryColor,
    accentColor: tenant.accentColor ?? preset.accentColor,
    backgroundColor: preset.backgroundColor,
    surfaceColor: preset.surfaceColor,
    textColor: preset.textColor,
    mutedTextColor: preset.mutedTextColor,
    borderColor: preset.borderColor,
    fontFamily: tenant.fontFamily ?? preset.fontFamily,
    heroStyle: preset.heroStyle,
    presetSlug,
  };
}

/**
 * Generate inline CSS custom properties string from a resolved theme.
 * Use as the `style` prop on a root element.
 */
export function themeToCssVars(theme: ResolvedTheme): Record<string, string> {
  return {
    "--color-primary": theme.primaryColor,
    "--color-accent": theme.accentColor,
    "--color-bg": theme.backgroundColor,
    "--color-surface": theme.surfaceColor,
    "--color-text": theme.textColor,
    "--color-muted": theme.mutedTextColor,
    "--color-border": theme.borderColor,
    "--font-family": theme.fontFamily,
  };
}
