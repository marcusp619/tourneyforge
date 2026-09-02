// eslint-config-next 16 ships a native flat config (a Linter.Config[]), so it is
// spread directly. The previous @eslint/eslintrc FlatCompat shim is for legacy
// eslintrc-style configs and throws "Converting circular structure to JSON" here.
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
];
