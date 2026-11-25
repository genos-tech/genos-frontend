// Where a dashboard page can be saved (MIP-2357): "My notes", each of the member's own folders, and
// each team folder they may add notes to. The pure half of the "Save to" picker: no React, so the
// rules that matter (which folders are offered, in what order, and who can then read the page) are
// testable on their own.
//
// The choice sets TWO parameters of the dashboard job at once: `save_to` (me, personal_folder or
// team_folder) and `folder_id`. The API wants `folder_id` exactly when `save_to` is a folder.

import { compareText } from "../../i18n/collate";
import type { MyNoteFolderProps, TeamNoteFolderProps } from "../../types/notes";

export type SaveTo = "me" | "personal_folder" | "team_folder";

/** A role at or above Editor may add notes to a team folder (1 owner, 2 editor, 3 viewer). */
const ROLE_EDITOR = 2;

/** Who can open the page once it is there: the member alone, the whole team (a public team folder),
 *  or the people the folder is open to (a private team folder). */
export type FolderReaders = "onlyYou" | "teamPublic" | "teamPrivate";

export type FolderChoice = {
    /** "p<id>" for a personal folder, "t<id>" for a team folder. */
    id: string;
    saveTo: Exclude<SaveTo, "me">;
    folderId: string;
    group: "mine" | "team";
    /** The folder's own name. */
    name: string;
    /** The whole path ("Projects / 2026"): what the closed field shows. */
    path: string;
    /** How far down the tree: the dropdown indents by it. */
    depth: number;
    readers: FolderReaders;
};

type Compare = (a: string, b: string) => number;

type Folder = { folderId: number; parentFolderId: number | null; name: string };

/** The folders in tree order (a folder, then its children, each level sorted by name), with the
 *  depth and the path of each. A folder whose parent is not in the list (another team's share
 *  re-rooted, or a parent the member cannot see) is a root. A parent cycle is cut, not looped. */
const inTreeOrder = <T extends Folder>(
    all: T[],
    keep: (folder: T) => boolean,
    compare: Compare
): Array<{ folder: T; depth: number; path: string }> => {
    const byId = new Map(all.map((f) => [f.folderId, f]));
    const children = new Map<number | null, T[]>();
    for (const f of all) {
        const parent =
            f.parentFolderId !== null && byId.has(f.parentFolderId) ? f.parentFolderId : null;
        children.set(parent, [...(children.get(parent) ?? []), f]);
    }
    for (const list of children.values()) list.sort((a, b) => compare(a.name, b.name));

    const out: Array<{ folder: T; depth: number; path: string }> = [];
    const seen = new Set<number>();
    const walk = (parent: number | null, depth: number, trail: string) => {
        for (const f of children.get(parent) ?? []) {
            if (seen.has(f.folderId)) continue;
            seen.add(f.folderId);
            const path = trail ? `${trail} / ${f.name}` : f.name;
            if (keep(f)) out.push({ folder: f, depth, path });
            walk(f.folderId, depth + 1, path);
        }
    };
    walk(null, 0, "");
    return out;
};

/** The offered folders: the member's own, then the team folders they may add notes to. A folder
 *  another team shared is not offered (the page lives in this team). The depth and path of a team
 *  folder count the ancestors the member can only read, so a nested folder still says where it is. */
export const buildFolderChoices = (
    mine: MyNoteFolderProps[],
    team: TeamNoteFolderProps[],
    compare: Compare = (a, b) => compareText(a, b)
): FolderChoice[] => {
    const own = inTreeOrder(mine, () => true, compare).map(
        ({ folder, depth, path }): FolderChoice => ({
            id: `p${folder.folderId}`,
            saveTo: "personal_folder",
            folderId: String(folder.folderId),
            group: "mine",
            name: folder.name,
            path,
            depth,
            readers: "onlyYou",
        })
    );
    const shared = inTreeOrder(
        team.filter((f) => !f.isExternal),
        (f) => f.myRoleId <= ROLE_EDITOR,
        compare
    ).map(
        ({ folder, depth, path }): FolderChoice => ({
            id: `t${folder.folderId}`,
            saveTo: "team_folder",
            folderId: String(folder.folderId),
            group: "team",
            name: folder.name,
            path,
            depth,
            readers: folder.effectiveVisibility === "public" ? "teamPublic" : "teamPrivate",
        })
    );
    return [...own, ...shared];
};

/** The choice the stored parameters name, or null when none matches (a deleted folder, a folder the
 *  member lost, a read-only one): the picker then shows it as unavailable and keeps it. */
export const findChoice = (
    choices: FolderChoice[],
    saveTo: string,
    folderId: string
): FolderChoice | null =>
    choices.find((c) => c.saveTo === saveTo && c.folderId === folderId.trim()) ?? null;

/** True when the stored parameters mean "My notes": no folder, or `save_to` of `me` / not set. */
export const isMyNotes = (saveTo: string, folderId: string): boolean =>
    folderId.trim() === "" && (saveTo === "" || saveTo === "me");
