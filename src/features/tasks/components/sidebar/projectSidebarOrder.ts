// Pure filter + sort for the sidebar "Projects" list.
//
// "Project label" here means `projectLabels` — the team-catalog labels
// applied to the PROJECT itself — NOT the per-task `projectTags`.
//
// Ordering rule (always on): label (asc) then project name (asc). A
// project can carry several labels, so the label key is its
// alphabetically-first label; unlabelled projects sort LAST behind a
// high sentinel so the labelled projects group at the top.

import { ProjectLabelProps, ProjectProps } from "../../../../types/tasks";

// Sentinel that sorts after any real label name (U+FFFF is the last
// BMP code point), so unlabelled projects fall to the bottom.
const UNLABELLED_SORT_KEY = "￿";

export const projectLabelSortKey = (project: ProjectProps): string => {
    const names = (project.projectLabels ?? []).map((l) => l.name.toLowerCase()).sort();
    return names[0] ?? UNLABELLED_SORT_KEY;
};

// Distinct labels across the given projects, name-sorted — the filter
// menu's option list.
export const distinctProjectLabels = (projects: ProjectProps[]): ProjectLabelProps[] => {
    const byId = new Map<number, ProjectLabelProps>();
    for (const p of projects) {
        for (const l of p.projectLabels ?? []) {
            if (!byId.has(l.labelId)) byId.set(l.labelId, l);
        }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
};

// Filter by label (OR across the selected ids; empty = no filter) then
// sort by label(asc), name(asc). Returns a new array; never mutates.
export const filterAndSortProjects = (
    projects: ProjectProps[],
    activeLabelIds: number[]
): ProjectProps[] => {
    const filtered =
        activeLabelIds.length === 0
            ? projects
            : projects.filter((p) =>
                  (p.projectLabels ?? []).some((l) => activeLabelIds.includes(l.labelId))
              );
    return [...filtered].sort((a, b) => {
        const byLabel = projectLabelSortKey(a).localeCompare(projectLabelSortKey(b));
        if (byLabel !== 0) return byLabel;
        return (a.projectName ?? "").localeCompare(b.projectName ?? "");
    });
};
