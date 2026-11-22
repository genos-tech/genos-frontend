// MIP-1920: an archived project is in no active list, so a reload (remembered id), Back or a
// link used to drop it and open another project. MIP-1918: the archived project's panels are
// not `inert`, so a task still opens and the panels still scroll.
import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tasksChannel } from "../db/workers/channels";
import {
    findProject,
    markProjectArchived,
    setArchivedProjects,
} from "../features/archive/archiveState";
import { loadTeamProjects } from "../features/tasks/services/loadTeamProjects";
import { useProjectManagement } from "../hooks/common/useProjectManagement";
import { syncStatus } from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({ tasksChannel: { request: vi.fn() } }));
vi.mock("../features/tasks/services/loadTeamProjects", () => ({ loadTeamProjects: vi.fn() }));

const listMock = loadTeamProjects as unknown as ReturnType<typeof vi.fn>;
const myself = { teamId: "team-1", userId: "" } as UserProps;
const project = (projectId: number) => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    projectLabels: [],
    isPrivate: false,
    systemUserId: "sys",
    isJoined: true,
});

beforeEach(() => {
    (tasksChannel.request as ReturnType<typeof vi.fn>).mockResolvedValue("done");
    listMock.mockReset();
    syncStatus.__reset();
    localStorage.clear();
    setArchivedProjects([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("an archived project can be reopened (MIP-1920)", () => {
    it("loadProjectsAndTasks keeps a remembered project that is archived", async () => {
        // The default list leaves the archived project out; include_archived returns it.
        listMock.mockImplementation(
            async (_m: unknown, _t: unknown, opts?: { includeArchived?: boolean }) =>
                opts?.includeArchived ? [project(5), project(7)] : [project(5)]
        );
        localStorage.setItem("lastProjectId", "7");
        const view = renderHook(() => useProjectManagement(myself, "tok", "team-1"));
        await act(async () => {
            await view.result.current.loadProjectsAndTasks(7);
        });
        expect(view.result.current.currentProject?.projectId).toBe(7);
        expect(localStorage.getItem("lastProjectId")).toBe("7");
    });

    it("findProject looks in the active list, then in the archived projects", () => {
        markProjectArchived(project(7), true);
        expect(findProject([project(5)], 5)?.projectId).toBe(5);
        expect(findProject([project(5)], 7)?.projectId).toBe(7);
        expect(findProject([project(5)], 9)).toBeUndefined();
    });
});

describe("the archived project's panels are not inert (MIP-1918)", () => {
    it("TaskHomeLayout sets no `inert` attribute", () => {
        const src = readFileSync(
            "src/features/tasks/components/layout/TaskHomeLayout.tsx",
            "utf8"
        );
        expect(src).not.toMatch(/inert=/);
    });
});
