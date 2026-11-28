// MIP-2564: a failed project or tag list request leaves the options as they are
// instead of throwing "Cannot read properties of undefined (reading 'length')".
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    updateProjectOptions,
    updateTagOptions,
} from "../features/tasks/services/updateTaskAutoCompleteOptions";
import { UserProps } from "../types/admin";

const get = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ get }) }));
vi.mock("../db/workers/channels", () => ({ usersChannel: { request: vi.fn() } }));

const myself = { teamId: "t1", userId: "u1" } as UserProps;

describe("task option loaders on a failed request", () => {
    beforeEach(() => {
        get.mockReset();
        get.mockRejectedValue(new Error("network down"));
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("keeps the project options", async () => {
        const setTeamProjects = vi.fn();
        await expect(
            updateProjectOptions({ myself, accessToken: "a", setTeamProjects })
        ).resolves.toBeUndefined();
        expect(setTeamProjects).not.toHaveBeenCalled();
    });

    it("keeps the tag options", async () => {
        const setProjectTags = vi.fn();
        await expect(
            updateTagOptions({ myself, accessToken: "a", projectId: 1, setProjectTags })
        ).resolves.toBeUndefined();
        expect(setProjectTags).not.toHaveBeenCalled();
    });
});
