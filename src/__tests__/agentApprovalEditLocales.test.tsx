/**
 * Edit before approve: every string it added (`agentApproval.edit.*`), in all
 * seven locales.
 *
 * `DeepPartial<Messages>` lets a translator ship a catalog incrementally and the
 * loader merges every missing key onto English, so a locale that simply
 * FORGOT a key type-checks, renders, and shows an English button in the middle
 * of a Japanese approval card. These tests read the raw catalogs (as
 * `genosMemoryLocales.test.ts` and `agentTurnLocales.test.ts` do) so the merge
 * cannot hide a gap, and then render the real editors in each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { EDITABLE_FIELDS } from "../features/agentQA/approval/editableFields";
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

type Tree = { [key: string]: Tree | string };

const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};

const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const PREFIX = "agentApproval.edit";

// Words that are the same in English and the language, by the language's own
// spelling (not a missing translation).
const SAME_WORD: Partial<Record<keyof typeof OTHERS, string[]>> = {
    fr: [`${PREFIX}.fields.description`, `${PREFIX}.fields.notes`, `${PREFIX}.fields.effort`],
};
const enEdit = leaves(en.agentApproval.edit, [PREFIX]);

describe("agentApproval.edit has every string in every locale", () => {
    it("has a catalog worth testing", () => {
        expect(enEdit.length).toBeGreaterThan(40);
        expect(enEdit.every(([, text]) => text.trim() !== "")).toBe(true);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].agentApproval?.edit, [PREFIX]).map(([p]) => p);
        const wanted = enEdit.map(([p]) => p);
        expect({ locale: name, missing: wanted.filter((p) => !own.includes(p)) }).toEqual({
            locale: name,
            missing: [],
        });
        expect({ locale: name, extra: own.filter((p) => !wanted.includes(p)) }).toEqual({
            locale: name,
            extra: [],
        });
    });

    it.each(NAMES)("%s is translated, not pasted from English", (name) => {
        // A bare product word may match ("Genos"), a sentence never does.
        const untouched = enEdit
            .filter(([, text]) => text.length > 12)
            .filter(([p, text]) => lookup(OTHERS[name], p) === text)
            .map(([p]) => p);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
        // And no short label is left in English either, except where the word is
        // genuinely the same in that language (French writes these three as
        // English does).
        const sameShort = enEdit
            .filter(([, text]) => text.length <= 12)
            .filter(([p, text]) => lookup(OTHERS[name], p) === text)
            .map(([p]) => p)
            .filter((p) => !SAME_WORD[name]?.includes(p));
        expect({ locale: name, sameShort }).toEqual({ locale: name, sameShort: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const broken = enEdit
            .filter(([p, text]) => {
                const own = lookup(OTHERS[name], p);
                return own === undefined || placeholders(own).join() !== placeholders(text).join();
            })
            .map(([p]) => p);
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });

    it("the plural keeps both forms", () => {
        for (const name of NAMES) {
            const own = lookup(OTHERS[name], `${PREFIX}.changesCount`) ?? "";
            expect({
                name,
                ok: /plural,\s*one\s*\{[^{}]*#[^{}]*\}\s*other\s*\{[^{}]*#[^{}]*\}/.test(own),
            }).toEqual({
                name,
                ok: true,
            });
        }
    });

    it("every field label the editors can ask for exists", () => {
        const wanted = new Set(
            Object.values(EDITABLE_FIELDS).flatMap((fields) =>
                Object.values(fields).map((f) => f.label)
            )
        );
        const have = new Set(Object.keys(en.agentApproval.edit.fields));
        expect([...wanted].filter((k) => !have.has(k))).toEqual([]);
    });

    it("every cheap-check message the editors can raise exists", () => {
        expect(Object.keys(en.agentApproval.edit.errors).sort()).toEqual(
            [
                "badDate",
                "badReminder",
                "bodyTooLong",
                "dateRequired",
                "reminderRequired",
                "required",
                "tooLong",
            ].sort()
        );
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

describe.each(LOCALES)("the editors in %s", (locale) => {
    const mount = () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        return render(
            <CssVarsProvider>
                <I18nProvider>
                    <ApprovalCard
                        approveLabel="APPROVE"
                        rejectLabel="REJECT"
                        titleText="TITLE"
                        pending={{
                            step: 1,
                            tool_name: "update_task",
                            arguments: {
                                task_id: "PRJ-1",
                                title: "T",
                                priority: "High",
                                tags: ["a"],
                            },
                            editable: ["title", "priority", "tags"],
                            approval_token: "t",
                            run_id: "r",
                        }}
                        onApprove={() => {}}
                        onReject={() => {}}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
    };

    it("offers Edit, and the editors are labelled in that language", async () => {
        const msgs = await loadLocale(locale);
        const edit = msgs.agentApproval.edit;
        mount();
        fireEvent.click(screen.getByRole("button", { name: edit.edit }));
        expect(screen.getByLabelText(edit.fields.title)).toBeTruthy();
        expect(screen.getByLabelText(edit.fields.priority)).toBeTruthy();
        expect(screen.getByRole("button", { name: edit.cancelEdit })).toBeTruthy();
        expect(screen.getByRole("group", { name: edit.groupLabel })).toBeTruthy();
        expect(screen.getByText(edit.hint)).toBeTruthy();
    });

    it("the Approve button says it carries the changes", async () => {
        const msgs = await loadLocale(locale);
        const edit = msgs.agentApproval.edit;
        mount();
        fireEvent.click(screen.getByRole("button", { name: edit.edit }));
        fireEvent.change(screen.getByLabelText(edit.fields.title), { target: { value: "N" } });
        expect(screen.getByRole("button", { name: edit.approveWithChanges })).toBeTruthy();
    });

    it("the cheap-check sentence is in that language and carries the field's name", async () => {
        const msgs = await loadLocale(locale);
        const edit = msgs.agentApproval.edit;
        mount();
        fireEvent.click(screen.getByRole("button", { name: edit.edit }));
        fireEvent.change(screen.getByLabelText(edit.fields.title), { target: { value: " " } });
        const sentence = edit.errors.required.replace("{field}", edit.fields.title);
        expect(screen.getByText(sentence)).toBeTruthy();
    });
});
