"use client";

import { useState, useTransition } from "react";
import { themePresets } from "@tourneyforge/themes";

// Theme preset slugs available to all plans
const PRESET_ORDER = ["classic", "coastal", "forest", "bold", "sport", "midnight"] as const;

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-black/10 align-middle mr-1"
      style={{ backgroundColor: color }}
    />
  );
}

export function ThemeSettingsClient() {
  const [selectedPreset, setSelectedPreset] = useState("classic");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [tagline, setTagline] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const preset = themePresets[selectedPreset] ?? themePresets["classic"]!;

  const effectivePrimary = primaryColor || preset.primaryColor;
  const effectiveAccent = accentColor || preset.accentColor;

  function handleSave() {
    startTransition(async () => {
      // In production this would call PATCH /api/tenants/:id/theme
      // For now, just simulate a save
      await new Promise((r) => setTimeout(r, 500));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <>
      {/* Theme preset picker */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Theme Preset</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose a base theme. You can override colors below.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESET_ORDER.map((slug) => {
            const p = themePresets[slug]!;
            const isSelected = selectedPreset === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setSelectedPreset(slug)}
                className="text-left rounded-xl border-2 p-4 transition"
                style={{
                  borderColor: isSelected ? effectivePrimary : "#e5e7eb",
                  backgroundColor: p.backgroundColor,
                }}
              >
                <div className="flex gap-1 mb-3">
                  <span className="flex-1 h-2 rounded-full" style={{ backgroundColor: p.primaryColor }} />
                  <span className="flex-1 h-2 rounded-full" style={{ backgroundColor: p.accentColor }} />
                  <span className="flex-1 h-2 rounded-full" style={{ backgroundColor: p.surfaceColor }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: p.textColor }}>{p.name}</p>
                <p className="text-xs mt-0.5" style={{ color: p.mutedTextColor, opacity: 0.8 }}>{p.description}</p>
                {isSelected && (
                  <span className="mt-2 inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.primaryColor }}>
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Color overrides */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Color Overrides</h2>
        <p className="text-sm text-gray-500 mb-5">
          Optionally override the preset colors with your brand colors.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="primary-color">
              Primary Color <ColorSwatch color={effectivePrimary} />
              <span className="text-gray-400 text-xs font-normal ml-1">(preset: {preset.primaryColor})</span>
            </label>
            <div className="flex items-center gap-2">
              <input id="primary-color" type="color" value={primaryColor || preset.primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder={preset.primaryColor} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {primaryColor && <button type="button" onClick={() => setPrimaryColor("")} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="accent-color">
              Accent Color <ColorSwatch color={effectiveAccent} />
              <span className="text-gray-400 text-xs font-normal ml-1">(preset: {preset.accentColor})</span>
            </label>
            <div className="flex items-center gap-2">
              <input id="accent-color" type="color" value={accentColor || preset.accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
              <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder={preset.accentColor} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {accentColor && <button type="button" onClick={() => setAccentColor("")} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>}
            </div>
          </div>
        </div>
      </section>

      {/* Tagline */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Tagline</h2>
        <p className="text-sm text-gray-500 mb-4">
          A short marketing line displayed on your public homepage hero section.
        </p>
        <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. The Midwest's Premier Bass Tournament Series" maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="mt-1 text-xs text-gray-400">{tagline.length}/200</p>
      </section>

      {/* Logo upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Logo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload your organization logo. Shown in the site header. PNG, JPG, or SVG, up to 5 MB.
        </p>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">🎣</p>
          <p className="text-sm text-gray-500 mb-3">No logo uploaded yet</p>
          <label className="inline-block cursor-pointer">
            <span className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">Choose File</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" />
          </label>
        </div>
      </section>

      {/* Live preview */}
      <section className="rounded-xl p-6 mb-6 text-white" style={{ background: `linear-gradient(135deg, ${effectivePrimary}, ${effectiveAccent})` }}>
        <h2 className="font-bold mb-1">Live Preview</h2>
        <p className="text-sm opacity-90">This is how your header gradient will look with the current colors.</p>
        <div className="mt-3 inline-flex gap-3">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20">{preset.name} theme</span>
          {primaryColor && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20">Custom primary</span>}
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={handleSave} disabled={isPending} className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Changes saved!</span>}
      </div>
    </>
  );
}
