// MIP-2239: Settings > Security and the code step of signing in have every string in every locale.
// `DeepPartial<Messages>` lets a catalog ship incrementally and the loader merges missing keys
// onto English, so these read the raw catalogs (the same approach as genosSkillsLocales.test.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };

const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const enSecurity = leaves(en.security, ["security"]);

const ACTIONS = [
    "mfa.enabled",
    "mfa.disabled",
    "mfa.failed",
    "mfa.recovery_used",
    "mfa.recovery_regenerated",
    "operator.mfa_reset",
] as const;

describe("the security namespace has every string in every locale", () => {
    it("has a screen worth testing", () => {
        expect(enSecurity.length).toBeGreaterThan(60);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].security, ["security"]).map(([p]) => p);
        expect(own.sort()).toEqual(enSecurity.map(([p]) => p).sort());
    });

    it.each(NAMES)("%s keeps every placeholder English has", (name) => {
        const catalog = OTHERS[name].security as unknown;
        for (const [path, english] of enSecurity) {
            const value = path
                .split(".")
                .slice(1)
                .reduce<unknown>(
                    (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
                    catalog
                );
            expect(typeof value, path).toBe("string");
            expect(placeholders(value as string), path).toEqual(placeholders(english));
        }
    });

    it.each(NAMES)("%s has no empty string", (name) => {
        for (const [path, value] of leaves(OTHERS[name].security, ["security"])) {
            expect(value.trim(), path).not.toBe("");
        }
    });

    it.each(NAMES)("%s translates the wording", (name) => {
        const same = leaves(OTHERS[name].security, ["security"])
            .filter(([path, value]) => enSecurity.some(([p, v]) => p === path && v === value))
            .map(([path]) => path);
        expect(same).toEqual([]);
    });
});

describe("the security log and the OAuth refusal are labelled in every locale", () => {
    it.each(NAMES)("%s labels the two-step actions", (name) => {
        const actions = (
            OTHERS[name].settings as { developer?: { securityLog?: { actions?: Tree } } }
        ).developer?.securityLog?.actions;
        for (const action of ACTIONS) {
            expect(typeof actions?.[action], action).toBe("string");
        }
    });

    it.each(NAMES)("%s says what to do after an OAuth sign-in is refused for two-step", (name) => {
        const reasons = (OTHERS[name].admin as { auth?: { oauth?: { failureReasons?: Tree } } })
            .auth?.oauth?.failureReasons;
        expect(typeof reasons?.mfa_password_only).toBe("string");
    });

    it("English has them too", () => {
        for (const action of ACTIONS) {
            expect(en.settings.developer.securityLog.actions).toHaveProperty([action]);
        }
        expect(en.admin.auth.oauth.failureReasons.mfa_password_only).toBeTruthy();
    });
});

describe("the new screens render no literal JSX English", () => {
    const FILES = [
        join(__dirname, "..", "features", "security", "TwoFactorSection.tsx"),
        join(__dirname, "..", "features", "security", "QrCode.tsx"),
        join(__dirname, "..", "features", "admin", "components", "SignInCodeStep.tsx"),
    ];
    const literals = (file: string): string[] => {
        const sf = ts.createSourceFile(
            file,
            readFileSync(file, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX
        );
        const found: string[] = [];
        const visit = (n: ts.Node) => {
            if (ts.isJsxText(n)) {
                const text = n.getText().replace(/\s+/g, " ").trim();
                if (/[A-Za-z]{2,}/.test(text)) found.push(text);
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
        return found;
    };
    for (const f of FILES) {
        it(f.split("/").pop()!, () => {
            expect(literals(f)).toEqual([]);
        });
    }
});
