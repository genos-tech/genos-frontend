import { useSyncExternalStore } from "react";

/**
 * MIP-1972: "a milestone was just picked and the task page is not showing it yet".
 *
 * It lives outside React state on purpose. The click has to paint something at once, and
 * every `useTM` setter re-renders the whole task page (about 400 ms with a big project).
 * An external store is read by one small component (`MilestoneSwitchGate`), so the click
 * commits only that component first; the page's own state changes then run in a
 * transition and no longer hold the first paint back.
 *
 * `begin` is called by the sidebar click, `end` by the table once its rows are the picked
 * milestone's. A safety timer clears a switch that never completes (a project that failed
 * to open), so the gate can never stay up.
 */
const SAFETY_MS = 6000;

let pending: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const beginMilestoneSwitch = (milestoneId: number) => {
    pending = milestoneId;
    clearTimeout(timer);
    timer = setTimeout(endMilestoneSwitch, SAFETY_MS);
    emit();
};

export function endMilestoneSwitch() {
    clearTimeout(timer);
    if (pending === null) return;
    pending = null;
    emit();
}

export const getPendingMilestoneSwitch = () => pending;

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const usePendingMilestoneSwitch = () =>
    useSyncExternalStore(subscribe, getPendingMilestoneSwitch, () => null);
