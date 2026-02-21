// ESLint 9 flat config — used by non-Next.js packages
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(...tseslint.configs.recommended, {
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
  },
});
