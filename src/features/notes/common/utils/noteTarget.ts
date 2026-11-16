// A link to ONE BLOCK or ONE COMMENT THREAD of a note (MIP-146).
//
//   /workspace/notes/my/12?block=<blockId>        scroll to that block and highlight it
//   /workspace/notes/my/12?comment=<threadId>     open that comment thread's card
//
// It is the note's own URL plus ONE query parameter, so every note kind (my, shared, team, task,
// chat) shares the format and the note opens exactly as it does today when a client ignores it.
// `blockId` is the BlockNote block id (a UUID the editor keeps stable across saves; the same id
// `get_note`/the block-edit tool name a block by), `threadId` the comment thread's id.
//
// Reading the parameter is a ONE-SHOT: the URL layer is not the place that acts on it. The
// notes page rewrites the URL to the open note's canonical path (dropping the query) and a note
// opens asynchronously, so the target is captured when the location arrives (`captureNoteTarget`)
// into a small store, and the editor of THAT note consumes it once it can be shown
// (`useNoteDeepLink`). It expires, so a target for a note that never opens cannot fire later.

import { parseNoteRoute } from "../hooks/useNoteRouting";

export const BLOCK_PARAM = "block";
export const COMMENT_PARAM = "comment";

/** How long a captured target waits for its note to open and sync before it is dropped. */
export const TARGET_TTL_MS = 30_000;

// What a BlockNote block id or a thread id looks like. Anything else is not ours to look up
// (it ends up in a CSS selector and a Yjs lookup, so it is checked, not trusted).
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const isTargetId = (value: unknown): value is string =>
    typeof value === "string" && ID.test(value);

export type NoteKind = 1 | 2 | 3;

export type NoteTarget = {
    /** 1 personal (my, shared, team), 2 task note, 3 chat note: the editor's `noteType`. */
    noteType: NoteKind;
    noteId: number;
    blockId?: string;
    threadId?: string;
};

/** `path` with the block (or comment) target added. Exactly one of the two is written. */
export const withNoteTarget = (
    path: string,
    target: { blockId?: string; threadId?: string }
): string => {
    const [base] = path.split(/[?#]/);
    if (isTargetId(target.blockId)) return `${base}?${BLOCK_PARAM}=${target.blockId}`;
    if (isTargetId(target.threadId)) return `${base}?${COMMENT_PARAM}=${target.threadId}`;
    return base;
};

const KIND_BY_SEGMENT: Record<string, NoteKind> = { my: 1, shared: 1, team: 1, task: 2, chat: 3 };

/** The target a `pathname` + `search` names, or null when it names no note or no target. */
export const parseNoteTarget = (pathname: string, search: string): NoteTarget | null => {
    const route = parseNoteRoute(pathname);
    if (!route.noteType || !route.noteId || !Number.isInteger(route.noteId)) return null;
    const noteType = KIND_BY_SEGMENT[route.noteType];
    if (!noteType) return null;
    const params = new URLSearchParams(search);
    const blockId = params.get(BLOCK_PARAM);
    const threadId = params.get(COMMENT_PARAM);
    const target: NoteTarget = { noteType, noteId: route.noteId };
    if (isTargetId(blockId)) target.blockId = blockId;
    else if (isTargetId(threadId)) target.threadId = threadId;
    else return null;
    return target;
};

/** The same, from an href (absolute or relative), as the link modal receives it. */
export const parseNoteTargetFromHref = (href: string): NoteTarget | null => {
    try {
        const url = new URL(href, "http://x.invalid");
        return parseNoteTarget(url.pathname, url.search);
    } catch {
        return null;
    }
};

// ---- the one-shot store ----------------------------------------------------------------------

type Pending = NoteTarget & { at: number };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Remember a target for its note's editor to act on. A newer one replaces an older one. */
export const setNoteTarget = (target: NoteTarget, now: number = Date.now()): void => {
    pending = { ...target, at: now };
    emit();
};

/** Capture whatever target a location or an href names. True when it named one. */
export const captureNoteTarget = (pathname: string, search: string): boolean => {
    const target = parseNoteTarget(pathname, search);
    if (!target) return false;
    setNoteTarget(target);
    return true;
};

export const captureNoteTargetFromHref = (href: string): boolean => {
    const target = parseNoteTargetFromHref(href);
    if (!target) return false;
    setNoteTarget(target);
    return true;
};

/** The pending target, or null when none, or it has waited out `TARGET_TTL_MS`. */
export const peekNoteTarget = (now: number = Date.now()): NoteTarget | null => {
    if (!pending) return null;
    if (now - pending.at > TARGET_TTL_MS) {
        pending = null;
        return null;
    }
    return pending;
};

/** Drop the pending target, but only if it is still this one (a newer link may have replaced it). */
export const clearNoteTarget = (only?: NoteTarget | null): void => {
    if (!pending) return;
    if (only && pending !== (only as Pending)) return;
    pending = null;
    emit();
};

export const subscribeNoteTarget = (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

/** Forget everything (a test, or the member signing out). */
export const resetNoteTarget = (): void => {
    pending = null;
    emit();
};

// ---- building a link --------------------------------------------------------------------------

type NoteHost = {
    noteType: NoteKind;
    noteId: number;
    commentHost: {
        projectId?: number;
        taskId?: number;
        chatType?: number;
        chatId?: number | string;
        threadId?: number | string;
    };
};

const CHAT_SLUG: Record<number, string> = { 1: "dm", 2: "gm", 3: "pm", 4: "mdm" };

/**
 * The path of the note's own page. When the browser is ALREADY on this note, that path is used
 * as it is: it carries the sidebar bucket the member opened it from (my, shared or team), which
 * the editor cannot know. Otherwise (the note is previewed in a modal) it is built from what the
 * editor knows; a note that cannot be named (a chat note without its chat) gives null, and the
 * copy action is then not offered rather than offering a link that lands nowhere.
 */
export const notePathFor = (note: NoteHost, pathname: string): string | null => {
    const here = parseNoteRoute(pathname);
    if (
        here.noteId === note.noteId &&
        here.noteType &&
        KIND_BY_SEGMENT[here.noteType] === note.noteType
    ) {
        return pathname.replace(/\/+$/, "");
    }
    const host = note.commentHost;
    if (note.noteType === 1) return `/workspace/notes/my/${note.noteId}`;
    if (note.noteType === 2) {
        if (!host.projectId || !host.taskId) return null;
        return `/workspace/notes/task/project/${host.projectId}/task/${host.taskId}/note/${note.noteId}`;
    }
    const slug = host.chatType !== undefined ? CHAT_SLUG[host.chatType] : undefined;
    if (!slug || host.chatId === undefined || host.chatId === null) return null;
    return `/workspace/notes/chat/${slug}/${host.chatId}/thread/${host.threadId ?? 0}/note/${note.noteId}`;
};
