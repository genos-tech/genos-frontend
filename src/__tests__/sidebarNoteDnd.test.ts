import { DropResult } from "@hello-pangea/dnd";
import { describe, expect, it } from "vitest";

import {
    buildNoteDraggableId,
    chatContainerId,
    droppableId,
    myFolderContainerId,
    myRootContainerId,
    parseContainerId,
    parseDropResult,
    parseNoteDraggableId,
    taskContainerId,
} from "../features/notes/common/dnd/sidebarNoteDnd";

const dropResult = (
    draggableId: string,
    sourceDroppableId: string,
    destDroppableId: string | null
): DropResult =>
    ({
        draggableId,
        type: "note-1",
        source: { droppableId: sourceDroppableId, index: 0 },
        destination: destDroppableId ? { droppableId: destDroppableId, index: 0 } : null,
        reason: "DROP",
        mode: "FLUID",
        combine: null,
    }) as unknown as DropResult;

describe("draggable id codec", () => {
    it("round-trips all three kinds", () => {
        for (const kind of [1, 2, 3] as const) {
            const id = buildNoteDraggableId(kind, 42);
            expect(parseNoteDraggableId(id)).toEqual({ kind, noteId: 42 });
        }
    });

    it("rejects malformed ids", () => {
        expect(parseNoteDraggableId("n4-1")).toBeNull();
        expect(parseNoteDraggableId("n1-abc")).toBeNull();
        expect(parseNoteDraggableId("task-1-2")).toBeNull();
        expect(parseNoteDraggableId("")).toBeNull();
    });
});

describe("container id codec", () => {
    it("round-trips containers with either role prefix", () => {
        expect(parseContainerId(droppableId("hdr", myRootContainerId()))).toEqual({
            kind: "my",
            folderId: null,
        });
        expect(parseContainerId(droppableId("lst", myFolderContainerId(7)))).toEqual({
            kind: "my",
            folderId: 7,
        });
        expect(parseContainerId(droppableId("hdr", taskContainerId(3, 99)))).toEqual({
            kind: "task",
            projectId: 3,
            taskId: 99,
        });
        // Chat container carries the v3 channel UUID string.
        const uuid = "0b7c9a4e-1111-2222-3333-444455556666";
        expect(parseContainerId(droppableId("lst", chatContainerId(2, uuid)))).toEqual({
            kind: "chat",
            chatType: 2,
            channelId: uuid,
        });
    });

    it("rejects malformed ids", () => {
        expect(parseContainerId("lst:bogus")).toBeNull();
        expect(parseContainerId("my-folder-x")).toBeNull();
        expect(parseContainerId("task-1")).toBeNull();
    });
});

describe("parseDropResult", () => {
    it("maps a my-note drop onto a folder", () => {
        const result = dropResult(
            buildNoteDraggableId(1, 5),
            droppableId("lst", myRootContainerId()),
            droppableId("hdr", myFolderContainerId(9))
        );
        expect(parseDropResult(result)).toEqual({ kind: "my", noteId: 5, folderId: 9 });
    });

    it("maps a task-note drop onto another task", () => {
        const result = dropResult(
            buildNoteDraggableId(2, 5),
            droppableId("lst", taskContainerId(1, 10)),
            droppableId("hdr", taskContainerId(1, 20))
        );
        expect(parseDropResult(result)).toEqual({
            kind: "task",
            noteId: 5,
            projectId: 1,
            taskId: 20,
        });
    });

    it("maps a chat-note drop onto another chat", () => {
        const result = dropResult(
            buildNoteDraggableId(3, 5),
            droppableId("lst", chatContainerId(2, "aaa")),
            droppableId("hdr", chatContainerId(2, "bbb"))
        );
        expect(parseDropResult(result)).toEqual({
            kind: "chat",
            noteId: 5,
            chatType: 2,
            channelId: "bbb",
        });
    });

    it("returns null when dropped outside any target", () => {
        const result = dropResult(
            buildNoteDraggableId(1, 5),
            droppableId("lst", myRootContainerId()),
            null
        );
        expect(parseDropResult(result)).toBeNull();
    });

    it("returns null on same-container drops, across hdr/lst roles", () => {
        const result = dropResult(
            buildNoteDraggableId(1, 5),
            droppableId("lst", myFolderContainerId(9)),
            droppableId("hdr", myFolderContainerId(9))
        );
        expect(parseDropResult(result)).toBeNull();
    });

    it("returns null on kind mismatch (double-safety over the type system)", () => {
        const result = dropResult(
            buildNoteDraggableId(1, 5),
            droppableId("lst", myRootContainerId()),
            droppableId("hdr", taskContainerId(1, 2))
        );
        expect(parseDropResult(result)).toBeNull();
    });
});
