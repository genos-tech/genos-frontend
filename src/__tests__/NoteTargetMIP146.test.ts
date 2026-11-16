/**
 * MIP-146: a link to ONE block or ONE comment of a note.
 *
 *   /workspace/notes/my/12?block=<blockId>      /workspace/notes/my/12?comment=<threadId>
 *
 * These pin the format (one query parameter on the note's own URL, every note kind), what is
 * refused (an id that is not a block/thread id never reaches a selector or a lookup), the
 * one-shot store the editor reads from (newer replaces older, expires, cleared only if it is
 * still the same target), and how the note's own path is found.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    captureNoteTarget,
    captureNoteTargetFromHref,
    clearNoteTarget,
    isTargetId,
    notePathFor,
    parseNoteTarget,
    parseNoteTargetFromHref,
    peekNoteTarget,
    resetNoteTarget,
    setNoteTarget,
    subscribeNoteTarget,
    TARGET_TTL_MS,
    withNoteTarget,
} from "../features/notes/common/utils/noteTarget";

const BLOCK = "6c1c0a52-2a36-4a2f-93cb-0d1a1b6f8c11";
const THREAD = "0e51b6f1-aaaa-4bbb-8ccc-ddddeeeeffff";

beforeEach(() => resetNoteTarget());
afterEach(() => resetNoteTarget());

describe("the link format", () => {
    it("adds one block parameter to the note's own path", () => {
        expect(withNoteTarget("/workspace/notes/my/12", { blockId: BLOCK })).toBe(
            `/workspace/notes/my/12?block=${BLOCK}`
        );
    });

    it("adds one comment parameter instead for a thread", () => {
        expect(withNoteTarget("/workspace/notes/my/12", { threadId: THREAD })).toBe(
            `/workspace/notes/my/12?comment=${THREAD}`
        );
    });

    it("replaces any query or hash already on the path, and writes only one parameter", () => {
        expect(
            withNoteTarget("/workspace/notes/my/12?block=old#x", {
                blockId: BLOCK,
                threadId: THREAD,
            })
        ).toBe(`/workspace/notes/my/12?block=${BLOCK}`);
    });

    it("writes no parameter for an id that is not an id", () => {
        expect(withNoteTarget("/workspace/notes/my/12", { blockId: 'a"] x' })).toBe(
            "/workspace/notes/my/12"
        );
    });

    it.each([
        ["/workspace/notes/my/12", 1],
        ["/workspace/notes/shared/12", 1],
        ["/workspace/notes/team/12", 1],
        ["/workspace/notes/task/project/3/task/4/note/12", 2],
        ["/workspace/notes/chat/gm/c1/thread/t1/note/12", 3],
    ])("reads a block target off %s (kind %i)", (path, noteType) => {
        expect(parseNoteTarget(path, `?block=${BLOCK}`)).toEqual({
            noteType,
            noteId: 12,
            blockId: BLOCK,
        });
    });

    it("reads a comment target", () => {
        expect(parseNoteTarget("/workspace/notes/my/12", `?comment=${THREAD}`)).toEqual({
            noteType: 1,
            noteId: 12,
            threadId: THREAD,
        });
    });

    it("reads one from an absolute or a relative href", () => {
        const want = { noteType: 1, noteId: 12, blockId: BLOCK };
        expect(
            parseNoteTargetFromHref(`https://app.example/workspace/notes/my/12?block=${BLOCK}`)
        ).toEqual(want);
        expect(parseNoteTargetFromHref(`/workspace/notes/my/12?block=${BLOCK}`)).toEqual(want);
    });

    it.each([
        ["no parameter", "/workspace/notes/my/12", ""],
        ["not a note", "/workspace/tasks/project/1", `?block=${BLOCK}`],
        ["no note id", "/workspace/notes/my", `?block=${BLOCK}`],
        ["a folder", "/workspace/notes/folder/3", `?block=${BLOCK}`],
        [
            "a selector-breaking id",
            "/workspace/notes/my/12",
            `?block=${encodeURIComponent('a"]')}`,
        ],
        ["an empty id", "/workspace/notes/my/12", "?block="],
        ["an over-long id", "/workspace/notes/my/12", `?block=${"a".repeat(65)}`],
    ])("names no target when there is %s", (_label, path, search) => {
        expect(parseNoteTarget(path, search)).toBeNull();
    });

    it("accepts the ids a block or a thread really has, and nothing else", () => {
        expect(isTargetId(BLOCK)).toBe(true);
        expect(isTargetId("abc_DEF-123")).toBe(true);
        for (const bad of ["", "a b", 'a"b', "a]b", "a/b", "x".repeat(65), 12, null, undefined]) {
            expect(isTargetId(bad)).toBe(false);
        }
    });
});

describe("the one-shot store", () => {
    const target = { noteType: 1 as const, noteId: 12, blockId: BLOCK };

    it("holds a captured target for its note's editor", () => {
        expect(captureNoteTarget("/workspace/notes/my/12", `?block=${BLOCK}`)).toBe(true);
        expect(peekNoteTarget()).toMatchObject(target);
    });

    it("captures from an href the same way", () => {
        expect(captureNoteTargetFromHref(`/workspace/notes/my/12?block=${BLOCK}`)).toBe(true);
        expect(peekNoteTarget()).toMatchObject(target);
    });

    it("captures nothing from a plain note link, and leaves a pending target alone", () => {
        setNoteTarget(target);
        expect(captureNoteTarget("/workspace/notes/my/12", "")).toBe(false);
        expect(peekNoteTarget()).toMatchObject(target);
    });

    it("lets a newer link replace an older one", () => {
        setNoteTarget(target);
        setNoteTarget({ noteType: 1, noteId: 13, threadId: THREAD });
        expect(peekNoteTarget()).toMatchObject({ noteId: 13, threadId: THREAD });
    });

    it("expires, so a target for a note that never opened cannot fire much later", () => {
        setNoteTarget(target, 1_000);
        expect(peekNoteTarget(1_000 + TARGET_TTL_MS)).not.toBeNull();
        expect(peekNoteTarget(1_000 + TARGET_TTL_MS + 1)).toBeNull();
        expect(peekNoteTarget(1_000)).toBeNull(); // and it is gone, not just hidden
    });

    it("clears only the target it is asked to clear", () => {
        setNoteTarget(target);
        const first = peekNoteTarget();
        setNoteTarget({ noteType: 1, noteId: 13, blockId: BLOCK });
        clearNoteTarget(first); // a slow editor finishing the OLD target
        expect(peekNoteTarget()).toMatchObject({ noteId: 13 });
        clearNoteTarget(peekNoteTarget());
        expect(peekNoteTarget()).toBeNull();
    });

    it("tells subscribers when it changes", () => {
        let calls = 0;
        const off = subscribeNoteTarget(() => (calls += 1));
        setNoteTarget(target);
        clearNoteTarget();
        off();
        setNoteTarget(target);
        expect(calls).toBe(2);
    });
});

describe("the note's own path", () => {
    const host = { projectId: 3, taskId: 4, chatType: 2, chatId: "c1", threadId: "t1" };

    it("keeps the page's own path when the browser is already on this note", () => {
        // The bucket (my, shared, team) is in the URL the member opened it from; the editor
        // cannot know it, so it must not rebuild it.
        expect(
            notePathFor({ noteType: 1, noteId: 12, commentHost: {} }, "/workspace/notes/shared/12")
        ).toBe("/workspace/notes/shared/12");
        expect(
            notePathFor({ noteType: 1, noteId: 12, commentHost: {} }, "/workspace/notes/team/12/")
        ).toBe("/workspace/notes/team/12");
    });

    it("builds it from what the editor knows when the note is previewed elsewhere", () => {
        expect(
            notePathFor({ noteType: 1, noteId: 12, commentHost: {} }, "/workspace/chat/gm/x")
        ).toBe("/workspace/notes/my/12");
        expect(
            notePathFor({ noteType: 2, noteId: 12, commentHost: host }, "/workspace/tasks")
        ).toBe("/workspace/notes/task/project/3/task/4/note/12");
        expect(
            notePathFor({ noteType: 3, noteId: 12, commentHost: host }, "/workspace/tasks")
        ).toBe("/workspace/notes/chat/gm/c1/thread/t1/note/12");
    });

    it("does not take another note's page for this one", () => {
        expect(
            notePathFor({ noteType: 1, noteId: 12, commentHost: {} }, "/workspace/notes/my/99")
        ).toBe("/workspace/notes/my/12");
    });

    it("gives null for a note it cannot name, so no dead link is offered", () => {
        expect(notePathFor({ noteType: 2, noteId: 12, commentHost: {} }, "/x")).toBeNull();
        expect(
            notePathFor({ noteType: 3, noteId: 12, commentHost: { chatType: 9 } }, "/x")
        ).toBeNull();
        expect(
            notePathFor({ noteType: 3, noteId: 12, commentHost: { chatType: 2 } }, "/x")
        ).toBeNull();
    });
});
