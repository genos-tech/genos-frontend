/**
 * The strings of "Save as note" / "Save as task" (`agentSave.*`) in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the loader merges
 * every missing key onto English, so a locale that FORGOT a key type-checks, renders, and
 * shows an English sentence in a Japanese turn. These read the raw catalogs so the merge
 * cannot hide a gap, then render the real buttons and status line in each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTurn } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import {
    renderSaveAnswerActions,
    renderSaveAnswerStatus,
} from "../features/agentQA/saveAnswer/SaveAnswerActions";
import { resetSaveStore } from "../features/agentQA/saveAnswer/saveAnswerStore";
import { I18nProvider, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
const post = vi.fn();
vi.mock("../services/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/api")>();
    return { ...actual, authApi: () => ({ post: (...a: unknown[]) => post(...a) }) };
});

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

const PREFIX = "agentSave";
const enSave = leaves(en.agentSave, [PREFIX]);

describe("agentSave has every string in every locale", () => {
    it("has a catalog worth testing", () => {
        expect(enSave.length).toBe(18);
        expect(enSave.every(([, text]) => text.trim() !== "")).toBe(true);
    });

    it("the saved note's first line carries the question placeholder", () => {
        expect(en.agentSave.note.intro).toContain("{question}");
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].agentSave, [PREFIX]).map(([p]) => p);
        const wanted = enSave.map(([p]) => p);
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
        const untouched = enSave
            .filter(([p, text]) => lookup(OTHERS[name], p) === text)
            .map(([p]) => p);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const broken = enSave
            .filter(([p, text]) => {
                const own = lookup(OTHERS[name], p);
                return own === undefined || placeholders(own).join() !== placeholders(text).join();
            })
            .map(([p]) => p);
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});
beforeEach(() => {
    resetSaveStore();
    localStorage.setItem("teamId", "t1");
    localStorage.setItem("userId", "u1");
    post.mockResolvedValue({ data: { noteId: 9 } });
});
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
});

describe.each(LOCALES)("in %s", (locale) => {
    it("the buttons, the status line and the note's first line are in that language", async () => {
        const msgs = await loadLocale(locale);
        const s = msgs.agentSave;
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <AgentTurn
                        answer="Shipped."
                        answerSources={[]}
                        askedQuery="What shipped?"
                        askError={null}
                        isCurrent={false}
                        isDark={false}
                        labels={buildAgentTurnLabels(msgs, "spotlight")}
                        renderAnswerStatus={renderSaveAnswerStatus}
                        renderExtraActions={renderSaveAnswerActions}
                        runId="run-loc"
                        toolEvents={[]}
                        onPreview={vi.fn()}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        expect(screen.getByRole("button", { name: s.task.button })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: s.note.button }));
        expect(await screen.findByText(s.note.saved)).toBeTruthy();
        expect(screen.getByRole("button", { name: s.note.open })).toBeTruthy();
        const body = post.mock.calls[0][1].body as Array<{ content: Array<{ text: string }> }>;
        expect(body[0].content[0].text).toBe(s.note.intro.replace("{question}", "What shipped?"));
    });
});
