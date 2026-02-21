# TourneyForge Mobile

Expo SDK 52 mobile app for anglers.

## Setup

Install Expo CLI: `npm install -g expo-cli`

## Development

```bash
cd apps/mobile
pnpm dev      # Start Expo dev server
pnpm android  # Run on Android
pnpm ios      # Run on iOS (macOS only)
```

## Assets

Replace the placeholder assets in `assets/`:
- `icon.png` - 1024x1024 app icon
- `splash.png` - 1284x2778 splash screen
- `adaptive-icon.png` - 1024x1024 adaptive icon (Android)

For now, you can use `npx expo generate-assets` to generate defaults.
