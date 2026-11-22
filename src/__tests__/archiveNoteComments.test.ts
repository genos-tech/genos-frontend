/** MIP-1693: a note's comments are closed in an archived project or chat; the rule reads the archive state. */
import { beforeEach, describe, expect, it } from "vitest";

import {
    getArchiveSnapshot,
    isNoteCommentingArchived,
    markChannelArchived,
    markProjectArchived,
    resetArchiveStateForTests,
} from "../features/archive/archiveState";
import type { ProjectProps } from "../types/tasks";

const project = (projectId: number): ProjectProps => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    isJoined: true,
});

describe("isNoteCommentingArchived", () => {
    beforeEach(() => resetArchiveStateForTests());

    it("is false when nothing is archived", () => {
        expect(isNoteCommentingArchived(getArchiveSnapshot(), { projectId: 7 })).toBe(false);
    });

    it("closes a task note's comments when its project is archived, and only that project", () => {
        markProjectArchived(project(7), true);
        const state = getArchiveSnapshot();
        expect(isNoteCommentingArchived(state, { projectId: 7 })).toBe(true);
        expect(isNoteCommentingArchived(state, { projectId: 8 })).toBe(false);
    });

    it("closes a chat note's comments when its chat is archived", () => {
        markChannelArchived("12", true);
        const state = getArchiveSnapshot();
        expect(isNoteCommentingArchived(state, { chatId: 12 })).toBe(true);
        expect(isNoteCommentingArchived(state, { chatId: 13 })).toBe(false);
    });

    it("reopens after unarchive", () => {
        markProjectArchived(project(7), true);
        markProjectArchived(project(7), false);
        expect(isNoteCommentingArchived(getArchiveSnapshot(), { projectId: 7 })).toBe(false);
    });

    it("a personal note (no host ids) is never closed", () => {
        markProjectArchived(project(7), true);
        expect(isNoteCommentingArchived(getArchiveSnapshot(), {})).toBe(false);
    });
});
