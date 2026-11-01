import { Milestone, MilestoneFolder } from "../types";

export type MilestoneFolderGroup = {
    folder: MilestoneFolder;
    milestones: Milestone[];
};

export type MilestonesByFolder = {
    /** Every folder of the project, in its saved order, EMPTY ONES INCLUDED so
     *  a fresh folder is visible and can receive a milestone. */
    folders: MilestoneFolderGroup[];
    /** Milestones with no folder (or whose folder is unknown to this list). */
    unfiled: Milestone[];
};

/**
 * Plain grouping of the sidebar's milestones by folder (MIP-847). The input is
 * the already-filtered visible list (`selectVisibleMilestones`), so a Closed
 * milestone whose sprint ended never reaches here: it lives only under "Past
 * milestones" and keeps its `folderId` for if it comes back. Within a group
 * the input order is preserved (the visible list is already sorted).
 *
 * A milestone whose `folderId` names no known folder (the folder list has not
 * loaded yet, or it was deleted elsewhere) stays in `unfiled` rather than
 * vanishing from the sidebar.
 */
export const groupMilestonesByFolder = (
    milestones: Milestone[],
    folders: MilestoneFolder[]
): MilestonesByFolder => {
    const ordered = [...folders].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.folderId - b.folderId
    );
    const groups = new Map<number, MilestoneFolderGroup>(
        ordered.map((folder) => [folder.folderId, { folder, milestones: [] }])
    );
    const unfiled: Milestone[] = [];
    for (const m of milestones) {
        const group = m.folderId != null ? groups.get(m.folderId) : undefined;
        if (group) group.milestones.push(m);
        else unfiled.push(m);
    }
    return { folders: ordered.map((f) => groups.get(f.folderId)!), unfiled };
};
