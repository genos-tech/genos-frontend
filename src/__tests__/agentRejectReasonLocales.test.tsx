/**
 * A reason on Reject (MIP-889): every string it added (`agentApproval.rejectReason.*`),
 * in all seven locales. Reads the raw catalogs, as `agentApprovalEditLocales.test.tsx`
 * does, so the English fallback merge cannot hide a forgotten key; then renders
 * the real card in each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { I18nProvider, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;
const KEYS = Object.keys(en.agentApproval.rejectReason) as Array<
    keyof typeof en.agentApproval.rejectReason
>;

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe("agentApproval.rejectReason has every string in every locale", () => {
    it("has the strings the card uses", () => {
        expect([...KEYS].sort()).toEqual(
            ["add", "back", "counter", "hint", "label", "placeholder"].sort()
        );
    });

    it.each(NAMES)("%s defines exactly the keys English has", (name) => {
        const own = OTHERS[name].agentApproval?.rejectReason ?? {};
        expect(Object.keys(own).sort()).toEqual([...KEYS].sort());
    });

    it.each(NAMES)("%s is translated (only the counter is the same)", (name) => {
        const own = OTHERS[name].agentApproval?.rejectReason ?? {};
        const same = KEYS.filter(
            (k) => k !== "counter" && own[k] === en.agentApproval.rejectReason[k]
        );
        expect({ name, same }).toEqual({ name, same: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder}", (name) => {
        const own = OTHERS[name].agentApproval?.rejectReason ?? {};
        for (const k of KEYS) {
            expect({ k, p: placeholders(own[k] ?? "") }).toEqual({
                k,
                p: placeholders(en.agentApproval.rejectReason[k]),
            });
        }
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe.each(LOCALES)("the reason field in %s", (locale) => {
    it("is offered, labelled and closed in that language", async () => {
        const msgs = await loadLocale(locale);
        const r = msgs.agentApproval.rejectReason;
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <ApprovalCard
                        approveLabel="APPROVE"
                        rejectLabel="REJECT"
                        titleText="TITLE"
                        pending={{
                            step: 1,
                            tool_name: "create_task",
                            arguments: { title: "T" },
                            approval_token: "t",
                            run_id: "r",
                        }}
                        onApprove={() => {}}
                        onReject={() => {}}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: r.add }));
        const field = screen.getByLabelText(r.label) as HTMLTextAreaElement;
        expect(field.placeholder).toBe(r.placeholder);
        expect(screen.getByText(r.hint)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: r.back }));
        expect(screen.queryByLabelText(r.label)).toBeNull();
    });
});
