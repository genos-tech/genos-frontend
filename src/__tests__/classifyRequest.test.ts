import { describe, expect, it } from "vitest";

import { isBackgroundRequest } from "../services/perf/classifyRequest";

const API = "http://api.test/api/v2";

describe("isBackgroundRequest", () => {
    it("is true for every GitHub route", () => {
        for (const path of [
            "/github/pulls/acme/rocket/7/",
            "/github/pulls/for-task/?task_id=42",
            "/github/pulls/for-tasks/?task_ids=1,2,3",
            "/github/branches/for-task/?task_id=42&fresh=1",
            "/github/repos/",
        ]) {
            expect(isBackgroundRequest(`${API}${path}`, API), path).toBe(true);
        }
    });

    it("is true for the presence heartbeat and runtime config, with or without a trailing slash", () => {
        for (const path of [
            "/user/presence/heartbeat/",
            "/user/presence/heartbeat",
            "/runtime-config/",
            "/runtime-config",
            "/runtime-config/?v=2",
        ]) {
            expect(isBackgroundRequest(`${API}${path}`, API), path).toBe(true);
        }
    });

    it("is false for what a click waits for", () => {
        for (const path of [
            "/task/getTask/?id=5",
            "/task/activity/?task_id=5",
            "/project/projects/",
            "/milestone/list/?project_id=1",
            "/note/team/meta/",
            "/search/teamTasks/",
            "/v3/channels/",
            "/user/presence/",
            "/user/getMyProfile/",
        ]) {
            expect(isBackgroundRequest(`${API}${path}`, API), path).toBe(false);
        }
    });

    it("does not match lookalikes", () => {
        for (const path of [
            "/githubx/pulls/",
            "/github", // no trailing segment: not under /github/
            "/integrations/github/pulls/",
            "/user/presence/heartbeat/extra/",
            "/runtime-config-old/",
            "/x/runtime-config/",
        ]) {
            expect(isBackgroundRequest(`${API}${path}`, API), path).toBe(false);
        }
    });

    it("reads the path only: a route inside a query string or fragment is not one", () => {
        expect(isBackgroundRequest(`${API}/task/getTask/?next=/github/pulls/`, API)).toBe(false);
        expect(isBackgroundRequest(`${API}/task/getTask/#/github/pulls/`, API)).toBe(false);
        expect(isBackgroundRequest(`${API}/github/pulls/?x=1#y`, API)).toBe(true);
    });

    it("is false outside the API base", () => {
        expect(isBackgroundRequest("http://other.test/api/v2/github/pulls/", API)).toBe(false);
        expect(isBackgroundRequest("http://api.test/github/pulls/", API)).toBe(false);
        // The base must end where a path starts, not in the middle of a word.
        expect(isBackgroundRequest("http://api.test/api/v2x/github/pulls/", API)).toBe(false);
    });

    it("accepts an API base written with a trailing slash, and refuses an empty one", () => {
        expect(isBackgroundRequest(`${API}/github/pulls/`, `${API}/`)).toBe(true);
        expect(isBackgroundRequest(`${API}/github/pulls/`, "")).toBe(false);
    });
});
