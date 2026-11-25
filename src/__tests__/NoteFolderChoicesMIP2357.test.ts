/**
 * MIP-2357: which folders the dashboard "Save to" picker offers, in what order, and who then reads
 * the page. Pure: the picker only draws this.
 */
import { describe, expect, it } from "vitest";

import {
    buildFolderChoices,
    findChoice,
    isMyNotes,
} from "../features/schedules/noteFolderChoices";
import type { MyNoteFolderProps, TeamNoteFolderProps } from "../types/notes";

const mine = (folderId: number, name: string, parentFolderId: number | null = null) =>
    ({ folderId, name, parentFolderId }) as MyNoteFolderProps;

const team = (
    folderId: number,
    name: string,
    over: Partial<TeamNoteFolderProps> = {}
): TeamNoteFolderProps =>
    ({
        folderId,
        name,
        parentFolderId: null,
        visibility: "public",
        effectiveVisibility: "public",
        myRoleId: 2,
        ownerId: "u1",
        ownerName: "Ana",
        memberCount: 3,
        tags: [],
        ...over,
    }) as TeamNoteFolderProps;

describe("the personal folders", () => {
    it("come in tree order, indented by depth, each with its whole path", () => {
        const choices = buildFolderChoices(
            [mine(3, "2026", 2), mine(1, "Zeta"), mine(2, "Projects"), mine(4, "Archive", 2)],
            []
        );
        expect(choices.map((c) => [c.name, c.depth, c.path])).toEqual([
            ["Projects", 0, "Projects"],
            ["2026", 1, "Projects / 2026"],
            ["Archive", 1, "Projects / Archive"],
            ["Zeta", 0, "Zeta"],
        ]);
        expect(choices.every((c) => c.saveTo === "personal_folder" && c.group === "mine")).toBe(
            true
        );
        expect(choices.every((c) => c.readers === "onlyYou")).toBe(true);
        expect(choices[0]).toMatchObject({ id: "p2", folderId: "2" });
    });

    it("treat a folder whose parent is missing as a root, and survive a parent cycle", () => {
        const choices = buildFolderChoices(
            [mine(5, "Orphan", 99), mine(6, "A", 7), mine(7, "B", 6)],
            []
        );
        expect(choices.map((c) => c.name)).toEqual(["Orphan"]);
    });
});

describe("the team folders", () => {
    it("offer only those the member may add notes to, and none another team shared", () => {
        const choices = buildFolderChoices(
            [],
            [
                team(10, "Design"),
                team(11, "Owner's own", { myRoleId: 1 }),
                team(12, "Read only", { myRoleId: 3 }),
                team(13, "From a partner", { isExternal: true }),
            ]
        );
        expect(choices.map((c) => c.name)).toEqual(["Design", "Owner's own"]);
        expect(choices[0]).toMatchObject({
            id: "t10",
            saveTo: "team_folder",
            folderId: "10",
            group: "team",
        });
    });

    it("say who can read the page: the whole team, or the people the folder is open to", () => {
        const choices = buildFolderChoices(
            [],
            [
                team(10, "Everyone", { effectiveVisibility: "public" }),
                team(11, "Few", { effectiveVisibility: "private" }),
                team(12, "Inherits, unresolved", { effectiveVisibility: null }),
            ]
        );
        expect(choices.map((c) => c.readers)).toEqual([
            "teamPublic",
            "teamPrivate",
            "teamPrivate",
        ]);
    });

    it("count a read-only parent in the path and the depth of a folder the member can write to", () => {
        const choices = buildFolderChoices(
            [],
            [
                team(10, "Company", { myRoleId: 3 }),
                team(11, "Design", { parentFolderId: 10, myRoleId: 2 }),
            ]
        );
        expect(choices).toHaveLength(1);
        expect(choices[0]).toMatchObject({ name: "Design", depth: 1, path: "Company / Design" });
    });

    it("come after the personal ones", () => {
        const choices = buildFolderChoices([mine(1, "Mine")], [team(10, "Design")]);
        expect(choices.map((c) => c.group)).toEqual(["mine", "team"]);
    });
});

describe("finding what is stored", () => {
    const choices = buildFolderChoices([mine(1, "Mine")], [team(1, "Design")]);

    it("matches on the kind of folder AND its id (a personal and a team folder can share a number)", () => {
        expect(findChoice(choices, "personal_folder", "1")?.name).toBe("Mine");
        expect(findChoice(choices, "team_folder", "1")?.name).toBe("Design");
    });

    it("finds nothing for a folder that is gone or not offered, so the picker can say so", () => {
        expect(findChoice(choices, "team_folder", "99")).toBeNull();
        expect(findChoice(choices, "me", "")).toBeNull();
    });

    it("reads no folder, or save_to of me, or nothing, as My notes", () => {
        expect(isMyNotes("", "")).toBe(true);
        expect(isMyNotes("me", "")).toBe(true);
        expect(isMyNotes("me", " ")).toBe(true);
        expect(isMyNotes("team_folder", "")).toBe(false);
        expect(isMyNotes("personal_folder", "4")).toBe(false);
    });
});
