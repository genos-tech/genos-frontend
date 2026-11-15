/**
 * A milestone save that names a collaborator who could not open it (MIP-1567).
 *
 * `createMilestone` / `updateMilestone` swallow failures and answer `undefined`.
 * For this one refusal they now also show the reason (by name) and tell the
 * caller which person was refused, so the form can drop them and go on.
 * Every other failure keeps its old behaviour.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMilestone } from "../features/tasks/sprint-milestone/services/createMilestone";
import { updateMilestone } from "../features/tasks/sprint-milestone/services/updateMilestone";
import {
    allowedCollaboratorIds,
    collaboratorHolderIds,
    collaboratorOptions,
} from "../features/tasks/utils/collaboratorCandidates";
import {
    collaboratorRefusalText,
    refusedCollaboratorId,
} from "../features/tasks/utils/collaboratorRefusal";
import { fmt, getMessages } from "../i18n";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import type { UserProps } from "../types/admin";

const adapter = vi.fn();
let originalAdapter: typeof axios.defaults.adapter;
let bus: Array<[string, string | undefined]> = [];
let unsubscribe: () => void = () => {};

const answer = (status: number, data: unknown) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
            data,
            status,
            statusText: "",
            headers: {},
            config,
        });
    });

const refusal = (id: string) => ({
    error: `\`collaborators\`: '${id}' is not a member of this project, so they could not open the task. Add them to the project first.`,
});
const bob = { userId: "u-bob", userName: "Bob" };

let now = 0;
beforeEach(() => {
    // The toast bus drops a repeat of a kind inside a time window; each test
    // starts a minute after the last.
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});
afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const named = () => fmt(getMessages().tasks.errors.collaboratorNotOnProject, { name: "Bob" });

describe("the milestone services on a refused collaborator", () => {
    it("create: shows the reason by name and says who was refused", async () => {
        answer(400, refusal("u-bob"));
        const onCollaboratorRefused = vi.fn();
        const res = await createMilestone(
            { projectId: 1, title: "M", collaborators: ["u-bob"] },
            "tok",
            { people: [bob], onCollaboratorRefused }
        );
        expect(res).toBeUndefined();
        expect(bus[bus.length - 1]).toEqual(["serverMessage", named()]);
        expect(onCollaboratorRefused).toHaveBeenCalledWith("u-bob");
    });

    it("update: shows the reason by name and says who was refused", async () => {
        answer(400, refusal("u-bob"));
        const onCollaboratorRefused = vi.fn();
        const res = await updateMilestone(
            { milestoneId: 5, collaborators: ["u-bob"] },
            "tok",
            undefined,
            { people: [bob], onCollaboratorRefused }
        );
        expect(res).toBeUndefined();
        expect(bus[bus.length - 1]).toEqual(["serverMessage", named()]);
        expect(onCollaboratorRefused).toHaveBeenCalledWith("u-bob");
    });

    it("a person it cannot name gets the server's own sentence", async () => {
        answer(400, refusal("u-other"));
        await updateMilestone({ milestoneId: 5, collaborators: ["u-other"] }, "tok", undefined, {
            people: [bob],
        });
        expect(bus[bus.length - 1]).toEqual(["serverMessage", refusal("u-other").error]);
    });

    it("any other 400 is left as it was: no reason, no callback", async () => {
        answer(400, { error: "assignee_ids: 'u-x' is not a member of this project or its team." });
        const onCollaboratorRefused = vi.fn();
        const res = await updateMilestone(
            { milestoneId: 5, assigneeIds: ["u-x"] },
            "tok",
            undefined,
            { people: [bob], onCollaboratorRefused }
        );
        expect(res).toBeUndefined();
        expect(bus.filter(([kind]) => kind === "serverMessage")).toHaveLength(0);
        expect(onCollaboratorRefused).not.toHaveBeenCalled();
    });

    it("a successful save is untouched", async () => {
        answer(200, { milestone: { milestoneId: 5 } });
        const res = await updateMilestone({ milestoneId: 5, title: "x" }, "tok");
        expect(res).toEqual({ milestone: { milestoneId: 5 } });
        expect(bus).toHaveLength(0);
    });
});

describe("reading the server's sentence", () => {
    it("finds the id, case-insensitively matched to a person, and ignores other sentences", () => {
        expect(refusedCollaboratorId(refusal("ABC-1").error)).toBe("ABC-1");
        expect(refusedCollaboratorId("something else")).toBeNull();
        expect(refusedCollaboratorId(null)).toBeNull();
        expect(
            collaboratorRefusalText(refusal("U-BOB").error, [{ userId: "u-bob", userName: "Bob" }])
        ).toBe(named());
        expect(collaboratorRefusalText("something else", [bob])).toBeNull();
    });
});

describe("the rule the picker applies", () => {
    const u = (userId: string) => ({ userId, userName: userId }) as UserProps;

    it("a task counts its assignee and reporter, a milestone counts none", () => {
        expect(collaboratorHolderIds({ assigneeId: "a", reporterId: "r" })).toEqual(["a", "r"]);
        expect(collaboratorHolderIds({ assigneeId: null, reporterId: "r" })).toEqual(["r"]);
        expect(
            collaboratorHolderIds({ isMilestone: true, assigneeId: "a", reporterId: "r" })
        ).toEqual([]);
    });

    it("an unknown roster admits only the owner and the holders", () => {
        const allowed = allowedCollaboratorIds({
            memberIds: null,
            ownerUserId: "o",
            holderIds: ["a", undefined, null],
        });
        expect([...allowed].sort()).toEqual(["a", "o"]);
    });

    it("options are the allowed team members plus whoever is already chosen, once", () => {
        const options = collaboratorOptions({
            teamMembers: [u("a"), u("b"), u("c")],
            allowed: new Set(["a"]),
            selected: [u("c"), u("a"), u("guest")],
        });
        expect(options.map((o) => o.userId)).toEqual(["a", "c", "guest"]);
    });
});
