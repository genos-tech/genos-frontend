/**
 * Opening a task or a note lands the activity the server marked read (MIP-1421).
 *
 * `POST /task/recent/open/` and `POST /note/recent/` now answer with `readActivityIds`, the
 * caller's unread activity on that task or note that the open marked read. The client must
 * flip exactly those in its activity store (`handleV3ActivitiesRead`, the read-cursor path),
 * and must ignore an answer without them (an older server) or with junk in them.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { landReadActivityIds } from "../features/chat/services/landReadActivityIds";
import { recordNoteOpen } from "../features/notes/recent-notes/services/recordNoteOpen";
import { recordTaskOpen } from "../features/tasks/services/recentTasks";
import { UserProps } from "../types/admin";

const post = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ post }) }));

const handleV3ActivitiesRead = vi.fn();
vi.mock("../features/chat/services/handleV3ActivitiesRead", () => ({
    handleV3ActivitiesRead: (ids: string[]) => handleV3ActivitiesRead(ids),
}));

const myself = { teamId: "team-1", userId: "user-1" } as unknown as UserProps;

beforeEach(() => {
    post.mockReset();
    handleV3ActivitiesRead.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("opening a task", () => {
    it("lands the ids the server marked read", async () => {
        post.mockResolvedValue({ data: { taskId: 7, readActivityIds: ["a1", "a2"] } });
        await expect(recordTaskOpen(7, "token")).resolves.toBe(true);
        expect(handleV3ActivitiesRead).toHaveBeenCalledWith(["a1", "a2"]);
    });

    it("does nothing when the server sends no ids (an older server)", async () => {
        post.mockResolvedValue({ data: { taskId: 7 } });
        await expect(recordTaskOpen(7, "token")).resolves.toBe(true);
        expect(handleV3ActivitiesRead).not.toHaveBeenCalled();
    });

    it("lands nothing when the open failed", async () => {
        post.mockRejectedValue(
            Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } })
        );
        await expect(recordTaskOpen(7, "token")).resolves.toBe(false);
        expect(handleV3ActivitiesRead).not.toHaveBeenCalled();
    });
});

describe("opening a note", () => {
    it("lands the ids the server marked read and still returns the answer", async () => {
        const data = { noteId: 3, noteType: 1, tsOpenedAt: "t", readActivityIds: ["n1"] };
        post.mockResolvedValue({ data });
        await expect(recordNoteOpen(myself, 3, 1, "token")).resolves.toEqual(data);
        expect(handleV3ActivitiesRead).toHaveBeenCalledWith(["n1"]);
    });
});

describe("landReadActivityIds", () => {
    it("ignores anything that is not a list of ids", () => {
        landReadActivityIds(undefined);
        landReadActivityIds(null);
        landReadActivityIds({ readActivityIds: "a1" });
        landReadActivityIds({ readActivityIds: [] });
        landReadActivityIds({ readActivityIds: [1, null, ""] });
        expect(handleV3ActivitiesRead).not.toHaveBeenCalled();
    });

    it("keeps only the string ids", () => {
        landReadActivityIds({ readActivityIds: ["a1", 2, "", "a3"] });
        expect(handleV3ActivitiesRead).toHaveBeenCalledWith(["a1", "a3"]);
    });
});
