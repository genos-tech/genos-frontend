/**
 * Deleting a mention group is an Undo toast, not a confirm dialog (MIP-1300): the group
 * leaves the list at once, the soft DELETE is sent when the Undo window ends, Undo sends
 * nothing, and a refused DELETE puts the group back.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetToasts } from "../components/ui/feedback/toastStore";
import { useMentionGroups } from "../hooks/common/useMentionGroups";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { deleteMentionGroup, listMentionGroups, MentionGroup } from "../services/mentionGroupsApi";
import { UserProps } from "../types/admin";

vi.mock("../services/mentionGroupsApi", () => ({
    listMentionGroups: vi.fn(),
    createMentionGroup: vi.fn(),
    updateMentionGroup: vi.fn(),
    deleteMentionGroup: vi.fn(),
    deleteMentionGroupOnExit: vi.fn(),
    addMentionGroupMembers: vi.fn(),
    removeMentionGroupMember: vi.fn(),
}));

const listMock = listMentionGroups as unknown as ReturnType<typeof vi.fn>;
const deleteMock = deleteMentionGroup as unknown as ReturnType<typeof vi.fn>;

const me = { userId: "u1", teamId: "t1" } as UserProps;
const mk = (groupId: number, groupName: string) =>
    ({ groupId, groupName, memberUserIds: [], memberCount: 0 }) as unknown as MentionGroup;
const LABELS = { message: "deleted", errorMessage: "failed" };
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const windowEnds = () => act(async () => flushUndoables("navigate"));

const boot = async () => {
    listMock.mockResolvedValue([mk(1, "designers"), mk(2, "eng")]);
    const hook = renderHook(() => useMentionGroups(me, "token"));
    await flush();
    return hook;
};
const names = (r: { current: { mentionGroups: MentionGroup[] } }) =>
    r.current.mentionGroups.map((g) => g.groupName);

afterEach(() => {
    __resetUndoables();
    __resetToasts();
    vi.clearAllMocks();
});

describe("useMentionGroups.deleteGroup", () => {
    it("hides at once and sends nothing while the toast is up", async () => {
        const { result } = await boot();
        act(() => result.current.deleteGroup(1, LABELS));
        expect(names(result)).toEqual(["eng"]);
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it("sends one DELETE when the window ends and the group stays gone", async () => {
        deleteMock.mockResolvedValue(true);
        const { result } = await boot();
        act(() => result.current.deleteGroup(1, LABELS));
        listMock.mockResolvedValue([mk(2, "eng")]);
        await windowEnds();
        await flush();
        expect(deleteMock).toHaveBeenCalledTimes(1);
        expect(deleteMock.mock.calls[0][1]).toBe(1);
        expect(names(result)).toEqual(["eng"]);
        // The committed delete re-reads the list (boot + one refresh).
        expect(listMock).toHaveBeenCalledTimes(2);
    });

    it("a refused DELETE shows the group again", async () => {
        deleteMock.mockResolvedValue(false);
        const { result } = await boot();
        act(() => result.current.deleteGroup(1, LABELS));
        await windowEnds();
        expect(names(result)).toEqual(["designers", "eng"]);
    });
});
