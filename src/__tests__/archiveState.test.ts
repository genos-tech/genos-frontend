/**
 * The archive state every sidebar, banner and write control reads (MIP-1693).
 *
 * The API does not put an archived flag on a project or chat row. The state is
 * therefore the set of archived ids the client learned from `include_archived=true`
 * minus the default list. These tests pin the derivation and the changes an archive or
 * restore makes locally, before the next list refresh.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
    getArchiveSnapshot,
    isChatArchived,
    isProjectArchived,
    markChannelArchived,
    markProjectArchived,
    resetArchiveStateForTests,
    setArchivedChannelIds,
    setArchivedProjects,
    visibleChats,
} from "../features/archive/archiveState";
import type { ProjectProps } from "../types/tasks";

const project = (projectId: number, projectName = `P${projectId}`): ProjectProps => ({
    projectId,
    projectName,
    projectTags: [],
    isJoined: true,
});

describe("archive state", () => {
    beforeEach(() => {
        resetArchiveStateForTests();
    });

    it("starts with nothing archived", () => {
        expect(getArchiveSnapshot().archivedProjects).toEqual([]);
        expect(isProjectArchived(1)).toBe(false);
        expect(isChatArchived({ chatId: "c1", projectId: null })).toBe(false);
    });

    it("reports an archived project and the chats that belong to it", () => {
        setArchivedProjects([project(7)]);
        expect(isProjectArchived(7)).toBe(true);
        expect(isProjectArchived(8)).toBe(false);
        // A project chat is archived with its project even if the chat id is not listed.
        expect(isChatArchived({ chatId: "pm-7", projectId: 7 })).toBe(true);
        expect(isChatArchived({ chatId: "pm-8", projectId: 8 })).toBe(false);
    });

    it("reports an archived group chat by its id, whatever its project", () => {
        setArchivedChannelIds(["gm-1"]);
        expect(isChatArchived({ chatId: "gm-1", projectId: null })).toBe(true);
        expect(isChatArchived({ chatId: "gm-2", projectId: null })).toBe(false);
    });

    it("moves a project in and out of the archived set locally", () => {
        markProjectArchived(project(3), true);
        expect(isProjectArchived(3)).toBe(true);
        expect(getArchiveSnapshot().archivedProjects.map((p) => p.projectId)).toEqual([3]);

        markProjectArchived(project(3), false);
        expect(isProjectArchived(3)).toBe(false);
        expect(getArchiveSnapshot().archivedProjects).toEqual([]);
    });

    it("moves a group chat in and out of the archived set locally", () => {
        markChannelArchived("gm-9", true);
        expect(isChatArchived({ chatId: "gm-9", projectId: null })).toBe(true);
        markChannelArchived("gm-9", false);
        expect(isChatArchived({ chatId: "gm-9", projectId: null })).toBe(false);
    });

    it("keeps the same snapshot object when a refresh changes nothing", () => {
        setArchivedProjects([project(5)]);
        const before = getArchiveSnapshot();
        setArchivedProjects([project(5)]);
        expect(getArchiveSnapshot()).toBe(before);
    });

    it("hides archived chats from a pane unless asked, and shows them when asked", () => {
        setArchivedChannelIds(["gm-old"]);
        const chats = [
            { chatId: "gm-new", projectId: null },
            { chatId: "gm-old", projectId: null },
        ];
        expect(visibleChats(chats, false).map((c) => c.chatId)).toEqual(["gm-new"]);
        expect(visibleChats(chats, true).map((c) => c.chatId)).toEqual(["gm-new", "gm-old"]);
    });
});
