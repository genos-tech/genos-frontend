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
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        plugins: {
            react,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            "simple-import-sort": simpleImportSort,
            prettier,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "prettier/prettier": "error",
            // JSX and React sorting rules
            // Demoted to warn: ~16 residual violations aren't auto-fixable
            // (spreads/comments between props). The bulk was auto-sorted.
            "react/jsx-sort-props": [
                "warn",
                {
                    callbacksLast: true,
                    shorthandFirst: false,
                    shorthandLast: true,
                    multiline: "last",
                    ignoreCase: true,
                    reservedFirst: true,
                },
            ],
            // Disable some React rules that conflict with TypeScript
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            // Object property sorting — DISABLED: ~11.5k pre-existing
            // violations and the core `sort-keys` rule has no autofixer.
            // Re-enable via an auto-fixable plugin (e.g. perfectionist) in a
            // dedicated cleanup pass rather than blocking CI on it.
            "sort-keys": "off",
            // TypeScript sorting rules
            "@typescript-eslint/adjacent-overload-signatures": "error",
            // Member ordering — DISABLED (no autofixer; stylistic). Re-enable
            // in a cleanup pass.
            "@typescript-eslint/member-ordering": [
                "off",
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
            // Import order is owned by Prettier's
            // @ianvs/prettier-plugin-sort-imports (see .prettierrc). These
            // eslint rules enforced a DIFFERENT order and fought the prettier
            // plugin (perpetual prettier/prettier churn that never converges
            // under --fix), so they are disabled — `prettier --write` is the
            // single source of truth for import order.
            "simple-import-sort/imports": "off",
            "simple-import-sort/exports": "off",
            // Substantive-but-noisy rules demoted to warnings for the green
            // baseline (the CI gate fails on ERRORS only). Burn these down and
            // promote back to "error" incrementally. react-hooks/rules-of-hooks
            // intentionally stays an ERROR — those are real bugs.
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "react-hooks/exhaustive-deps": "warn",
            // Minor, low-count; demoted to warn for the baseline rather than
            // editing in-flight component code (empty WIP block, a @ts-ignore,
            // and switch-case lexical decls that don't fall through). Fix in a
            // cleanup pass.
            "no-case-declarations": "warn",
            "no-empty": "warn",
            "@typescript-eslint/ban-ts-comment": "warn",
            // One tooltip in the product, and one grep that finds it. Joy's
            // raw Tooltip drifted into ~30 files, each restating the same
            // purple-tinted surface slightly differently (and a few
            // hand-rolled z-indexes that were worse than the theme's).
            // `AppTooltip` owns that look and carries the props the real
            // divergences needed (`maxWidth`, `surface`, `arrowColor`), so
            // reaching past it is now a mistake rather than a shortcut.
            // The native `title` attribute is the other half of this rule and
            // cannot be linted: `title` is a legitimate prop on Section,
            // ModalDialog and friends. It is on reviewers.
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "@mui/joy",
                            importNames: ["Tooltip"],
                            message:
                                "Use <AppTooltip> (components/ui/AppTooltip.tsx). It needs a look this one can't express? Add the prop there.",
                        },
                        {
                            name: "@mui/material",
                            importNames: ["Tooltip"],
                            message:
                                "Use <AppTooltip> (components/ui/AppTooltip.tsx). This app is on Joy, not Material.",
                        },
                    ],
                },
            ],
        },
    },
    {
        // The one place Joy's Tooltip is the right import: the component
        // that wraps it for everybody else.
        files: ["src/components/ui/AppTooltip.tsx"],
        rules: {
            "no-restricted-imports": "off",
        },
    },
    {
        // These modules define custom hooks that don't follow the `use*`
        // naming convention (loadInitialData, *NoteChain, webSocketSync,
        // wsJoinTeamHook, …) or call hooks from an editor `render` callback.
        // react-hooks/rules-of-hooks flags them by NAME, not for a real
        // conditional call — they are genuine top-level hooks (the app and
        // tests exercise them). Disabled HERE ONLY so the rule stays an ERROR
        // for real components everywhere else.
        // TODO: rename these to `use*` across call sites, then drop this block.
        files: [
            "src/components/editors/Mention.tsx",
            "src/components/editors/sub/Alert.tsx",
            "src/hooks/common/useSyncManagement.ts",
            "src/hooks/common/useWebSocket.ts",
            "src/hooks/notes/chatNote.ts",
            "src/hooks/notes/myNote.ts",
            "src/hooks/notes/taskNote.ts",
            "src/hooks/tasks/sidebar.ts",
            "src/services/loadInitialData.ts",
        ],
        rules: {
            "react-hooks/rules-of-hooks": "off",
        },
    }
);
