/**
 * Saved Filters — the named, project-shared filter selections in the task
 * filter bar.
 *
 * Two layers:
 *
 *  - `SavedFiltersMenu` — lists the project's filters, applies one,
 *    resolves a same-name save to an overwrite (PUT) rather than a
 *    duplicate create (POST), renames, deletes, and stays hidden until a
 *    project is resolved.
 *  - `buildSavedFilterPayload` / `resolveSavedFilter` — the pure halves of
 *    the round trip. The interesting rule is `status`: a filter saved from
 *    a surface that HIDES the status dimension (the sprint board) must not
 *    record it, and applying a filter that carries one on such a surface
 *    must not impose it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SavedFiltersMenu } from "../features/tasks/components/table/SavedFiltersMenu";
import {
    createProjectSavedFilter,
    deleteProjectSavedFilter,
    loadProjectSavedFilters,
    updateProjectSavedFilter,
    type ProjectSavedFilter,
} from "../features/tasks/services/projectSavedFilters";

vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn(),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const CURRENT = {
    status: ["Open", "WIP"],
    tags: ["All"],
    priorities: ["High"],
    effortLevels: ["All"],
    milestoneKeys: ["all"],
    memberKeys: ["__all__"],
};

const row = (over: Partial<ProjectSavedFilter> = {}): ProjectSavedFilter => ({
    id: 1,
    filterName: "My blocked work",
    filters: { status: ["Blocked"], memberKeys: ["u1"] },
    createdBy: "u9",
    tsUpdatedAt: "2026-07-30T00:00:00Z",
    ...over,
});

// Both real hosts (`DraggableTaskTable`, `SprintBoard`) wrap their content
// in a Material `ThemeProvider` alongside Joy's, and this component's
// Material Button / Menu NEED it: under the Joy theme alone,
// `@mui/material/Button` throws reading `theme.palette.grey[300]`. Mirror
// the real mount rather than papering over it — the same coupling is why
// the dropdown must pass `slots={{ transition: Fade }}` and why the
// dialogs are Joy.
const materialTheme = createTheme({ cssVariables: true });

const renderMenu = (props: Partial<React.ComponentProps<typeof SavedFiltersMenu>> = {}) => {
    const onApply = vi.fn();
    const getCurrentFilters = vi.fn(() => CURRENT);
    const result = render(
        <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
            <CssVarsProvider>
                <SavedFiltersMenu
                    getCurrentFilters={getCurrentFilters}
                    projectId={7}
                    teamId="t1"
                    onApply={onApply}
                    {...props}
                />
            </CssVarsProvider>
        </ThemeProvider>
    );
    return { ...result, onApply, getCurrentFilters };
};

// The trigger's accessible name is AppTooltip's sentence (it writes the
// title onto the child as `aria-label`), so go through the testid.
const trigger = () => screen.findByTestId("saved-filters-button");
const openMenu = async () => {
    fireEvent.click(await trigger());
};

describe("SavedFiltersMenu", () => {
    beforeEach(() => {
        vi.mocked(loadProjectSavedFilters).mockReset().mockResolvedValue([row()]);
        vi.mocked(createProjectSavedFilter)
            .mockReset()
            .mockResolvedValue(row({ id: 2 }));
        vi.mocked(updateProjectSavedFilter).mockReset().mockResolvedValue(row());
        vi.mocked(deleteProjectSavedFilter).mockReset().mockResolvedValue(true);
    });

    it("renders nothing until a project and team are resolved", () => {
        const { container } = renderMenu({ projectId: null });
        expect(container).toBeEmptyDOMElement();
        expect(loadProjectSavedFilters).not.toHaveBeenCalled();

        renderMenu({ teamId: null });
        expect(loadProjectSavedFilters).not.toHaveBeenCalled();
    });

    it("loads the project's filters and applies the one clicked", async () => {
        const { onApply } = renderMenu();
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledWith("t1", 7, "tok"));

        await openMenu();
        fireEvent.click(await screen.findByText("My blocked work"));

        // Applying hands the stored blob to the bar verbatim — resolving
        // labels/ids against the live lists is the bar's job.
        expect(onApply).toHaveBeenCalledWith({ status: ["Blocked"], memberKeys: ["u1"] });
        // The button then names the applied filter instead of "Saved Filters".
        await waitFor(async () => expect(await trigger()).toHaveTextContent("My blocked work"));
    });

    it("saves a new name as a create, with the bar's current selection", async () => {
        const { getCurrentFilters } = renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("Save current filters…"));

        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "Sprint review" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() =>
            expect(createProjectSavedFilter).toHaveBeenCalledWith(
                "t1",
                7,
                "Sprint review",
                CURRENT,
                "tok"
            )
        );
        // Read at click time, not held as a prop.
        expect(getCurrentFilters).toHaveBeenCalled();
        expect(updateProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("resolves a same-name save to an overwrite, not a duplicate create", async () => {
        // The server's unique (project, name) constraint would 400 a
        // same-name POST — this is the "overridable with the same name"
        // gesture, so the client turns it into a PUT.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("Save current filters…"));

        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "My blocked work" },
        });
        // The button and a warning both say "overwrite" BEFORE the click.
        expect(
            await screen.findByText(/already exists — saving replaces it for everyone/)
        ).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

        await waitFor(() =>
            expect(updateProjectSavedFilter).toHaveBeenCalledWith(
                7,
                1,
                { filters: CURRENT },
                "tok"
            )
        );
        expect(createProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("matches an existing name case-insensitively when deciding to overwrite", async () => {
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("Save current filters…"));
        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "  my BLOCKED work  " },
        });
        fireEvent.click(await screen.findByRole("button", { name: "Overwrite" }));

        await waitFor(() => expect(updateProjectSavedFilter).toHaveBeenCalled());
        expect(createProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("renames without touching the saved selection", async () => {
        vi.mocked(updateProjectSavedFilter).mockResolvedValue(row({ filterName: "Renamed" }));
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Rename"));

        const input = screen.getByPlaceholderText("e.g. My blocked work");
        expect(input).toHaveValue("My blocked work");
        fireEvent.change(input, { target: { value: "Renamed" } });
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));

        await waitFor(() =>
            expect(updateProjectSavedFilter).toHaveBeenCalledWith(
                7,
                1,
                { filterName: "Renamed" },
                "tok"
            )
        );
    });

    it("refuses a rename onto another filter's name", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            row(),
            row({ id: 2, filterName: "Taken" }),
        ]);
        renderMenu();
        await openMenu();
        // First row's rename action.
        fireEvent.click((await screen.findAllByLabelText("Rename"))[0]);
        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "Taken" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));

        expect(
            await screen.findByText("Another saved filter already uses that name.")
        ).toBeTruthy();
        expect(updateProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("deletes behind a confirm and refetches", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));

        await waitFor(() => expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 1, "tok"));
        // Shared project-wide, so the confirm names the blast radius.
        expect(confirmSpy.mock.calls[0][0]).toContain("everyone in the project");
        expect(loadProjectSavedFilters).toHaveBeenCalledTimes(2);
        confirmSpy.mockRestore();
    });

    it("does not delete when the confirm is dismissed", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));

        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it("a row action does not also apply the row's filter", async () => {
        // The row itself applies on click, so every action button inside
        // it stops propagation — otherwise pressing Rename would silently
        // apply the filter too.
        const { onApply } = renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Rename"));
        expect(onApply).not.toHaveBeenCalled();
    });

    it("surfaces a save failure instead of closing the dialog", async () => {
        vi.mocked(createProjectSavedFilter).mockResolvedValue(null);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("Save current filters…"));
        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "Nope" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText("Couldn’t save. Please try again.")).toBeTruthy();
    });

    it("shows an empty hint when the project has no saved filters", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([]);
        renderMenu();
        await openMenu();
        expect(await screen.findByText(/No saved filters yet/)).toBeTruthy();
    });

    it("fails soft when the list request errors", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue(null);
        renderMenu();
        await openMenu();
        // Still usable — the user can save a new one.
        expect(await screen.findByText("Save current filters…")).toBeTruthy();
    });
});
