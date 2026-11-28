/**
 * The signals, beside a card message being rewritten, that a task card may be out of date
 * (MIP-2484). All of them already exist; none is added for the cards.
 */

import {
    onCommentsResync,
    onTaskMetadataSaved,
    onTasksBulkChanged,
    onTaskTouched,
} from "../../tasks/services/taskEvents";
import { invalidateMilestoneCards, invalidateTaskCards } from "./taskCardStore";

/** A burst of saves (a bulk close, typing in a body) reads once. */
const SETTLE_MS = 800;

const pending = new Set<number>();
let all = false;
let milestones = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const run = () => {
    timer = null;
    if (all) invalidateTaskCards();
    else {
        if (pending.size > 0) invalidateTaskCards([...pending]);
        if (milestones) invalidateMilestoneCards();
    }
    pending.clear();
    all = false;
    milestones = false;
};

const later = () => {
    if (timer === null) timer = setTimeout(run, SETTLE_MS);
};

/** A card message in a project chat was posted or rewritten: a task was made or changed,
 *  and a milestone's progress may have moved with it. */
export const noteCardMessageUpdated = (message: {
    channelKind?: number;
    isThreadReply?: boolean;
    taskId?: number | null;
    metadata?: Record<string, unknown> | null;
}): void => {
    if (message.channelKind !== 3 || message.isThreadReply) return;
    if (message.taskId == null && typeof message.metadata?.taskId !== "number") return;
    milestones = true;
    later();
};

export const installTaskCardSignals = (): (() => void) => {
    const everything = () => {
        all = true;
        later();
    };
    const offs = [
        onCommentsResync(everything),
        onTaskMetadataSaved(everything),
        onTasksBulkChanged(everything),
        onTaskTouched(({ taskId, kind }) => {
            if (kind === "comment") return;
            pending.add(taskId);
            if (kind === "children") milestones = true;
            later();
        }),
    ];
    return () => offs.forEach((off) => off());
};
