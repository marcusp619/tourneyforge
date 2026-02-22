"use client";

import { useState, useTransition, useRef } from "react";
import { themePresets } from "@tourneyforge/themes";
import { getLogoUploadUrl, saveLogoUrl, saveThemeSettings } from "@/actions/settings";

const PRESET_ORDER = ["classic", "coastal", "forest", "bold", "sport", "midnight"] as const;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-black/10 align-middle mr-1"
      style={{ backgroundColor: color }}
    />
  );
}

type Props = {
  tenantSlug: string;
  initialPreset: string;
  initialPrimary: string | null;
  initialAccent: string | null;
  initialTagline: string | null;
  initialLogoUrl: string | null;
};

export function ThemeSettingsClient({
  tenantSlug,
  initialPreset,
  initialPrimary,
  initialAccent,
  initialTagline,
  initialLogoUrl,
}: Props) {
  const [selectedPreset, setSelectedPreset] = useState(initialPreset || "classic");
  const [primaryColor, setPrimaryColor] = useState(initialPrimary ?? "");
  const [accentColor, setAccentColor] = useState(initialAccent ?? "");
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preset = themePresets[selectedPreset] ?? themePresets["classic"]!;
  const effectivePrimary = primaryColor || preset.primaryColor;
  const effectiveAccent = accentColor || preset.accentColor;

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
      setLogoError("Please choose a PNG, JPG, WebP, or SVG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("File must be under 5 MB.");
      return;
    }

    setLogoError("");
    setLogoUploading(true);

    try {
      const { uploadUrl, publicUrl } = await getLogoUploadUrl(file.type as AllowedType);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

      await saveLogoUrl(publicUrl);
      setLogoUrl(publicUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    setSaveError("");
    startTransition(async () => {
      try {
        await saveThemeSettings({
          themePreset: selectedPreset,
          primaryColor: primaryColor || null,
          accentColor: accentColor || null,
          tagline: tagline || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setSaveError("Failed to save. Please try again.");
      }
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
          Optionally override preset colors with your brand colors.
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
          A short line displayed on your public homepage hero section.
        </p>
        <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. The Midwest's Premier Bass Tournament Series" maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="mt-1 text-xs text-gray-400">{tagline.length}/200</p>
      </section>

      {/* Logo upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Logo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Shown in your site header and on the tournament marketplace. PNG, JPG, WebP, or SVG — up to 5 MB.
        </p>

        {logoUrl && (
          <div className="mb-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Current logo"
              className="h-16 w-auto max-w-[200px] rounded-lg border border-gray-200 object-contain bg-gray-50 p-2"
            />
            <p className="text-xs text-gray-400">{tenantSlug}.tourneyforge.com</p>
          </div>
        )}

        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
            logoUploading
              ? "opacity-60 cursor-not-allowed border-gray-200"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          {logoUploading ? (
            <p className="text-sm text-gray-500">Uploading…</p>
          ) : (
            <>
              <p className="text-3xl mb-2">{logoUrl ? "🔄" : "📁"}</p>
              <p className="text-sm text-gray-600 font-medium">
                {logoUrl ? "Click to replace logo" : "Click to upload logo"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, SVG · max 5 MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            disabled={logoUploading}
            onChange={handleLogoChange}
          />
        </label>

        {logoError && <p className="mt-2 text-sm text-red-600">{logoError}</p>}
      </section>

      {/* Live preview */}
      <section
        className="rounded-xl p-6 mb-6 text-white"
        style={{ background: `linear-gradient(135deg, ${effectivePrimary}, ${effectiveAccent})` }}
      >
        <h2 className="font-bold mb-1">Live Preview</h2>
        <p className="text-sm opacity-90">This is how your header gradient will look.</p>
        <div className="mt-3 inline-flex gap-3">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20">{preset.name} theme</span>
          {primaryColor && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20">Custom primary</span>}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Changes saved!</span>}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>
    </>
  );
}
