/**
 * Guards the "add teammates to a project / GM, then notify them" flow.
 *
 * The two things worth pinning:
 *   1. Each entity uses the primitive that OWNS its membership. Sending a
 *      project through the v3 channel endpoint 400s ("PM channel
 *      membership is managed via the project"), so the split is load-
 *      bearing, not stylistic.
 *   2. The notice reflects what actually landed — nobody gets told they
 *      were added when their write failed, and a partial failure still
 *      notifies the people who did get in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    addMembersToGMWithNotice,
    addMembersToProjectWithNotice,
} from "../services/addMembersWithNotice";
import { channelService } from "../services/channel/channelService";

const MYSELF = { userId: "actor", teamId: "t1", userName: "Me" } as any;

const makeSocket = () => ({ emit: vi.fn() }) as any;

const projectArgs = (over = {}) => ({
    accessToken: "token",
    memberIds: ["u1", "u2"],
    myself: MYSELF,
    projectId: 7,
    projectName: "Proj",
    socket: makeSocket(),
    ...over,
});

describe("addMembersToProjectWithNotice", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("POSTs one project/join per member and notifies them all", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);
        const socket = makeSocket();

        const res = await addMembersToProjectWithNotice(projectArgs({ socket }));

        expect(res).toEqual({ addedIds: ["u1", "u2"], failedIds: [] });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
        expect(bodies.map((b) => b.attendee_id)).toEqual(["u1", "u2"]);
        expect(bodies[0]).toMatchObject({ project_id: 7, team_id: "t1" });
        // A project must NOT go through the v3 channel members endpoint.
        for (const [url] of fetchMock.mock.calls) {
            expect(String(url)).toContain("/project/join/");
        }

        expect(socket.emit).toHaveBeenCalledWith("members_added_notice", {
            receiver_ids: ["u1", "u2"],
            target_kind: "project",
            target_name: "Proj",
        });
    });

    it("notifies only the members whose add actually succeeded", async () => {
        // Partial failure: u1 lands, u2 500s. Telling u2 "you were added"
        // would be a lie; withholding u1's notice would be a silent add.
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, status: 200 })
            .mockResolvedValueOnce({ ok: false, status: 500 });
        vi.stubGlobal("fetch", fetchMock);
        const socket = makeSocket();

        const res = await addMembersToProjectWithNotice(projectArgs({ socket }));

        expect(res).toEqual({ addedIds: ["u1"], failedIds: ["u2"] });
        expect(socket.emit).toHaveBeenCalledWith(
            "members_added_notice",
            expect.objectContaining({ receiver_ids: ["u1"] })
        );
    });

    it("does not emit a notice when every add failed", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        const socket = makeSocket();

        const res = await addMembersToProjectWithNotice(projectArgs({ socket }));

        expect(res.addedIds).toEqual([]);
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("keeps going when one member's request throws", async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);

        const res = await addMembersToProjectWithNotice(projectArgs());

        expect(res).toEqual({ addedIds: ["u2"], failedIds: ["u1"] });
    });

    it("still reports the add as done when the socket is missing", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        const res = await addMembersToProjectWithNotice(projectArgs({ socket: null }));
        expect(res.addedIds).toEqual(["u1", "u2"]);
    });
});

describe("addMembersToGMWithNotice", () => {
    let addMembersSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        addMembersSpy = vi.spyOn(channelService, "addMembers");
    });
    afterEach(() => vi.restoreAllMocks());

    it("adds through the v3 channel primitive and notifies", async () => {
        addMembersSpy.mockResolvedValue({ members: [] } as any);
        const socket = makeSocket();

        const res = await addMembersToGMWithNotice({
            channelId: "gm-uuid",
            gmName: "Squad",
            memberIds: ["u1", "u2"],
            socket,
        });

        expect(res).toEqual({ addedIds: ["u1", "u2"], failedIds: [] });
        expect(addMembersSpy).toHaveBeenCalledWith("gm-uuid", ["u1", "u2"]);
        expect(socket.emit).toHaveBeenCalledWith("members_added_notice", {
            receiver_ids: ["u1", "u2"],
            target_kind: "gm",
            target_name: "Squad",
        });
    });

    it("reports failure and sends no notice when the add throws", async () => {
        addMembersSpy.mockRejectedValue(new Error("nope"));
        const socket = makeSocket();

        const res = await addMembersToGMWithNotice({
            channelId: "gm-uuid",
            gmName: "Squad",
            memberIds: ["u1"],
            socket,
        });

        expect(res).toEqual({ addedIds: [], failedIds: ["u1"] });
        expect(socket.emit).not.toHaveBeenCalled();
    });
});
