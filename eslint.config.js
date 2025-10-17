import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["src/server/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
      globals: {
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
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off", // Allow unused vars in GAS
      "no-undef": "off", // Disable no-undef for GAS globals
      "no-empty": "off", // Allow empty catch blocks
    },
  },
  {
    files: ["**/*.vue"],
    plugins: {
      vue,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      ...vue.configs["vue3-recommended"].rules,
      "vue/multi-word-component-names": "off",
    },
  },
  prettier,
];
