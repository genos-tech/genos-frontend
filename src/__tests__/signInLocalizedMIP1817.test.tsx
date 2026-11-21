// MIP-1817: the sign-in page's heading and "Remember me" were English in ja because the ja
// catalog copied the en words. Guard: the sign-in / sign-up / join-team surfaces carry no
// literal JSX English, and every locale's RAW catalog translates the two words.
import { readdirSync, readFileSync } from "node:fs";
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

const ADMIN = join(__dirname, "..", "features", "admin", "components");
const AUTH_FILES = [
    "SignInForm.tsx",
    "SignUpForm.tsx",
    "SignUpConsent.tsx",
    "ResetPasswordForm.tsx",
    "joinTeamFrom.tsx",
    "AuthShell.tsx",
    "VerifyEmailHandler.tsx",
    "AcceptInviteHandler.tsx",
    "TeamSetupFields.tsx",
];

const jsxTextLiterals = (file: string): string[] => {
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

describe("sign-in / sign-up / join-team render no literal JSX English (MIP-1817)", () => {
    for (const f of AUTH_FILES) {
        it(f, () => {
            expect(readdirSync(ADMIN)).toContain(f);
            expect(jsxTextLiterals(join(ADMIN, f))).toEqual([]);
        });
    }
});

describe("the sign-in heading and Remember me are translated in every locale's raw catalog", () => {
    const pick = (cat: unknown) =>
        (cat as { admin: { auth: { signIn: { title: string; rememberMe: string } } } }).admin.auth
            .signIn;
    const enWords = pick(en);
    const LOCALES: [string, unknown][] = [
        ["ja", ja],
        ["zh", zh],
        ["es", es],
        ["fr", fr],
        ["hi", hi],
        ["ar", ar],
    ];
    for (const [name, cat] of LOCALES) {
        it(name, () => {
            const w = pick(cat);
            expect(w.title).toBeTruthy();
            expect(w.rememberMe).toBeTruthy();
            expect(w.title).not.toBe(enWords.title);
            expect(w.rememberMe).not.toBe(enWords.rememberMe);
        });
    }
});
