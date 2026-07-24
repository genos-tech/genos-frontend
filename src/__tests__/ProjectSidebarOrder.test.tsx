// Sidebar "Projects" ordering + label filter (projectSidebarOrder).
//
// Contract:
//   - always sort by label (asc) then project name (asc);
//   - a multi-label project sorts by its alphabetically-first label;
//   - unlabelled projects sort LAST;
//   - the label filter is OR across selected label ids (empty = all);
//   - distinctProjectLabels dedupes by labelId and is name-sorted.

import { describe, expect, it } from "vitest";

import {
    distinctProjectLabels,
    filterAndSortProjects,
    projectLabelSortKey,
} from "../features/tasks/components/sidebar/projectSidebarOrder";
import type { ProjectLabelProps, ProjectProps } from "../types/tasks";

const label = (labelId: number, name: string): ProjectLabelProps => ({
    labelId,
    name,
    color: "#000",
    textColor: "#fff",
});

const project = (
    projectId: number,
    projectName: string,
    labels: ProjectLabelProps[] = []
): ProjectProps =>
    ({
        projectId,
        projectName,
        projectTags: [],
        projectLabels: labels,
    }) as ProjectProps;

const BACKEND = label(1, "Backend");
const FRONTEND = label(2, "Frontend");
const GROWTH = label(3, "Growth");

describe("projectSidebarOrder", () => {
    it("sorts by label(asc) then name(asc), unlabelled last", () => {
        const projects = [
            project(10, "Zeta", [FRONTEND]),
            project(11, "Untagged B"),
            project(12, "Alpha", [BACKEND]),
            project(13, "Beta", [BACKEND]),
            project(14, "Untagged A"),
        ];
        const ordered = filterAndSortProjects(projects, []).map((p) => p.projectName);
        // Backend group (Alpha, Beta) → Frontend (Zeta) → unlabelled by name.
        expect(ordered).toEqual(["Alpha", "Beta", "Zeta", "Untagged A", "Untagged B"]);
    });

    it("keys a multi-label project on its alphabetically-first label", () => {
        // Labels out of order on the project; key must still be 'Backend'.
        expect(projectLabelSortKey(project(1, "X", [GROWTH, BACKEND]))).toBe("backend");
        expect(projectLabelSortKey(project(2, "Y", []))).toBe("￿");
    });

    it("filters OR across selected labels; empty selection = all", () => {
        const projects = [
            project(10, "Api", [BACKEND]),
            project(11, "Web", [FRONTEND]),
            project(12, "Site", [GROWTH]),
            project(13, "Both", [BACKEND, FRONTEND]),
        ];
        expect(filterAndSortProjects(projects, []).length).toBe(4);
        // Backend OR Frontend → Api, Web, Both (not the Growth-only Site).
        expect(
            filterAndSortProjects(projects, [1, 2])
                .map((p) => p.projectId)
                .sort()
        ).toEqual([10, 11, 13]);
        expect(filterAndSortProjects(projects, [3]).map((p) => p.projectId)).toEqual([12]);
    });

    it("distinctProjectLabels dedupes by id and name-sorts", () => {
        const projects = [
            project(10, "A", [FRONTEND, BACKEND]),
            project(11, "B", [BACKEND, GROWTH]),
        ];
        expect(distinctProjectLabels(projects).map((l) => l.name)).toEqual([
            "Backend",
            "Frontend",
            "Growth",
        ]);
    });

    it("does not mutate the input array", () => {
        const projects = [project(10, "Zeta", [FRONTEND]), project(12, "Alpha", [BACKEND])];
        const snapshot = projects.map((p) => p.projectId);
        filterAndSortProjects(projects, []);
        expect(projects.map((p) => p.projectId)).toEqual(snapshot);
    });
});
