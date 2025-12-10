// eslint.config.js

import js from "@eslint/js";
import globals from "globals";

export default [
  // 1) Ignore generated / vendor stuff
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "logs/**",
      "coverage/**",
    ],
  },

  // 2) Main project config
  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node globals: process, Buffer, etc.
        ...globals.node,
      },
    },

    // Start from eslint:recommended rules
    rules: {
      ...js.configs.recommended.rules,

      // Your tweaks
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": "off", // you use Winston but console in scripts is fine
    },
  },
];
