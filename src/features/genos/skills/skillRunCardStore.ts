import { useSyncExternalStore } from "react";

/**
 * The first-run card as a question the ask flow can await (MIP-2192).
 *
 * The ask's 409 `skill_needs_confirmation` comes from deep inside `useAgentQA`, which every ask
 * surface shares (the thread ask, the note ask, Spotlight, the Genos page). Rather than give each
 * surface its own dialog, the hook calls `requestSkillRunConfirmation(...)` and awaits the person's
 * answer; the ONE `SkillRunCardHost` (mounted once in `App`) draws the card.
 *
 *     const confirmed = await requestSkillRunConfirmation({ teamId, skillId, versionNo });
 *
 * Resolves `true` after the person pressed "Run this skill" and the server recorded it, `false` when
 * they cancelled, when another request replaced this one, or when no host is mounted (nothing could
 * ask them, so nothing may run).
 */

export type SkillRunRequest = {
    teamId: string;
    skillId: string;
    versionNo: number;
};

type Pending = SkillRunRequest & { resolve: (confirmed: boolean) => void };

let pending: Pending | null = null;
let hosts = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const requestSkillRunConfirmation = (request: SkillRunRequest): Promise<boolean> => {
    if (hosts === 0) return Promise.resolve(false);
    // One card at a time: a newer request means the person moved on from the older one.
    pending?.resolve(false);
    return new Promise<boolean>((resolve) => {
        pending = { ...request, resolve };
        emit();
    });
};

/** The host's answer. A stale call (the request already replaced or settled) does nothing. */
export const settleSkillRunConfirmation = (request: SkillRunRequest, confirmed: boolean): void => {
    if (
        !pending ||
        pending.skillId !== request.skillId ||
        pending.versionNo !== request.versionNo
    ) {
        return;
    }
    const settled = pending;
    pending = null;
    emit();
    settled.resolve(confirmed);
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const snapshot = (): SkillRunRequest | null => pending;

/** The request the card is open for, or null. */
export const useSkillRunRequest = (): SkillRunRequest | null =>
    useSyncExternalStore(subscribe, snapshot, snapshot);

/** A host calls this while mounted, so a request knows someone can answer it. */
export const registerSkillRunCardHost = (): (() => void) => {
    hosts += 1;
    return () => {
        hosts -= 1;
        if (hosts === 0 && pending) {
            const open = pending;
            pending = null;
            emit();
            open.resolve(false);
        }
    };
};
