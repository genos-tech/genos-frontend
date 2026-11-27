/**
 * The member's own chords (MIP-2413), held outside React so the listeners that match through
 * the registry (`useShortcut`, the letter loop) read them at keydown time, and printers
 * re-render through `useShortcutsVersion`. Only the registry types are imported, so the
 * registry can read this store without a cycle.
 *
 * The one writer is `ShortcutOverridesBridge` (from the account's `ui_settings`).
 */
import type { Chord, Platform, ShortcutId } from "./registry";

export type Overrides = Readonly<Partial<Record<ShortcutId, Chord>>>;

const NONE: Overrides = {};
let store: Record<Platform, Overrides> = { mac: NONE, other: NONE };
let version = 0;
let recording = false;
const listeners = new Set<() => void>();

export const getOverrides = (platform: Platform): Overrides => store[platform];

const signature = (o: Overrides): string =>
    Object.entries(o)
        .map(([id, c]) => `${id}=${String(c?.key)}:${c?.mods.join("+")}`)
        .sort()
        .join(";");

export const applyOverrides = (platform: Platform, next: Overrides): void => {
    if (signature(store[platform]) === signature(next)) return;
    store = { ...store, [platform]: next };
    version += 1;
    listeners.forEach((listener) => listener());
};

export const subscribeShortcuts = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getShortcutsVersion = (): number => version;

/**
 * True while Settings is reading a new chord from the keyboard. No shortcut matches then:
 * Spotlight and undo listen in the capture phase and would otherwise fire on the very keys
 * the member is trying to record.
 */
export const setRecording = (next: boolean): void => {
    recording = next;
};
export const isRecording = (): boolean => recording;
