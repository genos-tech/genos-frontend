import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    createSchedule,
    deleteSchedule,
    listSchedules,
    runScheduleNow,
    updateSchedule,
} from "../services/schedules";

const api = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
};
vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? api : null),
}));

const TEAM = "team-1";
const FIELDS = {
    name: "Plan",
    job: "what_you_did",
    params: { day: "today" },
    frequency: "daily" as const,
    timeOfDay: "09:00",
    deliverPush: false,
};

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
});

const refusal = (status: number, error?: string) => ({
    response: { status, data: error === undefined ? {} : { error } },
});

describe("every call names the member's team", () => {
    it("GET sends team_id in the query, on a path relative to the /api/v2 base", async () => {
        api.get.mockResolvedValue({
            data: { timeZone: "Asia/Tokyo", limit: 20, jobs: [], schedules: [] },
        });
        const list = await listSchedules("tok", TEAM);
        expect(api.get).toHaveBeenCalledWith(
            "/schedules/",
            expect.objectContaining({ params: { team_id: TEAM } })
        );
        expect(list).toEqual({
            // An API that predates the plan gate sends neither key: allowed.
            planAllowed: true,
            planMessage: "",
            timeZone: "Asia/Tokyo",
            limit: 20,
            jobs: [],
            schedules: [],
            suggestions: [],
        });
    });

    it("GET passes the suggestions on, and an older API without them gives none", async () => {
        const suggestion = {
            key: "morning_plan",
            name: "Morning plan",
            job: "what_to_do_today",
            params: {},
            frequency: "daily",
            timeOfDay: "09:00",
        };
        api.get.mockResolvedValue({ data: { suggestions: [suggestion] } });
        expect((await listSchedules("tok", TEAM))?.suggestions).toEqual([suggestion]);
        api.get.mockResolvedValue({ data: {} });
        expect((await listSchedules("tok", TEAM))?.suggestions).toEqual([]);
    });

    it("POST sends team_id in the JSON body, not the query", async () => {
        api.post.mockResolvedValue({ data: { schedule: { id: "s1" } } });
        const res = await createSchedule("tok", TEAM, FIELDS);
        const [url, body, config] = api.post.mock.calls[0];
        expect(url).toBe("/schedules/");
        expect(body).toEqual({ ...FIELDS, team_id: TEAM });
        expect(config.params).toBeUndefined();
        expect(res).toEqual({ ok: true, schedule: { id: "s1" } });
    });

    it("PATCH sends team_id in the query and only the change in the body", async () => {
        api.patch.mockResolvedValue({ data: { schedule: { id: "s1" } } });
        await updateSchedule("tok", TEAM, "s1", { enabled: false });
        const [url, body, config] = api.patch.mock.calls[0];
        expect(url).toBe("/schedules/s1/");
        expect(body).toEqual({ enabled: false });
        expect(config.params).toEqual({ team_id: TEAM });
    });

    it("DELETE sends team_id in the query", async () => {
        api.delete.mockResolvedValue({ status: 204 });
        expect(await deleteSchedule("tok", TEAM, "s1")).toEqual({ ok: true });
        expect(api.delete).toHaveBeenCalledWith(
            "/schedules/s1/",
            expect.objectContaining({ params: { team_id: TEAM } })
        );
    });

    it("run sends team_id in the query", async () => {
        api.post.mockResolvedValue({ data: { status: "ok", error: "", title: "T", items: 3 } });
        const res = await runScheduleNow("tok", TEAM, "s1");
        const [url, , config] = api.post.mock.calls[0];
        expect(url).toBe("/schedules/s1/run/");
        expect(config.params).toEqual({ team_id: TEAM });
        expect(res).toEqual({
            ok: true,
            outcome: { status: "ok", error: "", title: "T", items: 3 },
        });
    });

    it("never calls the API without a team or a session", async () => {
        expect(await listSchedules("tok", "")).toBeNull();
        expect(await createSchedule("tok", "", FIELDS)).toMatchObject({ ok: false });
        expect(await updateSchedule("tok", "", "s1", {})).toMatchObject({ ok: false });
        expect(await deleteSchedule("tok", "", "s1")).toMatchObject({ ok: false });
        expect(await runScheduleNow("tok", "", "s1")).toMatchObject({ ok: false });
        expect(await listSchedules(null, TEAM)).toBeNull();
        for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
    });

    it("keeps the global error toast off: the page shows the sentence inline", async () => {
        api.get.mockResolvedValue({ data: {} });
        api.post.mockResolvedValue({ data: {} });
        api.patch.mockResolvedValue({ data: {} });
        api.delete.mockResolvedValue({});
        await listSchedules("tok", TEAM);
        await createSchedule("tok", TEAM, FIELDS);
        await updateSchedule("tok", TEAM, "s1", {});
        await deleteSchedule("tok", TEAM, "s1");
        await runScheduleNow("tok", TEAM, "s1");
        const configs = [
            api.get.mock.calls[0][1],
            api.post.mock.calls[0][2],
            api.patch.mock.calls[0][2],
            api.delete.mock.calls[0][1],
            api.post.mock.calls[1][2],
        ];
        for (const c of configs) expect(c.suppressErrorToast).toBe(true);
    });
});

describe("failures", () => {
    it("carries the sentence the API wrote for the member, as is", async () => {
        api.post.mockRejectedValue(refusal(400, "Ran a moment ago, try again in 42 seconds."));
        expect(await runScheduleNow("tok", TEAM, "s1")).toEqual({
            ok: false,
            gone: false,
            error: "Ran a moment ago, try again in 42 seconds.",
            planRequired: false,
        });
    });

    it("a 404 means the list is stale", async () => {
        api.patch.mockRejectedValue(refusal(404, "Schedule not found"));
        expect(await updateSchedule("tok", TEAM, "s1", { name: "x" })).toEqual({
            ok: false,
            gone: true,
            error: "Schedule not found",
            planRequired: false,
        });
    });

    it("has no sentence for a network or server failure", async () => {
        api.delete.mockRejectedValue(refusal(500));
        expect(await deleteSchedule("tok", TEAM, "s1")).toEqual({
            ok: false,
            gone: false,
            error: null,
            planRequired: false,
        });
        api.get.mockRejectedValue(new Error("network"));
        expect(await listSchedules("tok", TEAM)).toBeNull();
    });
});

describe("the plan gate (MIP-1213)", () => {
    it("GET carries planAllowed and planMessage; only an explicit false is 'not allowed'", async () => {
        api.get.mockResolvedValueOnce({
            data: { planAllowed: false, planMessage: "Upgrade.", schedules: [], jobs: [] },
        });
        expect(await listSchedules("tok", TEAM)).toMatchObject({
            planAllowed: false,
            planMessage: "Upgrade.",
        });
        api.get.mockResolvedValueOnce({ data: { planAllowed: true, schedules: [], jobs: [] } });
        expect(await listSchedules("tok", TEAM)).toMatchObject({ planAllowed: true });
        // Missing, null, or anything that is not `false` reads as allowed (the API fails open).
        for (const planAllowed of [undefined, null, "no", 0]) {
            api.get.mockResolvedValueOnce({ data: { planAllowed, schedules: [], jobs: [] } });
            expect(await listSchedules("tok", TEAM)).toMatchObject({ planAllowed: true });
        }
    });

    const planRequired = {
        response: { status: 403, data: { error: "Core and up.", code: "plan_required" } },
    };

    it("a 403 plan_required is flagged on every action that can refuse", async () => {
        api.post.mockRejectedValueOnce(planRequired);
        expect(await createSchedule("tok", TEAM, FIELDS)).toMatchObject({
            ok: false,
            planRequired: true,
        });
        api.patch.mockRejectedValueOnce(planRequired);
        expect(await updateSchedule("tok", TEAM, "s1", { enabled: true })).toMatchObject({
            ok: false,
            planRequired: true,
        });
        api.post.mockRejectedValueOnce(planRequired);
        expect(await runScheduleNow("tok", TEAM, "s1")).toMatchObject({
            ok: false,
            planRequired: true,
        });
    });

    it("any other refusal is not a plan refusal", async () => {
        api.post.mockRejectedValueOnce(refusal(400, "Pick a name."));
        expect(await createSchedule("tok", TEAM, FIELDS)).toMatchObject({ planRequired: false });
        // A 403 with some other code (or none) is not the plan.
        api.post.mockRejectedValueOnce({ response: { status: 403, data: { code: "other" } } });
        expect(await createSchedule("tok", TEAM, FIELDS)).toMatchObject({ planRequired: false });
        api.post.mockRejectedValueOnce({
            response: { status: 400, data: { code: "plan_required" } },
        });
        expect(await createSchedule("tok", TEAM, FIELDS)).toMatchObject({ planRequired: false });
        api.post.mockRejectedValueOnce(new Error("offline"));
        expect(await createSchedule("tok", TEAM, FIELDS)).toMatchObject({ planRequired: false });
    });
});
