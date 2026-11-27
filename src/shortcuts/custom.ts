/**
 * What a member may record, how it is stored and what it collides with (MIP-2413). Pure
 * functions over the registry; the live store is `overrides.ts`.
 *
 * A custom chord is always `Ctrl+Cmd` (Mac) or `Ctrl+Alt` (elsewhere) plus one letter or
 * digit: the family the built-in letter shortcuts already use. It keeps clear of the keys a
 * browser or the OS takes before the page sees them (Cmd/Ctrl+T, W, N, Tab), of Mac Option
 * typing characters, and of VoiceOver's Ctrl+Option.
 */
import type { Overrides } from "./overrides";
import {
    chordMatches,
    keyToken,
    REBINDABLE_IDS,
    SHORTCUT_IDS,
    SHORTCUTS,
    type Chord,
    type KeyLike,
    type Modifier,
    type Platform,
    type ShortcutDef,
    type ShortcutId,
} from "./registry";

/** The `ui_settings` key per platform: the chords and the reserved keys differ. */
export const SHORTCUT_SETTINGS_KEYS: Record<Platform, string> = {
    mac: "shortcutsMac",
    other: "shortcutsOther",
};

export const CUSTOM_MODS: Record<Platform, readonly Modifier[]> = {
    mac: ["ctrl", "meta"],
    other: ["ctrl", "alt"],
};

/**
 * Keys of the family the system takes. Mac: lock screen (Q), full screen (F), look up (D).
 * Linux desktops: show desktop (D), lock (L). A built-in default is not checked against this.
 */
export const RESERVED_KEYS: Record<Platform, readonly string[]> = {
    mac: ["q", "f", "d"],
    other: ["d", "l"],
};

const KEY_PATTERN = /^[a-z0-9]$/;

export const customChord = (key: string, platform: Platform): Chord => ({
    key,
    mods: CUSTOM_MODS[platform],
    forbid: platform === "mac" ? ["alt"] : ["meta"],
    // Matches the physical key when the layout does not type a Latin character there.
    physical: true,
});

export const serializeChord = (chord: Chord): string => `${chord.mods.join("+")}+${chord.key}`;

const parseChord = (value: unknown, platform: Platform): Chord | null => {
    if (typeof value !== "string" || value.length > 32) return null;
    const prefix = `${CUSTOM_MODS[platform].join("+")}+`;
    if (!value.startsWith(prefix)) return null;
    const key = value.slice(prefix.length);
    if (!KEY_PATTERN.test(key) || RESERVED_KEYS[platform].includes(key)) return null;
    return customChord(key, platform);
};

/** The events that would press `chord`: its modifiers held, one per key it lists. */
const eventsFor = (chord: Chord): KeyLike[] => {
    const keys = typeof chord.key === "string" ? [chord.key] : chord.key;
    return keys.map((key) => ({
        key,
        ctrlKey: chord.mods.includes("ctrl"),
        metaKey: chord.mods.includes("meta"),
        altKey: chord.mods.includes("alt"),
        shiftKey: chord.mods.includes("shift"),
    }));
};

/**
 * Could one key press match both? A chord ignores the modifiers it neither names nor
 * forbids, so Cmd+K (Spotlight) also fires on Ctrl+Cmd+K: press the union of both.
 */
export const chordsOverlap = (a: Chord, b: Chord): boolean =>
    eventsFor(a).some((ea) =>
        eventsFor(b).some((eb) => {
            if (ea.key.toLowerCase() !== eb.key.toLowerCase()) return false;
            const both: KeyLike = {
                key: ea.key,
                ctrlKey: ea.ctrlKey || eb.ctrlKey,
                metaKey: ea.metaKey || eb.metaKey,
                altKey: ea.altKey || eb.altKey,
                shiftKey: ea.shiftKey || eb.shiftKey,
            };
            return chordMatches(a, both) && chordMatches(b, both);
        })
    );

const chordsOf = (id: ShortcutId, overrides: Overrides, platform: Platform): readonly Chord[] => {
    const own = overrides[id];
    const def: ShortcutDef = SHORTCUTS[id];
    return own ? [own] : def.keys[platform];
};

/** The other shortcut that `chord` would fire together with, if any. */
export const findConflict = (
    chord: Chord,
    forId: ShortcutId,
    overrides: Overrides,
    platform: Platform
): ShortcutId | null =>
    SHORTCUT_IDS.find(
        (id) =>
            id !== forId &&
            chordsOf(id, overrides, platform).some((other) => chordsOverlap(chord, other))
    ) ?? null;

/**
 * Putting `id` back on its default can land on a chord another shortcut has since taken
 * (free "T", give it to History, then reset New task). Built-in keys never collide with each
 * other, so only the other custom chords are checked.
 */
export const findResetConflict = (
    id: ShortcutId,
    overrides: Overrides,
    platform: Platform
): ShortcutId | null => {
    const def: ShortcutDef = SHORTCUTS[id];
    return (
        SHORTCUT_IDS.find((other) => {
            const own = overrides[other];
            return other !== id && !!own && def.keys[platform].some((c) => chordsOverlap(c, own));
        }) ?? null
    );
};

/**
 * The stored value is untrusted (another device, an older build, a hand-made PATCH): keep
 * only rebindable ids with a well-formed, unreserved chord, then drop any custom chord that
 * collides with another shortcut (the later one of two customs), until none does. Never
 * throws; anything dropped falls back to its default.
 */
export const parseOverrides = (raw: unknown, platform: Platform): Overrides => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Partial<Record<ShortcutId, Chord>> = {};
    for (const id of REBINDABLE_IDS) {
        const chord = parseChord((raw as Record<string, unknown>)[id], platform);
        if (chord) out[id] = chord;
    }
    for (;;) {
        const bad = [...REBINDABLE_IDS].reverse().find((id) => {
            const own = out[id];
            return !!own && findConflict(own, id, out, platform) !== null;
        });
        if (!bad) return out;
        delete out[bad];
    }
};

/** The map to store, or `null` (delete the key) when every shortcut is on its default. */
export const serializeOverrides = (overrides: Overrides): Record<string, string> | null => {
    const entries = Object.entries(overrides).map(([id, chord]) => [id, serializeChord(chord)]);
    return entries.length ? Object.fromEntries(entries) : null;
};

export type Recorded =
    /** A modifier on its own, a repeat or an IME composition: keep waiting. */
    | { kind: "pending" }
    /** Not `Ctrl+Cmd` / `Ctrl+Alt` plus a letter or digit. */
    | { kind: "invalid" }
    | { kind: "reserved"; chord: Chord }
    | { kind: "chord"; chord: Chord };

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "AltGraph", "OS", "CapsLock"]);

/** What a keydown means while recording. */
export const readRecorded = (
    event: KeyLike & { repeat?: boolean; isComposing?: boolean; keyCode?: number },
    platform: Platform
): Recorded => {
    if (event.repeat || event.isComposing || event.keyCode === 229) return { kind: "pending" };
    if (MODIFIER_KEYS.has(event.key)) return { kind: "pending" };
    const token = keyToken(event);
    const familyHeld = CUSTOM_MODS[platform].every((m) =>
        m === "ctrl" ? event.ctrlKey : m === "meta" ? event.metaKey : event.altKey
    );
    const extraHeld = platform === "mac" ? event.altKey : event.metaKey;
    if (!token || !familyHeld || extraHeld) return { kind: "invalid" };
    const chord = customChord(token, platform);
    return RESERVED_KEYS[platform].includes(token)
        ? { kind: "reserved", chord }
        : { kind: "chord", chord };
};
