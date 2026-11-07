import { ReactNode, useSyncExternalStore } from "react";

/**
 * The toast store and API (MIP-1132). One host, one position (bottom
 * center), one place a toast can come from:
 *
 *     toast.success("Link copied");
 *     toast.error(message);                    // announced assertively
 *     toast.undoable("Task deleted", () => restore());
 *
 * A component that already owns an "open" flag (the old Snackbar pattern)
 * renders `<Toast open onClose>` instead; it lands in the same host.
 *
 * `undoable` is the pattern for any soft action (delete, archive, move):
 * do the action at once, then offer Undo for a few seconds rather than
 * asking "are you sure?" first.
 */

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export type ToastAction = {
    /** Defaults to the localized "Undo" for `undoable`. */
    label?: string;
    onClick: () => void;
};

export type ToastOptions = {
    /** Same id replaces the toast already showing instead of stacking. */
    id?: string;
    tone?: ToastTone;
    /** ms before it hides itself. `null` keeps it until dismissed. */
    duration?: number | null;
    action?: ToastAction;
};

export type ToastItem = {
    id: string;
    message: ReactNode;
    tone: ToastTone;
    duration: number | null;
    action?: ToastAction;
    /** Marks the Undo flavour so the host can supply the localized label. */
    undo?: boolean;
};

/** Longer when there is something to click: a person needs time to decide. */
export const DEFAULT_DURATION = 5000;
export const ACTION_DURATION = 8000;

/** Never stack more than this many; the oldest goes first. */
export const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

const show = (message: ReactNode, opts: ToastOptions & { undo?: boolean } = {}): string => {
    const id = opts.id ?? `toast-${++counter}`;
    const item: ToastItem = {
        id,
        message,
        tone: opts.tone ?? "neutral",
        // `undefined` means "the default for this kind"; `null` is "stay".
        duration:
            opts.duration !== undefined
                ? opts.duration
                : opts.action
                  ? ACTION_DURATION
                  : DEFAULT_DURATION,
        action: opts.action,
        undo: opts.undo,
    };
    const without = items.filter((i) => i.id !== id);
    items = [...without, item].slice(-MAX_VISIBLE);
    emit();
    return id;
};

const dismiss = (id: string) => {
    if (!items.some((i) => i.id === id)) return;
    items = items.filter((i) => i.id !== id);
    emit();
};

export const toast = {
    show,
    dismiss,
    neutral: (message: ReactNode, opts?: Omit<ToastOptions, "tone">) =>
        show(message, { ...opts, tone: "neutral" }),
    success: (message: ReactNode, opts?: Omit<ToastOptions, "tone">) =>
        show(message, { ...opts, tone: "success" }),
    warning: (message: ReactNode, opts?: Omit<ToastOptions, "tone">) =>
        show(message, { ...opts, tone: "warning" }),
    error: (message: ReactNode, opts?: Omit<ToastOptions, "tone">) =>
        show(message, { ...opts, tone: "danger" }),
    /** Do the thing first, then offer Undo. `onUndo` runs once. */
    undoable: (
        message: ReactNode,
        onUndo: () => void,
        opts?: Omit<ToastOptions, "action"> & { undoLabel?: string }
    ) =>
        show(message, {
            ...opts,
            undo: true,
            action: { label: opts?.undoLabel, onClick: onUndo },
        }),
};

export const useToasts = (): ToastItem[] =>
    useSyncExternalStore(
        subscribe,
        () => items,
        () => items
    );

/** Test helper: forget every toast. */
export const __resetToasts = () => {
    items = [];
    counter = 0;
    emit();
};
