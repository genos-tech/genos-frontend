/**
 * The shortcut registry (MIP-1275).
 *
 * 1. BEHAVIOUR: the migrated handlers must match exactly what their old `if`s
 *    matched. The old predicates are copied below, as they were, and compared with
 *    the registry over every combination of the four modifiers, on both
 *    platforms, for the keys that matter. If the registry drifts, one of these
 *    32+ cells flips.
 * 2. COVERAGE: every shortcut has a label in all seven locales, read from the raw
 *    per-locale catalogs. Non-English catalogs are `DeepPartial<Messages>` and fall
 *    back to English, so a test against the merged catalog would always pass.
 * 3. NO SILENT CLASHES: no two shortcuts share keys in the same scope, and every
 *    overlap across scopes (or with a chord the editor binds itself) is named here.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import {
    chordMatches,
    cycleKeys,
    EDITOR_CHORDS,
    isEditableTarget,
    matchesShortcut,
    SHORTCUT_IDS,
    shortcutParts,
    SHORTCUTS,
    shortcutText,
    threadClickModifier,
    type Chord,
    type KeyLike,
    type Platform,
    type ShortcutId,
} from "../shortcuts";

const CATALOGS = { en, ja, zh, es, fr, hi, ar } as const;
const PLATFORMS: Platform[] = ["mac", "other"];

/** Every combination of ctrl / meta / alt / shift. */
const COMBOS: Array<Required<Pick<KeyLike, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">>> = [];
for (let n = 0; n < 16; n++) {
    COMBOS.push({
        ctrlKey: !!(n & 1),
        metaKey: !!(n & 2),
        altKey: !!(n & 4),
        shiftKey: !!(n & 8),
    });
}

/** The predicates the handlers used before the registry, copied verbatim in meaning. */
const LEGACY: Record<string, (e: Required<KeyLike>, mac: boolean) => boolean> = {
    letter: (e, mac) => {
        // useGlobalServiceShortcut: lettersModifiersOk && key.toLowerCase() === x
        const ok = mac ? e.ctrlKey && e.metaKey && !e.altKey : e.ctrlKey && e.altKey && !e.metaKey;
        return ok;
    },
    spotlight: (e, mac) => e.key.toLowerCase() === "k" && (mac ? e.metaKey : e.ctrlKey),
    chatArrows: (e, mac) => {
        // ChatSidebar / ChatList: holdHeld && shift && !wrong && !ctrl
        const holdHeld = mac ? e.metaKey : e.altKey;
        const wrong = mac ? e.altKey : e.metaKey;
        return !(!holdHeld || !e.shiftKey || wrong || e.ctrlKey);
    },
    createTask: (e, mac) => e.key === "Enter" && (mac ? e.metaKey : e.ctrlKey),
    send: (e) => e.key === "Enter" && (e.metaKey || e.ctrlKey),
};

const LETTERS: Array<[ShortcutId, string]> = [
    ["global.tasksNew", "t"],
    ["global.notesNew", "n"],
    ["global.calendar", "c"],
    ["global.meetClipboard", "m"],
    ["global.history", "h"],
    ["global.taskGraph", "g"],
    ["global.todo", "x"],
];

const event = (key: string, mods: (typeof COMBOS)[number]): Required<KeyLike> => ({
    key,
    ...mods,
});

describe("registry matches what the old handlers matched", () => {
    it.each(PLATFORMS)(
        "the seven letter shortcuts, every modifier combination (%s)",
        (platform) => {
            for (const [id, letter] of LETTERS) {
                for (const mods of COMBOS) {
                    for (const key of [letter, letter.toUpperCase(), "x", "Enter", "Control"]) {
                        const e = event(key, mods);
                        const old =
                            key.toLowerCase() === letter && LEGACY.letter(e, platform === "mac");
                        expect(
                            matchesShortcut(id, e, platform),
                            `${id} ${platform} ${JSON.stringify(e)}`
                        ).toBe(old);
                    }
                }
            }
        }
    );

    it.each(PLATFORMS)("Cmd/Ctrl+K opens Spotlight, ignoring other modifiers (%s)", (platform) => {
        for (const mods of COMBOS) {
            for (const key of ["k", "K", "j", "Enter"]) {
                const e = event(key, mods);
                expect(matchesShortcut("global.spotlight", e, platform)).toBe(
                    LEGACY.spotlight(e, platform === "mac")
                );
            }
        }
    });

    it.each(PLATFORMS)("chat tab / list arrows (%s)", (platform) => {
        const tab: ShortcutId = "chat.switchTab";
        const list: ShortcutId = "chat.moveSelection";
        for (const mods of COMBOS) {
            for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "a"]) {
                const e = event(key, mods);
                const chord = LEGACY.chatArrows(e, platform === "mac");
                expect(matchesShortcut(tab, e, platform)).toBe(
                    chord && (key === "ArrowLeft" || key === "ArrowRight")
                );
                expect(matchesShortcut(list, e, platform)).toBe(
                    chord && (key === "ArrowUp" || key === "ArrowDown")
                );
            }
        }
    });

    it.each(PLATFORMS)(
        "create-task submit is Cmd on Mac, Ctrl elsewhere only (%s)",
        (platform) => {
            for (const mods of COMBOS) {
                for (const key of ["Enter", "enter", "a", "Tab"]) {
                    const e = event(key, mods);
                    expect(matchesShortcut("taskCreate.submit", e, platform)).toBe(
                        LEGACY.createTask(e, platform === "mac")
                    );
                }
            }
        }
    );

    it.each(PLATFORMS)("composer send is Cmd OR Ctrl+Enter on both platforms (%s)", (platform) => {
        for (const mods of COMBOS) {
            for (const key of ["Enter", "a", " "]) {
                const e = event(key, mods);
                expect(matchesShortcut("composer.send", e, platform)).toBe(LEGACY.send(e, true));
            }
        }
    });

    it("a gesture and a pointer entry never match a keydown", () => {
        for (const id of SHORTCUT_IDS) {
            if (SHORTCUTS[id].kind === "chord") continue;
            for (const platform of PLATFORMS) {
                expect(SHORTCUTS[id].keys[platform]).toHaveLength(0);
                for (const mods of COMBOS) {
                    expect(matchesShortcut(id, event("Control", mods), platform)).toBe(false);
                }
            }
        }
    });
});

describe("editable-target policy", () => {
    it("only the two chat arrow shortcuts keep out of text fields (as before); everything else fires", () => {
        const skipping = SHORTCUT_IDS.filter((id) => SHORTCUTS[id].editable === "skip");
        expect(skipping.sort()).toEqual(["chat.moveSelection", "chat.switchTab"]);
    });
});

describe("printed text", () => {
    it("is Ctrl+Cmd on Mac and Ctrl+Alt elsewhere, in the same order everywhere", () => {
        expect(shortcutText("global.tasksNew", "mac")).toBe("Ctrl+⌘+T");
        expect(shortcutText("global.tasksNew", "other")).toBe("Ctrl+Alt+T");
        expect(shortcutParts("global.calendar", "other")).toEqual(["Ctrl", "Alt", "C"]);
    });

    it("prints the single key caps of the other shortcuts", () => {
        expect(shortcutParts("global.spotlight", "mac")).toEqual(["⌘", "K"]);
        expect(shortcutParts("global.spotlight", "other")).toEqual(["Ctrl", "K"]);
        expect(shortcutParts("chat.switchTab", "mac")).toEqual(["⌘", "Shift", "← / →"]);
        expect(shortcutParts("chat.moveSelection", "other")).toEqual(["Alt", "Shift", "↑ / ↓"]);
        expect(shortcutText("composer.send", "mac")).toBe("⌘+Enter");
        expect(shortcutText("composer.send", "other")).toBe("Ctrl+Enter");
        expect(shortcutText("taskCreate.submit", "other")).toBe("Ctrl+Enter");
    });

    it("the cycle gesture is hold Cmd / hold Alt, then tap Ctrl (never the reverse)", () => {
        expect(cycleKeys("mac")).toEqual({ hold: "⌘", tap: "Ctrl" });
        expect(cycleKeys("other")).toEqual({ hold: "Alt", tap: "Ctrl" });
        expect(threadClickModifier("mac")).toBe("⌘");
        expect(threadClickModifier("other")).toBe("Alt");
    });
});

describe("every shortcut is labelled in all seven locales", () => {
    it.each(Object.entries(CATALOGS))("%s has a label for each registry entry", (locale, cat) => {
        for (const id of SHORTCUT_IDS) {
            const label = SHORTCUTS[id].label(cat);
            expect(typeof label, `${locale} ${id}`).toBe("string");
            expect((label as string).trim().length, `${locale} ${id}`).toBeGreaterThan(0);
        }
    });

    it.each(Object.entries(CATALOGS))("%s has the group copy for every group", (locale, cat) => {
        for (const group of new Set(SHORTCUT_IDS.map((id) => SHORTCUTS[id].group))) {
            const copy = cat.settings?.shortcuts?.[group];
            expect(copy?.title, `${locale} ${group}`).toBeTruthy();
            expect(copy?.description, `${locale} ${group}`).toBeTruthy();
        }
    });

    it.each(Object.entries(CATALOGS))(
        "%s keeps the placeholders the code fills in (a translator dropping one prints the wrong key)",
        (locale, cat) => {
            const need = (text: string | undefined, token: string, where: string) =>
                expect(text ?? "", `${locale} ${where}`).toContain(token);
            const cycle = cat.settings?.shortcuts?.global?.cycleCombo;
            need(cycle?.hold, "{key}", "cycleCombo.hold");
            need(cycle?.release, "{key}", "cycleCombo.release");
            const tips = cat.sidebar?.tooltips;
            need(tips?.switchService, "{hold}", "switchService");
            need(tips?.switchService, "{tap}", "switchService");
            for (const k of [
                "spotlightShortcut",
                "tasksShortcut",
                "notesShortcut",
                "historyShortcut",
                "todoShortcut",
            ] as const) {
                const value = tips?.[k];
                // A locale may leave a tooltip to the English fallback (zh does for two);
                // when it has its own, it must still be a template.
                if (value !== undefined) need(value, "{shortcut}", k);
            }
        }
    );
});

/** A chord as comparable text: sorted modifiers + lowercased key(s). */
const sig = (chord: Chord): string[] => {
    const keys = typeof chord.key === "string" ? [chord.key] : [...chord.key];
    const mods = [...chord.mods].sort().join("+");
    return keys.map((k) => `${mods}+${k.toLowerCase()}`);
};

describe("no silent clashes", () => {
    const chordsOf = (id: ShortcutId, platform: Platform) =>
        SHORTCUTS[id].keys[platform].flatMap(sig);

    it.each(PLATFORMS)("no two shortcuts share keys in the same scope (%s)", (platform) => {
        const seen = new Map<string, ShortcutId>();
        for (const id of SHORTCUT_IDS) {
            for (const s of chordsOf(id, platform)) {
                const key = `${SHORTCUTS[id].scope}|${s}`;
                const other = seen.get(key);
                expect(
                    other,
                    `${id} and ${other} share ${s} in scope ${SHORTCUTS[id].scope}`
                ).toBeUndefined();
                seen.set(key, id);
            }
        }
    });

    /**
     * Same keys, different scope. Each is a real overlap that MIP-1275 found and did not
     * change; a NEW one fails this test until someone reads the inventory and lists it.
     */
    const KNOWN_OVERLAPS = new Set(["composer.send|taskCreate.submit"]);

    it.each(PLATFORMS)("every cross-scope overlap is a known one (%s)", (platform) => {
        const found = new Set<string>();
        for (const a of SHORTCUT_IDS) {
            for (const b of SHORTCUT_IDS) {
                if (a >= b || SHORTCUTS[a].scope === SHORTCUTS[b].scope) continue;
                const sa = new Set(chordsOf(a, platform));
                if (chordsOf(b, platform).some((s) => sa.has(s))) found.add(`${a}|${b}`);
            }
        }
        expect([...found].sort()).toEqual([...KNOWN_OVERLAPS].sort());
    });

    /**
     * Chords the rich-text editor binds itself. Both run for one keypress (nothing checks
     * `defaultPrevented`): Cmd/Ctrl+K opens Spotlight over the link popover, and on Windows
     * Ctrl+Alt+C opens the calendar and makes a code block. Documented, not fixed here.
     */
    const KNOWN_EDITOR_OVERLAPS: Record<Platform, string[]> = {
        mac: ["global.spotlight|blocknote.link"],
        other: ["global.calendar|blocknote.codeBlock", "global.spotlight|blocknote.link"],
    };

    it.each(PLATFORMS)("every overlap with an editor chord is a known one (%s)", (platform) => {
        const found: string[] = [];
        for (const id of SHORTCUT_IDS) {
            const mine = new Set(chordsOf(id, platform));
            for (const ec of EDITOR_CHORDS.filter((c) => c.platform === platform)) {
                if (sig(ec.chord).some((s) => mine.has(s))) found.push(`${id}|${ec.id}`);
            }
        }
        expect(found.sort()).toEqual(KNOWN_EDITOR_OVERLAPS[platform].sort());
    });
});

describe("chordMatches", () => {
    it("treats a modifier in neither list as ignored", () => {
        const chord: Chord = { key: "k", mods: ["meta"] };
        expect(chordMatches(chord, { key: "k", metaKey: true, shiftKey: true })).toBe(true);
        expect(chordMatches(chord, { key: "k", metaKey: false })).toBe(false);
    });

    it("a forbidden modifier blocks the match", () => {
        const chord: Chord = { key: "t", mods: ["ctrl", "meta"], forbid: ["alt"] };
        expect(chordMatches(chord, { key: "t", ctrlKey: true, metaKey: true })).toBe(true);
        expect(chordMatches(chord, { key: "t", ctrlKey: true, metaKey: true, altKey: true })).toBe(
            false
        );
    });
});

describe("isEditableTarget", () => {
    it("is true for inputs, textareas and anything inside contenteditable", () => {
        const input = document.createElement("input");
        const area = document.createElement("textarea");
        const host = document.createElement("div");
        host.setAttribute("contenteditable", "true");
        const inner = document.createElement("span");
        host.appendChild(inner);
        const plain = document.createElement("button");
        expect(isEditableTarget(input)).toBe(true);
        expect(isEditableTarget(area)).toBe(true);
        expect(isEditableTarget(host)).toBe(true);
        expect(isEditableTarget(inner)).toBe(true);
        expect(isEditableTarget(plain)).toBe(false);
        expect(isEditableTarget(null)).toBe(false);
    });
});
