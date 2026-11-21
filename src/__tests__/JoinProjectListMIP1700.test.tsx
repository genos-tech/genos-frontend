// "Join Project" list (MIP-1700): grouped by label like the joined list, with
// a name search and the shared label filter.
//
// Contract:
//   - unjoined projects sort by label (asc) then name (asc), unlabelled last;
//   - each row shows its label chip;
//   - the name search narrows the rows case-insensitively;
//   - an active search or label filter with no match says so, and an empty
//     project list still says "No projects available".

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinProjectListItem } from "../features/tasks/components/sidebar/projects_subs/JoinProjectListItem";
import { en } from "../i18n/locales/en";
import type { ProjectLabelProps, ProjectProps } from "../types/tasks";

const label = (labelId: number, name: string): ProjectLabelProps => ({
    labelId,
    name,
    color: "#000000",
    textColor: "#ffffff",
});
const BACKEND = label(1, "Backend");
const FRONTEND = label(2, "Frontend");

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
        isJoined: false,
        isPrivate: false,
        systemUserId: "",
    }) as ProjectProps;

const renderJoin = (teamProjects: ProjectProps[]) =>
    render(
        <CssVarsProvider>
            <JoinProjectListItem
                setOpenJoinProject={vi.fn()}
                usePM={{ teamProjects, currentProject: null } as never}
            />
        </CssVarsProvider>
    );

const open = () => fireEvent.click(screen.getByText(en.tasks.sidebar.joinProject));

// The row names in document order.
const rowNames = (names: string[]) => {
    const text = document.body.textContent ?? "";
    return names.filter((n) => text.includes(n)).sort((a, b) => text.indexOf(a) - text.indexOf(b));
};

describe("Join Project list (MIP-1700)", () => {
    it("groups by label, then name, unlabelled last, with the label chip on each row", () => {
        renderJoin([
            project(10, "Zeta", [FRONTEND]),
            project(11, "Untagged B"),
            project(12, "Alpha", [BACKEND]),
            project(13, "Beta", [BACKEND]),
            project(14, "Untagged A"),
        ]);
        open();
        expect(rowNames(["Alpha", "Beta", "Zeta", "Untagged A", "Untagged B"])).toEqual([
            "Alpha",
            "Beta",
            "Zeta",
            "Untagged A",
            "Untagged B",
        ]);
        expect(screen.getAllByText("Backend").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Frontend").length).toBeGreaterThan(0);
    });

    it("narrows the rows by name, case-insensitively, and says so when nothing matches", () => {
        renderJoin([project(10, "Zeta", [FRONTEND]), project(12, "Alpha", [BACKEND])]);
        open();
        const search = screen.getByPlaceholderText(en.tasks.sidebar.filterProjectsPlaceholder);
        fireEvent.change(search, { target: { value: "ZET" } });
        expect(screen.queryByText("Alpha")).toBeNull();
        expect(screen.getByText("Zeta")).toBeInTheDocument();

        fireEvent.change(search, { target: { value: "nothing like this" } });
        expect(screen.getByText(en.tasks.sidebar.noProjectsMatchFilter)).toBeInTheDocument();
    });

    it("keeps the 'No projects available' line for an empty list (no filter shown)", () => {
        renderJoin([]);
        open();
        expect(screen.getByText(en.tasks.sidebar.noProjectsAvailable)).toBeInTheDocument();
        expect(
            screen.queryByPlaceholderText(en.tasks.sidebar.filterProjectsPlaceholder)
        ).toBeNull();
    });

    it("renders 120 unjoined projects, grouped, with the search still working", () => {
        const many = Array.from({ length: 120 }, (_, i) =>
            project(
                100 + i,
                `Project ${String(i).padStart(3, "0")}`,
                i % 3 === 0 ? [BACKEND] : i % 3 === 1 ? [FRONTEND] : []
            )
        );
        renderJoin(many);
        open();
        expect(screen.getByText("Project 000")).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText(en.tasks.sidebar.filterProjectsPlaceholder), {
            target: { value: "project 11" },
        });
        // 11, 110..119 match "project 11"
        expect(screen.getByText("Project 110")).toBeInTheDocument();
        expect(screen.queryByText("Project 000")).toBeNull();
    });
});
