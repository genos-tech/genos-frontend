import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist"] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended, prettierConfig],
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        plugins: {
            react: react,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            "simple-import-sort": simpleImportSort,
            prettier: prettier,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "prettier/prettier": "error",
            // JSX and React sorting rules
            "react/jsx-sort-props": [
                "error",
                {
                    callbacksLast: true,
                    shorthandFirst: false,
                    shorthandLast: true,
                    multiline: "last",
                    ignoreCase: true,
                    reservedFirst: true,
                },
            ],
            // Object property sorting
            "sort-keys": [
                "error",
                "asc",
                {
                    caseSensitive: false,
                    natural: true,
                    minKeys: 3,
                },
            ],
            // TypeScript sorting rules
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/member-ordering": [
                "error",
                {
                    default: [
                        // Index signature
                        "signature",
                        "call-signature",
                        // Fields
                        "public-static-field",
                        "protected-static-field",
                        "private-static-field",
                        "#private-static-field",
                        "public-decorated-field",
                        "protected-decorated-field",
                        "private-decorated-field",
                        "public-instance-field",
                        "protected-instance-field",
                        "private-instance-field",
                        "#private-instance-field",
                        "public-abstract-field",
                        "protected-abstract-field",
                        "public-field",
                        "protected-field",
                        "private-field",
                        "#private-field",
                        "static-field",
                        "instance-field",
                        "abstract-field",
                        "decorated-field",
                        "field",
                        // Static initialization
                        "static-initialization",
                        // Constructors
                        "public-constructor",
                        "protected-constructor",
                        "private-constructor",
                        "constructor",
                        // Getters and Setters
                        ["public-static-get", "public-static-set"],
                        ["protected-static-get", "protected-static-set"],
                        ["private-static-get", "private-static-set"],
                        ["#private-static-get", "#private-static-set"],
                        ["public-decorated-get", "public-decorated-set"],
                        ["protected-decorated-get", "protected-decorated-set"],
                        ["private-decorated-get", "private-decorated-set"],
                        ["public-instance-get", "public-instance-set"],
                        ["protected-instance-get", "protected-instance-set"],
                        ["private-instance-get", "private-instance-set"],
                        ["#private-instance-get", "#private-instance-set"],
                        ["public-abstract-get", "public-abstract-set"],
                        ["protected-abstract-get", "protected-abstract-set"],
                        ["public-get", "public-set"],
                        ["protected-get", "protected-set"],
                        ["private-get", "private-set"],
                        ["#private-get", "#private-set"],
                        ["static-get", "static-set"],
                        ["instance-get", "instance-set"],
                        ["abstract-get", "abstract-set"],
                        ["decorated-get", "decorated-set"],
                        ["get", "set"],
                        // Methods
                        "public-static-method",
                        "protected-static-method",
                        "private-static-method",
                        "#private-static-method",
                        "public-decorated-method",
                        "protected-decorated-method",
                        "private-decorated-method",
                        "public-instance-method",
                        "protected-instance-method",
                        "private-instance-method",
                        "#private-instance-method",
                        "public-abstract-method",
                        "protected-abstract-method",
                        "public-method",
                        "protected-method",
                        "private-method",
                        "#private-method",
                        "static-method",
                        "instance-method",
                        "abstract-method",
                        "decorated-method",
                        "method",
                    ],
                },
            ],
            // Import sorting (backup to Prettier plugin)
            "simple-import-sort/imports": "error",
            "simple-import-sort/exports": "error",
        },
    }
);
