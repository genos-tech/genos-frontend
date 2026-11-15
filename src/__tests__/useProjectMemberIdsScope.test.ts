/**
 * The project roster the collaborator picker remembers belongs to who asked (MIP-1586).
 *
 * `useProjectMemberIds` keeps the last roster per project so a picker can show people at once on its
 * second open. That memory was module-wide and keyed by project only, so when the signed-in user, the
 * team or the token changed (a logout and another login in the same tab, a team switch) the next
 * picker was handed the PREVIOUS viewer's roster until its own request landed, and kept it if that
 * request failed. The roster is answered per viewer by the server (`/project/members/` is ACL'd), so
 * another viewer's answer must never be shown as theirs.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    resetProjectMemberIdsCache,
    useProjectMemberIds,
} from "../hooks/tasks/useProjectMemberIds";

const get = vi.fn();
vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { get: (url: string) => get(token, url) } : null),
}));

const roster = (...ids: string[]) => ({
    data: { project_members: ids.map((id) => ({ attendee__id: id })) },
});

type Viewer = { userId: string; teamId: string };
const ken: Viewer = { userId: "u-ken", teamId: "t1" };

type Props = { token: string | null; viewer: Viewer; projectId?: number };
const mount = (initial: Props) =>
    renderHook(
        ({ token, viewer, projectId = 7 }: Props) => useProjectMemberIds(projectId, token, viewer),
        { initialProps: initial }
    );

/** Ask once and wait for the answer to be the hook's. */
const learn = async (hook: ReturnType<typeof mount>, expected: string[]) => {
    act(() => hook.result.current.refresh());
    await waitFor(() => expect(hook.result.current.ids).toEqual(expected));
};

beforeEach(() => {
    get.mockReset();
    resetProjectMemberIdsCache();
});

describe("the remembered project roster", () => {
    it("is still shown at once to the same viewer after a token rotation", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const hook = mount({ token: "tok1", viewer: ken });
        await learn(hook, ["u-ann"]);

        // A rotated token of the same person: same answer rights, so no reason to forget.
        hook.rerender({ token: "tok2", viewer: ken });
        expect(hook.result.current.ids).toEqual(["u-ann"]);

        // A second picker of the same viewer reads it from the memory before its own request lands.
        const second = mount({ token: "tok2", viewer: ken });
        expect(second.result.current.ids).toEqual(["u-ann"]);
    });

    it("is not shown to another user in the same tab", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const hook = mount({ token: "tok1", viewer: ken });
        await learn(hook, ["u-ann"]);

        // Another person signs in: the project is the same, the answer is theirs to get.
        hook.rerender({ token: "tok-other", viewer: { userId: "u-mia", teamId: "t1" } });
        expect(hook.result.current.ids).toBeNull();
        const other = mount({ token: "tok-other", viewer: { userId: "u-mia", teamId: "t1" } });
        expect(other.result.current.ids).toBeNull();
    });

    it("is not shown after the team changes", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const hook = mount({ token: "tok1", viewer: ken });
        await learn(hook, ["u-ann"]);

        hook.rerender({ token: "tok1", viewer: { userId: "u-ken", teamId: "t2" } });
        expect(hook.result.current.ids).toBeNull();
        expect(
            mount({ token: "tok1", viewer: { userId: "u-ken", teamId: "t2" } }).result.current.ids
        ).toBeNull();
    });

    it("is not shown once there is no token (signed out)", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const hook = mount({ token: "tok1", viewer: ken });
        await learn(hook, ["u-ann"]);

        hook.rerender({ token: null, viewer: ken });
        expect(hook.result.current.ids).toBeNull();
        expect(mount({ token: null, viewer: ken }).result.current.ids).toBeNull();
    });

    it("is not kept as the new viewer's answer when their own request fails", async () => {
        get.mockResolvedValueOnce(roster("u-ann"));
        const hook = mount({ token: "tok1", viewer: ken });
        await learn(hook, ["u-ann"]);

        const mia = { userId: "u-mia", teamId: "t1" };
        get.mockRejectedValueOnce(new Error("403"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        hook.rerender({ token: "tok-other", viewer: mia });
        act(() => hook.result.current.refresh());
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        await act(async () => {});
        // Unknown (the picker fails closed on it), never the previous viewer's people.
        expect(hook.result.current.ids).toBeNull();
    });

    it("does not hand a request in flight for one viewer to another", async () => {
        let release: (v: unknown) => void = () => {};
        get.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
        const first = mount({ token: "tok1", viewer: ken });
        act(() => first.result.current.refresh());
        await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

        // Another viewer asks for the same project while Ken's request is still out.
        get.mockResolvedValueOnce(roster("u-zed"));
        const mia = { userId: "u-mia", teamId: "t1" };
        const second = mount({ token: "tok-other", viewer: mia });
        act(() => second.result.current.refresh());
        await waitFor(() => expect(second.result.current.ids).toEqual(["u-zed"]));
        expect(get).toHaveBeenCalledTimes(2);
        expect(get).toHaveBeenLastCalledWith("tok-other", "/project/members/?project_id=7");

        await act(async () => release(roster("u-ann")));
        await waitFor(() => expect(first.result.current.ids).toEqual(["u-ann"]));
        expect(second.result.current.ids).toEqual(["u-zed"]);
    });
});
