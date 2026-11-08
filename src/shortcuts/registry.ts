/**
 * The shortcut registry (MIP-1275): ONE table of every keyboard shortcut a
 * person can look up, with the chord per platform, the scope it lives in and
 * the label it prints. Handlers match through it, Settings and tooltips print
 * from it, so a key, a platform difference or a modifier order is written once.
 *
 * What is NOT here: widget keys (Enter submits a field, Escape closes a popup,
 * arrows move inside a list) and the editor's own chords. Those are not
 * shortcuts a person looks up; genos-docs `design/evidence/MIP-1275.md` lists them.
 *
 * Matching is deliberately the same as the `if`s it replaced: a chord names the
 * modifiers that MUST be held and the ones that must NOT be, and ignores the
 * rest (the letter shortcuts have always ignored Shift; Cmd+K has always
 * ignored everything but its own modifier). `src/__tests__/shortcutRegistry`
 * pins that over every modifier combination on both platforms.
 */
import type { DeepPartial, Messages } from "../i18n/types";
import { isMac } from "../utils/platform";

export type Platform = "mac" | "other";
export type Modifier = "ctrl" | "meta" | "alt" | "shift";

export type Chord = {
    /** `KeyboardEvent.key`. A single letter matches in either case; a list matches any of its keys. */
    key: string | readonly string[];
    /** Held for the chord to match. Also the order they are printed in. */
    mods: readonly Modifier[];
    /** Must NOT be held. A modifier in neither list is ignored. */
    forbid?: readonly Modifier[];
};

/** The part of an event the matcher reads (a `KeyboardEvent`, or a test's plain object). */
export type KeyLike = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
};

/** A shortcut is a key chord, or a display-only entry whose code lives elsewhere. */
export type ShortcutKind = "chord" | "gesture" | "pointer";

/**
 * Where a shortcut applies. Two entries may share keys only in different
 * scopes, and the test names every such pair (see `KNOWN_OVERLAPS`).
 */
export type ShortcutScope = "global" | "chat" | "composer" | "taskCreate";

/** The Settings group a shortcut is listed under. */
export type ShortcutGroup = "global" | "chat" | "editing";

/** What a handler may do when the key is pressed inside a text field. */
export type EditablePolicy = "allow" | "skip";

export type ShortcutCatalog = DeepPartial<Messages>;

export type ShortcutDef = {
    kind: ShortcutKind;
    scope: ShortcutScope;
    group: ShortcutGroup;
    /**
     * Chords per platform. The first is the one printed; the rest are also
     * accepted (the composer takes Cmd OR Ctrl+Enter on both platforms).
     * Empty for a gesture / pointer entry.
     */
    keys: Record<Platform, readonly Chord[]>;
    /** Row label, read from the existing `settings.shortcuts` strings. Takes a partial catalog so the locale test can read raw files. */
    label: (t: ShortcutCatalog) => string | undefined;
    /** Fire while the focus is in an input, textarea or contenteditable? */
    editable: EditablePolicy;
};

const NONE: Record<Platform, readonly Chord[]> = { mac: [], other: [] };

/**
 * `Ctrl+Cmd+<letter>` on Mac, `Ctrl+Alt+<letter>` elsewhere. The "other"
 * modifier is forbidden so the Mac chord never fires on Alt and vice versa;
 * Shift is ignored (a backward cycle still surrenders to a letter).
 */
const letter = (key: string): Record<Platform, readonly Chord[]> => ({
    mac: [{ key, mods: ["ctrl", "meta"], forbid: ["alt"] }],
    other: [{ key, mods: ["ctrl", "alt"], forbid: ["meta"] }],
});

/** Cmd+Shift+Arrows on Mac, Alt+Shift+Arrows elsewhere; Ctrl and the other modifier must be up. */
const holdShift = (key: readonly string[]): Record<Platform, readonly Chord[]> => ({
    mac: [{ key, mods: ["meta", "shift"], forbid: ["alt", "ctrl"] }],
    other: [{ key, mods: ["alt", "shift"], forbid: ["meta", "ctrl"] }],
});

export const SHORTCUTS = {
    "global.spotlight": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: {
            mac: [{ key: "k", mods: ["meta"] }],
            other: [{ key: "k", mods: ["ctrl"] }],
        },
        label: (t) => t.settings?.shortcuts?.global?.rows?.spotlight,
        editable: "allow",
    },
    "global.tasksNew": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("t"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.tasksNew,
        editable: "allow",
    },
    "global.notesNew": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("n"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.notesNew,
        editable: "allow",
    },
    "global.calendar": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("c"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.calendar,
        editable: "allow",
    },
    "global.meetClipboard": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("m"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.meetClipboard,
        editable: "allow",
    },
    "global.history": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("h"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.openHistory,
        editable: "allow",
    },
    "global.taskGraph": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("g"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.openTaskDiagram,
        editable: "allow",
    },
    "global.todo": {
        kind: "chord",
        scope: "global",
        group: "global",
        keys: letter("o"),
        label: (t) => t.settings?.shortcuts?.global?.rows?.openTodo,
        editable: "allow",
    },
    // Hold Cmd (Alt elsewhere) and tap Ctrl. The listener stays in
    // `useGlobalServiceShortcut` (it needs the keyup and the overlay state); the
    // entry exists so Settings and the sidebar tooltip print it from one place.
    "global.cycle": {
        kind: "gesture",
        scope: "global",
        group: "global",
        keys: NONE,
        label: (t) => t.settings?.shortcuts?.global?.rows?.cycle,
        editable: "allow",
    },
    "chat.switchTab": {
        kind: "chord",
        scope: "chat",
        group: "chat",
        keys: holdShift(["ArrowLeft", "ArrowRight"]),
        label: (t) => t.settings?.shortcuts?.chat?.rows?.switchTab,
        editable: "skip",
    },
    "chat.moveSelection": {
        kind: "chord",
        scope: "chat",
        group: "chat",
        keys: holdShift(["ArrowUp", "ArrowDown"]),
        label: (t) => t.settings?.shortcuts?.chat?.rows?.moveSelection,
        editable: "skip",
    },
    // Cmd+click (Alt+click elsewhere) on a message. A click, so display-only.
    "chat.openThread": {
        kind: "pointer",
        scope: "chat",
        group: "chat",
        keys: NONE,
        label: (t) => t.settings?.shortcuts?.chat?.rows?.openThread,
        editable: "allow",
    },
    // Send, in every composer. Cmd OR Ctrl on both platforms, as it has always been.
    "composer.send": {
        kind: "chord",
        scope: "composer",
        group: "editing",
        keys: {
            mac: [
                { key: "Enter", mods: ["meta"] },
                { key: "Enter", mods: ["ctrl"] },
            ],
            other: [
                { key: "Enter", mods: ["ctrl"] },
                { key: "Enter", mods: ["meta"] },
            ],
        },
        label: (t) => t.settings?.shortcuts?.editing?.rows?.send,
        editable: "allow",
    },
    "taskCreate.submit": {
        kind: "chord",
        scope: "taskCreate",
        group: "editing",
        keys: {
            mac: [{ key: "Enter", mods: ["meta"] }],
            other: [{ key: "Enter", mods: ["ctrl"] }],
        },
        label: (t) => t.settings?.shortcuts?.editing?.rows?.createTask,
        editable: "allow",
    },
} as const satisfies Record<string, ShortcutDef>;

export type ShortcutId = keyof typeof SHORTCUTS;

/**
 * Chords the rich-text editor binds itself, which can fire together with ours.
 * BlockNote listens on the editor, we listen on `document`, and neither checks
 * `defaultPrevented`, so both run (MIP-1275 evidence, items 1 and 2). They are
 * written down so the test can name every overlap instead of hiding it.
 */
export const EDITOR_CHORDS: ReadonlyArray<{ id: string; platform: Platform; chord: Chord }> = [
    { id: "blocknote.link", platform: "mac", chord: { key: "k", mods: ["meta"] } },
    { id: "blocknote.link", platform: "other", chord: { key: "k", mods: ["ctrl"] } },
    // BlockNote "Mod-Alt-c" (code block): Mod is Ctrl on Windows and Linux.
    { id: "blocknote.codeBlock", platform: "other", chord: { key: "c", mods: ["ctrl", "alt"] } },
];

export const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ShortcutId[];

export const currentPlatform = (): Platform => (isMac() ? "mac" : "other");

const HELD: Record<Modifier, keyof KeyLike> = {
    ctrl: "ctrlKey",
    meta: "metaKey",
    alt: "altKey",
    shift: "shiftKey",
};

const keyMatches = (chord: Chord, eventKey: string): boolean => {
    const keys = typeof chord.key === "string" ? [chord.key] : chord.key;
    // A letter matches in either case (Caps Lock, Shift); a named key ("Enter",
    // "ArrowLeft") is matched exactly, as the old handlers did.
    const folded = eventKey.length === 1 ? eventKey.toLowerCase() : eventKey;
    return keys.some((k) => (k.length === 1 ? k.toLowerCase() : k) === folded);
};

/** Does `event` match this one chord? Exposed for the table test. */
export const chordMatches = (chord: Chord, event: KeyLike): boolean => {
    if (!keyMatches(chord, event.key)) return false;
    for (const m of chord.mods) if (!event[HELD[m]]) return false;
    for (const m of chord.forbid ?? []) if (event[HELD[m]]) return false;
    return true;
};

/** Does `event` trigger shortcut `id` on `platform` (default: the current one)? */
export const matchesShortcut = (
    id: ShortcutId,
    event: KeyLike,
    platform: Platform = currentPlatform()
): boolean => {
    const def: ShortcutDef = SHORTCUTS[id];
    return def.keys[platform].some((chord) => chordMatches(chord, event));
};

/** Is the event's target a text field, where a plain-text shortcut must stay out of the way? */
export const isEditableTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    return (
        !!el &&
        (!!el.matches?.("input, textarea, [contenteditable=true]") ||
            !!el.closest?.("[contenteditable=true]"))
    );
};

const MOD_LABEL: Record<Platform, Record<Modifier, string>> = {
    mac: { ctrl: "Ctrl", meta: "⌘", alt: "Alt", shift: "Shift" },
    other: { ctrl: "Ctrl", meta: "Win", alt: "Alt", shift: "Shift" },
};

const KEY_LABEL: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
};

const keyLabel = (key: string | readonly string[]): string => {
    const keys = typeof key === "string" ? [key] : key;
    return keys.map((k) => KEY_LABEL[k] ?? (k.length === 1 ? k.toUpperCase() : k)).join(" / ");
};

/**
 * The printed parts of a chord shortcut, one per key cap: `["Ctrl", "⌘", "T"]`.
 * A gesture or pointer entry has none (its text is composed where it is shown).
 */
export const shortcutParts = (
    id: ShortcutId,
    platform: Platform = currentPlatform()
): string[] => {
    const def: ShortcutDef = SHORTCUTS[id];
    const chord = def.keys[platform][0];
    if (!chord) return [];
    return [...chord.mods.map((m) => MOD_LABEL[platform][m]), keyLabel(chord.key)];
};

/** The parts joined for a tooltip: `Ctrl+⌘+T`. */
export const shortcutText = (id: ShortcutId, platform: Platform = currentPlatform()): string =>
    shortcutParts(id, platform).join("+");

/** The modifier that is held in the cycle gesture, and the key that is tapped. */
export const cycleKeys = (
    platform: Platform = currentPlatform()
): { hold: string; tap: string } => ({
    hold: platform === "mac" ? MOD_LABEL.mac.meta : MOD_LABEL.other.alt,
    tap: MOD_LABEL[platform].ctrl,
});

/** The modifier of the click-to-open-thread pointer shortcut. */
export const threadClickModifier = (platform: Platform = currentPlatform()): string =>
    platform === "mac" ? MOD_LABEL.mac.meta : MOD_LABEL.other.alt;

/** The text of a shortcut's label in `t`, or its id if a locale lacks it. */
export const shortcutLabel = (id: ShortcutId, t: ShortcutCatalog): string =>
    SHORTCUTS[id].label(t) ?? id;
