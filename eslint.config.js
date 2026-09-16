import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettier from "eslint-config-prettier";

// Node.js globals for build/tooling scripts (esbuild.config.js, vite.config.ts, ...)
const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "readonly",
  require: "readonly",
  Buffer: "readonly",
};

// Google Apps Script runtime globals (server packages only)
const gasGlobals = {
  Utilities: "readonly",
  DriveApp: "readonly",
  SpreadsheetApp: "readonly",
  PropertiesService: "readonly",
  HtmlService: "readonly",
  LockService: "readonly",
  Logger: "readonly",
  UrlFetchApp: "readonly",
  CacheService: "readonly",
  ScriptApp: "readonly",
  Session: "readonly",
  Browser: "readonly",
  console: "readonly",
};

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/*.tsbuildinfo",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  {
    // Repo-wide relaxed core rules: the codebase predates a working ESLint
    // setup, so keep the baseline behaviour (globals/types are checked by tsc).
    rules: {
      "no-undef": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-case-declarations": "off",
      // Intentional `while (true)` loops with explicit break/return are used widely.
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // GAS/global interop uses namespaces and broad `{}`/`Function` types.
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ["**/*.config.ts", "**/*.config.mts", "**/vite.shared.ts"],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ["packages/server/**/*.ts"],
    languageOptions: {
      globals: gasGlobals,
    },
  },
  {
    // Parse SFCs so template/script syntax errors are caught. Vue style rules
    // are intentionally left off in this PR and enabled in a follow-up.
    files: ["**/*.vue"],
    plugins: {
      vue,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
        sourceType: "module",
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  prettier,
];
