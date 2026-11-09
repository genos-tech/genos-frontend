/**
 * Deleting a team emoji is an Undo toast, not a click that deletes (MIP-1300): the emoji
 * leaves the settings list at once, the soft DELETE (uploader only) is sent when the Undo
 * window ends, Undo sends nothing, and a refused DELETE puts it back.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetToasts } from "../components/ui/feedback/toastStore";
import { useTeamEmoji } from "../hooks/common/useTeamEmoji";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { deleteTeamEmoji, listTeamEmoji, TeamEmoji } from "../services/teamEmojiApi";
import { getTeamEmojiSnapshot } from "../services/teamEmojiStore";
import { UserProps } from "../types/admin";

vi.mock("../services/teamEmojiApi", () => ({
    listTeamEmoji: vi.fn(),
    createTeamEmoji: vi.fn(),
    deleteTeamEmoji: vi.fn(),
    deleteTeamEmojiOnExit: vi.fn(),
}));

const listMock = listTeamEmoji as unknown as ReturnType<typeof vi.fn>;
const deleteMock = deleteTeamEmoji as unknown as ReturnType<typeof vi.fn>;

const me = { userId: "u1", teamId: "t1" } as UserProps;
const mk = (emojiId: number, name: string): TeamEmoji => ({
    emojiId,
    name,
    url: `https://x/${name}.png`,
    createdBy: "u1",
    tsCreatedAt: null,
});
const LABELS = { message: "deleted", errorMessage: "failed" };
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const windowEnds = () => act(async () => flushUndoables("navigate"));

const boot = async () => {
    listMock.mockResolvedValue([mk(1, "party"), mk(2, "blob")]);
    const hook = renderHook(() => useTeamEmoji(me, "token"));
    await flush();
    return hook;
};
const names = (r: { current: { teamEmoji: TeamEmoji[] } }) =>
    r.current.teamEmoji.map((e) => e.name);

afterEach(() => {
    __resetUndoables();
    __resetToasts();
    vi.clearAllMocks();
});

describe("useTeamEmoji.remove", () => {
    it("hides at once and sends nothing while the toast is up", async () => {
        const { result } = await boot();
        act(() => result.current.remove(1, LABELS));
        expect(names(result)).toEqual(["blob"]);
        expect(deleteMock).not.toHaveBeenCalled();
        // The catalog the pickers and chips read keeps it: the server still has it.
        expect(getTeamEmojiSnapshot().map((e) => e.name)).toEqual(["party", "blob"]);
    });

    it("sends the DELETE when the window ends and refreshes the catalog", async () => {
        deleteMock.mockResolvedValue(true);
        const { result } = await boot();
        act(() => result.current.remove(1, LABELS));
        listMock.mockResolvedValue([mk(2, "blob")]);
        await windowEnds();
        expect(deleteMock).toHaveBeenCalledTimes(1);
        expect(deleteMock.mock.calls[0][1]).toBe(1);
        await flush();
        expect(names(result)).toEqual(["blob"]);
        expect(getTeamEmojiSnapshot().map((e) => e.name)).toEqual(["blob"]);
    });

    it("a refused DELETE (not the uploader) shows the emoji again", async () => {
        deleteMock.mockResolvedValue(false);
        const { result } = await boot();
        act(() => result.current.remove(1, LABELS));
        await windowEnds();
        expect(names(result)).toEqual(["party", "blob"]);
    });
});
