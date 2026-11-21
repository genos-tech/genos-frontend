/**
 * The archive calls the project menu and the delete dialog make (MIP-1693): the endpoint,
 * the query, and the local archive state each one leaves behind.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveProject, unarchiveProject } from "../features/archive/archiveApi";
import { getArchiveSnapshot, resetArchiveStateForTests } from "../features/archive/archiveState";
import { loadTeamProjects } from "../features/tasks/services/loadTeamProjects";
import type { ProjectProps } from "../types/tasks";

const post = vi.fn();
const get = vi.fn();
vi.mock("../services/api", () => ({
    authApi: () => ({ post, get }),
}));

const project: ProjectProps = { projectId: 7, projectName: "Launch", projectTags: [] };

describe("archive project calls", () => {
    beforeEach(() => {
        post.mockReset();
        get.mockReset();
        resetArchiveStateForTests();
    });

    it("archives through the owner endpoint and records the project as archived", async () => {
        post.mockResolvedValue({ status: 200, data: { project_id: 7, archived: true } });
        await archiveProject("tok", "team-1", project);
        expect(post).toHaveBeenCalledWith("/project/archive/?team_id=team-1&project_id=7");
        expect(getArchiveSnapshot().archivedProjects.map((p) => p.projectId)).toEqual([7]);
    });

    it("restores through the unarchive endpoint and clears the archived mark", async () => {
        post.mockResolvedValue({ status: 200, data: { project_id: 7, archived: false } });
        await archiveProject("tok", "team-1", project);
        await unarchiveProject("tok", "team-1", project);
        expect(post).toHaveBeenLastCalledWith("/project/unarchive/?team_id=team-1&project_id=7");
        expect(getArchiveSnapshot().archivedProjects).toEqual([]);
    });

    it("leaves the archived state alone when the server refuses", async () => {
        post.mockRejectedValue(new Error("403"));
        await expect(archiveProject("tok", "team-1", project)).rejects.toThrow("403");
        expect(getArchiveSnapshot().archivedProjects).toEqual([]);
    });

    it("asks the project list for archived projects only when told to", async () => {
        get.mockResolvedValue({ data: [] });
        await loadTeamProjects({ teamId: "team-1", userId: "u1" }, "tok");
        expect(get.mock.calls[0][0]).not.toContain("include_archived");
        await loadTeamProjects({ teamId: "team-1", userId: "u1" }, "tok", {
            includeArchived: true,
        });
        expect(get.mock.calls[1][0]).toContain("include_archived=true");
    });
});
