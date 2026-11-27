/**
 * Custom shortcuts (MIP-2413): what may be recorded, what a stored value may hold, what
 * collides, and that matching and printing follow the member's chord per platform.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
    applyOverrides,
    chordParts,
    chordsOverlap,
    customChord,
    defaultShortcutParts,
    editablePolicy,
    findConflict,
    findResetConflict,
    keyToken,
    matchesShortcut,
    parseOverrides,
    readRecorded,
    REBINDABLE_IDS,
    RESERVED_KEYS,
    serializeOverrides,
    setRecording,
    shortcutParts,
    SHORTCUTS,
    type Platform,
} from "../shortcuts";

const mac = { ctrlKey: true, metaKey: true };
const other = { ctrlKey: true, altKey: true };

afterEach(() => {
    applyOverrides("mac", {});
    applyOverrides("other", {});
    setRecording(false);
});

describe("what can be changed", () => {
    it("is Spotlight and the seven letter shortcuts, nothing else", () => {
        expect(REBINDABLE_IDS).toEqual([
            "global.spotlight",
            "global.tasksNew",
            "global.notesNew",
            "global.calendar",
            "global.meetClipboard",
            "global.history",
            "global.taskGraph",
            "global.todo",
        ]);
        for (const id of REBINDABLE_IDS) expect(SHORTCUTS[id].kind).toBe("chord");
    });

    it("reserves the system's keys of the family", () => {
        expect(RESERVED_KEYS).toEqual({ mac: ["q", "f", "d"], other: ["d", "l"] });
    });
});

describe("recording", () => {
    const read = (init: object, platform: Platform = "mac") =>
        readRecorded({ key: "j", code: "KeyJ", ...init }, platform);

    it("takes the platform's two modifiers with a letter or a digit", () => {
        expect(read(mac)).toEqual({ kind: "chord", chord: customChord("j", "mac") });
        expect(read(other, "other")).toEqual({
            kind: "chord",
            chord: customChord("j", "other"),
        });
        expect(read({ ...mac, key: "3", code: "Digit3" }).kind).toBe("chord");
    });

    it("refuses any other modifiers or key", () => {
        for (const init of [
            {},
            { metaKey: true },
            other,
            { ...mac, altKey: true },
            { ...mac, key: "Enter", code: "Enter" },
            { ...mac, key: "ArrowUp", code: "ArrowUp" },
            { ...mac, key: "/", code: "Slash" },
        ]) {
            expect(read(init).kind, JSON.stringify(init)).toBe("invalid");
        }
        expect(read({ ...mac, key: "f", code: "KeyF" }).kind).toBe("reserved");
    });

    it("waits through a lone modifier, a repeat and an IME composition", () => {
        for (const init of [
            { key: "Control", ctrlKey: true },
            { key: "Meta", metaKey: true },
            { key: "AltGraph" },
            { ...mac, repeat: true },
            { ...mac, isComposing: true },
            { ...mac, keyCode: 229 },
        ]) {
            expect(read(init).kind, JSON.stringify(init)).toBe("pending");
        }
    });

    it("reads the physical key when the layout types no Latin character there", () => {
        expect(keyToken({ key: "†", code: "KeyT" })).toBe("t"); // Mac Option
        expect(keyToken({ key: "€", code: "KeyE" })).toBe("e"); // AltGr
        expect(keyToken({ key: "л", code: "KeyK" })).toBe("k"); // Russian
        expect(keyToken({ key: "Dead", code: "KeyN" })).toBe("n");
        expect(keyToken({ key: "&", code: "Digit1" })).toBe("1"); // AZERTY
        expect(keyToken({ key: "z", code: "KeyW" })).toBe("z"); // AZERTY: what it types wins
        expect(keyToken({ key: "'", code: "KeyQ" })).toBeNull(); // Dvorak punctuation
    });
});

describe("the stored value", () => {
    it("round trips", () => {
        const stored = { "global.history": "ctrl+meta+j", "global.todo": "ctrl+meta+1" };
        expect(serializeOverrides(parseOverrides(stored, "mac"))).toEqual(stored);
        expect(serializeOverrides({})).toBeNull();
    });

    it("drops junk without throwing", () => {
        for (const raw of [null, undefined, 3, "x", [], {}]) {
            expect(parseOverrides(raw, "mac")).toEqual({});
        }
        expect(
            parseOverrides(
                {
                    "chat.switchTab": "ctrl+meta+j", // not rebindable
                    "no.such": "ctrl+meta+j",
                    "global.history": "meta+j", // wrong family
                    "global.todo": "ctrl+meta+q", // reserved
                    "global.calendar": 4,
                    "global.taskGraph": "ctrl+meta+Enter",
                    "global.notesNew": "ctrl+alt+j", // the other platform's family
                },
                "mac"
            )
        ).toEqual({});
    });

    it("drops a chord that collides with a built-in one, and the later of two customs", () => {
        // "t" still belongs to New task.
        expect(parseOverrides({ "global.history": "ctrl+meta+t" }, "mac")).toEqual({});
        expect(
            Object.keys(
                parseOverrides(
                    { "global.history": "ctrl+meta+j", "global.todo": "ctrl+meta+j" },
                    "mac"
                )
            )
        ).toEqual(["global.history"]);
        // Two shortcuts that swapped keys are fine: nothing is shared.
        expect(
            Object.keys(
                parseOverrides(
                    { "global.tasksNew": "ctrl+meta+h", "global.history": "ctrl+meta+t" },
                    "mac"
                )
            )
        ).toHaveLength(2);
    });
});

describe("conflicts", () => {
    it("sees that a chord ignoring a modifier also fires on the longer one", () => {
        // Cmd+K (Spotlight) and Cmd+Z (undo) fire with Ctrl held too.
        expect(findConflict(customChord("k", "mac"), "global.history", {}, "mac")).toBe(
            "global.spotlight"
        );
        expect(findConflict(customChord("z", "mac"), "global.history", {}, "mac")).toBe(
            "global.undo"
        );
        expect(findConflict(customChord("k", "other"), "global.history", {}, "other")).toBe(
            "global.spotlight"
        );
        // Windows undo forbids Alt, so Ctrl+Alt+Z is free there.
        expect(findConflict(customChord("z", "other"), "global.history", {}, "other")).toBeNull();
    });

    it("compares against the keys in use now, not the built-in ones", () => {
        const chord = customChord("t", "mac");
        expect(findConflict(chord, "global.history", {}, "mac")).toBe("global.tasksNew");
        const moved = { "global.tasksNew": customChord("j", "mac") };
        expect(findConflict(chord, "global.history", moved, "mac")).toBeNull();
        expect(
            findResetConflict("global.tasksNew", { ...moved, "global.history": chord }, "mac")
        ).toBe("global.history");
        expect(findResetConflict("global.tasksNew", moved, "mac")).toBeNull();
    });

    it("never overlaps two different letters", () => {
        expect(chordsOverlap(customChord("a", "mac"), customChord("b", "mac"))).toBe(false);
        expect(chordsOverlap(customChord("a", "mac"), customChord("a", "mac"))).toBe(true);
    });
});

describe("matching and printing", () => {
    it("follow the custom chord on its own platform only", () => {
        applyOverrides("mac", { "global.history": customChord("j", "mac") });
        expect(matchesShortcut("global.history", { key: "j", ...mac }, "mac")).toBe(true);
        expect(matchesShortcut("global.history", { key: "J", ...mac }, "mac")).toBe(true);
        expect(matchesShortcut("global.history", { key: "h", ...mac }, "mac")).toBe(false);
        expect(matchesShortcut("global.history", { key: "h", ...other }, "other")).toBe(true);
        expect(shortcutParts("global.history", "mac")).toEqual(["Ctrl", "⌘", "J"]);
        expect(defaultShortcutParts("global.history", "mac")).toEqual(["Ctrl", "⌘", "H"]);
        expect(chordParts(customChord("j", "other"), "other")).toEqual(["Ctrl", "Alt", "J"]);
    });

    it("match the physical key for a custom chord, not for a built-in one", () => {
        const russian = { key: "о", code: "KeyJ", ...other };
        applyOverrides("other", { "global.history": customChord("j", "other") });
        expect(matchesShortcut("global.history", russian, "other")).toBe(true);
        expect(
            matchesShortcut("global.tasksNew", { key: "е", code: "KeyT", ...other }, "other")
        ).toBe(false);
    });

    it("a custom chord on Windows and Linux stays out of editors, Spotlight included", () => {
        expect(editablePolicy("global.spotlight", "other")).toBe("allow");
        applyOverrides("other", { "global.spotlight": customChord("j", "other") });
        applyOverrides("mac", { "global.spotlight": customChord("j", "mac") });
        expect(editablePolicy("global.spotlight", "other")).toBe("skip");
        expect(editablePolicy("global.spotlight", "mac")).toBe("allow");
    });

    it("nothing matches while a chord is being recorded", () => {
        setRecording(true);
        expect(matchesShortcut("global.spotlight", { key: "k", metaKey: true }, "mac")).toBe(
            false
        );
        setRecording(false);
        expect(matchesShortcut("global.spotlight", { key: "k", metaKey: true }, "mac")).toBe(true);
    });
});
