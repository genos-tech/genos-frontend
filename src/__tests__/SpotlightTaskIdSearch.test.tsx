/**
 * Spotlight's search by task id (MIP-1040).
 *
 * OpenSearch cannot find "MIP-890" (the display id is in no chunk and no query). A
 * query that is NOTHING BUT an id is looked up by number (`lookupTaskByDisplayId`,
 * `GET /search/taskByDisplayId/`) alongside the ordinary search, and the one task or
 * milestone it finds is pinned at the top. Ken's rule: only the id, spelled any of the
 * usual ways; any other word and there is no id match.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    idHitPassesFilter,
    spotlightResultForTask,
    withIdHit,
} from "../features/spotlight/displayIdHit";
import type { SpotlightResult } from "../features/spotlight/types";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { lookupTaskByDisplayId } from "../features/tasks/services/lookupTaskByDisplayId";
import { displayIdOnlyQuery } from "../features/tasks/utils/taskDisplayId";
import { searchSpotlight } from "../services/searchApi";
import type { SearchTeamTasksResponse } from "../types/tasks";
import { canonicalSpotlightHref } from "../utils/canonicalSpotlightHref";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return { ...actual, askAgentStream: vi.fn(), fetchAgentSessions: vi.fn(async () => []) };
});
vi.mock("../services/searchApi", () => ({ searchSpotlight: vi.fn() }));
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));
vi.mock("../features/tasks/services/lookupTaskByDisplayId", () => ({
    lookupTaskByDisplayId: vi.fn(),
}));

const row = (over: Partial<SearchTeamTasksResponse> = {}): SearchTeamTasksResponse => ({
    projectId: 1,
    projectName: "Genos-Alpha",
    projectCode: "MIP",
    projectTags: [],
    systemUserId: "sys",
    taskId: 1857,
    displayId: "MIP-890",
    title: "Converge the answer renderers",
    isMilestone: false,
    status: { code: 0, status: "WIP", color: "", textColor: "" } as never,
    tsUpdated: "2026-11-06T00:00:00Z",
    ...over,
});

const searchHit = (over: Partial<SpotlightResult>): SpotlightResult => ({
    ...spotlightResultForTask(row({ taskId: 1, displayId: "MIP-1", title: "other" })),
    score: 0.5,
    ...over,
});

describe("displayIdOnlyQuery: a query that is nothing but an id", () => {
    it.each([
        ["MIP-890", "MIP-890"],
        ["MIP-89", "MIP-89"],
        ["MIP-891", "MIP-891"],
        ["MIP 890", "MIP-890"],
        ["mip 890", "MIP-890"],
        ["mip-890", "MIP-890"],
        ["mip890", "MIP-890"],
        ["#MIP-890", "MIP-890"],
        ["  MIP - 890  ", "MIP-890"],
        ["MIP-0890", "MIP-890"],
        ["KDS2 15", "KDS2-15"],
    ])("%j is the id %s", (typed, id) => {
        expect(displayIdOnlyQuery(typed)).toBe(id);
    });

    it.each([
        "MIP-890 chips",
        "fix MIP-890",
        "MIP-890, MIP-891",
        "890",
        "MIP",
        "MIP-",
        "M-890",
        "",
        "   ",
        "MIPMIPM-1",
    ])("%j is not an id", (typed) => {
        expect(displayIdOnlyQuery(typed)).toBeNull();
    });

    it("treats a short id as that task, not a prefix: MIP-89 is task 89", () => {
        expect(displayIdOnlyQuery("MIP-89")).toBe("MIP-89");
        expect(displayIdOnlyQuery("MIP-8")).toBe("MIP-8");
    });
});

describe("spotlightResultForTask", () => {
    it("shapes a task row as a task result that opens the task", () => {
        const r = spotlightResultForTask(row());
        expect(r).toMatchObject({
            entity_type: "task",
            entity_id: "task:1857",
            task_id: "1857",
            task_display_id: "MIP-890",
            project_id: "1",
            title: "Converge the answer renderers",
            task_status: "WIP",
        });
        expect(canonicalSpotlightHref(r)).toBe("/workspace/tasks/project/1/task/1857");
    });

    it("shapes a milestone row by its own id, which is how a milestone opens", () => {
        const r = spotlightResultForTask(row({ isMilestone: true, milestoneId: 111 }));
        expect(r.entity_type).toBe("milestone");
        expect(r.entity_id).toBe("milestone:111");
        expect(canonicalSpotlightHref(r)).toBe("/workspace/tasks/project/1/milestone/111");
    });

    it("falls back to the backing task's route when the backend sends no milestone id", () => {
        const r = spotlightResultForTask(row({ isMilestone: true }));
        expect(r.entity_type).toBe("milestone");
        expect(canonicalSpotlightHref(r)).toBe("/workspace/tasks/project/1/task/1857");
    });
});

describe("withIdHit and idHitPassesFilter", () => {
    const hit = spotlightResultForTask(row());

    it("puts the hit first and drops the same task found by the search", () => {
        const dupTask = searchHit({ entity_id: "task:1857", task_id: "1857" });
        const dupMilestone = searchHit({
            entity_type: "milestone",
            entity_id: "milestone:5",
            task_id: "1857",
        });
        const other = searchHit({});
        expect(withIdHit([dupTask, other, dupMilestone], hit)).toEqual([hit, other]);
    });

    it("returns the search results themselves when there is no hit", () => {
        const results = [searchHit({})];
        expect(withIdHit(results, null)).toBe(results);
    });

    it("lets the hit through only when the chips and the project scope allow it", () => {
        expect(idHitPassesFilter(hit, undefined, undefined)).toBe(true);
        expect(idHitPassesFilter(hit, ["task", "milestone"], undefined)).toBe(true);
        expect(idHitPassesFilter(hit, ["chat"], undefined)).toBe(false);
        expect(idHitPassesFilter(hit, undefined, ["1"])).toBe(true);
        expect(idHitPassesFilter(hit, undefined, ["2"])).toBe(false);
    });
});

describe("useSpotlight: the hit pinned at the top", () => {
    const other = searchHit({});
    const dup = searchHit({ entity_id: "task:1857", task_id: "1857", title: "dup" });

    beforeEach(() => {
        localStorage.clear();
        vi.mocked(searchSpotlight).mockReset();
        vi.mocked(searchSpotlight).mockResolvedValue({ results: [dup, other] } as never);
        vi.mocked(lookupTaskByDisplayId).mockReset();
        vi.mocked(lookupTaskByDisplayId).mockResolvedValue(row());
    });

    const open = () => {
        const hook = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
        );
        return hook;
    };

    it("looks the id up and pins the task, without the duplicate the search found", async () => {
        const { result } = open();
        act(() => result.current.setQuery("mip 890"));
        await waitFor(() => expect(result.current.results[0]?.entity_id).toBe("task:1857"));
        expect(lookupTaskByDisplayId).toHaveBeenCalledWith({ teamId: "team-1" }, "MIP-890", "tok");
        await waitFor(() => expect(result.current.results).toHaveLength(2));
        expect(result.current.results.map((r) => r.title)).toEqual([
            "Converge the answer renderers",
            "other",
        ]);
    });

    it("does not look anything up when the query has other words", async () => {
        const { result } = open();
        act(() => result.current.setQuery("MIP-890 chips"));
        await waitFor(() => expect(result.current.results).toHaveLength(2));
        expect(lookupTaskByDisplayId).not.toHaveBeenCalled();
        expect(result.current.results[0].title).toBe("dup");
    });

    it("pins nothing when no task has that id (or the person cannot see it)", async () => {
        vi.mocked(lookupTaskByDisplayId).mockResolvedValue(null);
        const { result } = open();
        act(() => result.current.setQuery("MIP-99999"));
        await waitFor(() => expect(result.current.results).toHaveLength(2));
        expect(result.current.results[0].title).toBe("dup");
    });

    it("hides the hit at once when the query stops being that id", async () => {
        const { result } = open();
        act(() => result.current.setQuery("MIP-890"));
        await waitFor(() => expect(result.current.results[0]?.entity_id).toBe("task:1857"));
        vi.mocked(searchSpotlight).mockResolvedValue({ results: [other] } as never);
        act(() => result.current.setQuery("MIP-890 x"));
        expect(
            result.current.results.some((r) => r.title === "Converge the answer renderers")
        ).toBe(false);
    });

    it("respects a Chat-only chip and a project scope that exclude the task", async () => {
        const { result } = open();
        act(() => result.current.setQuery("MIP-890"));
        await waitFor(() => expect(result.current.results[0]?.entity_id).toBe("task:1857"));
        act(() => result.current.onToggleFilterService("chat"));
        expect(
            result.current.results.some((r) => r.title === "Converge the answer renderers")
        ).toBe(false);
        act(() => result.current.onToggleFilterService("chat"));
        act(() => result.current.onChangeFilterProjects([2]));
        expect(
            result.current.results.some((r) => r.title === "Converge the answer renderers")
        ).toBe(false);
    });

    it("looks nothing up while neither the overlay nor the Genos page is showing", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => result.current.setQuery("MIP-890"));
        await new Promise((r) => setTimeout(r, 0));
        expect(lookupTaskByDisplayId).not.toHaveBeenCalled();
    });
});
