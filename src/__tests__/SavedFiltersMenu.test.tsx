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

import { useState } from "react";
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
    type SavedFilterPayload,
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

// A hand-made selection matching no saved filter.
const MANUAL = { status: ["Pending"], tags: ["All"] };

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

const same = (a: SavedFilterPayload, b: SavedFilterPayload) =>
    JSON.stringify(a) === JSON.stringify(b);

// Stands in for `TaskFilterMenu`: it owns the live selection, answers
// `isCurrentSelection` against it, and ADOPTS whatever gets applied. That
// last part matters — the applied badge is derived from the selection, so
// a harness that didn't update the selection on apply couldn't test it at
// all. The `change filter` button simulates the user editing a dimension
// by hand afterwards.
//
// The real equivalence rule (order-insensitive, resolves stored blobs
// against the live predefined lists) is unit-tested in
// `savedFilterPayload.test.ts`; here a JSON compare is enough.
const Host = ({
    onApplySpy,
    getCurrentSpy,
    initial = CURRENT,
    manual = MANUAL,
    ...props
}: {
    onApplySpy: (p: SavedFilterPayload) => void;
    getCurrentSpy: () => void;
    initial?: SavedFilterPayload;
    manual?: SavedFilterPayload;
} & Partial<React.ComponentProps<typeof SavedFiltersMenu>>) => {
    const [current, setCurrent] = useState<SavedFilterPayload>(initial);
    return (
        <>
            <button type="button" onClick={() => setCurrent(manual)}>
                change filter
            </button>
            <SavedFiltersMenu
                isCurrentSelection={(p) => same(p, current)}
                projectId={7}
                teamId="t1"
                getCurrentFilters={() => {
                    getCurrentSpy();
                    return current;
                }}
                onApply={(p) => {
                    onApplySpy(p);
                    setCurrent(p);
                }}
                {...props}
            />
        </>
    );
};

const renderMenu = (props: Partial<React.ComponentProps<typeof SavedFiltersMenu>> = {}) => {
    const onApply = vi.fn();
    const getCurrentFilters = vi.fn();
    const result = render(
        <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
            <CssVarsProvider>
                <Host getCurrentSpy={getCurrentFilters} onApplySpy={onApply} {...props} />
            </CssVarsProvider>
        </ThemeProvider>
    );
    return { ...result, onApply, getCurrentFilters };
};

const changeFilterByHand = () =>
    fireEvent.click(screen.getByRole("button", { name: "change filter" }));

// The trigger's accessible name is AppTooltip's sentence (it writes the
// title onto the child as `aria-label`), so go through the testid.
const trigger = () => screen.findByTestId("saved-filters-button");
const openMenu = async () => {
    fireEvent.click(await trigger());
};

// Each row's Delete icon carries "Delete" as its accessible name (AppTooltip
// again), so the confirm button gets a testid rather than being queried by the
// same word.
const deleteConfirm = () => screen.findByTestId("saved-filter-delete-confirm");

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
        const bare = (over: Partial<React.ComponentProps<typeof SavedFiltersMenu>>) => (
            <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
                <CssVarsProvider>
                    <SavedFiltersMenu
                        getCurrentFilters={() => CURRENT}
                        isCurrentSelection={() => false}
                        projectId={7}
                        teamId="t1"
                        onApply={vi.fn()}
                        {...over}
                    />
                </CssVarsProvider>
            </ThemeProvider>
        );
        expect(render(bare({ projectId: null })).container).toBeEmptyDOMElement();
        expect(loadProjectSavedFilters).not.toHaveBeenCalled();

        render(bare({ teamId: null }));
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

    it("drops the badge once the user edits a filter on top of an applied one", async () => {
        // Apply f1, then change a dimension by hand: the selection is no
        // longer f1, so the button must stop claiming it is.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("My blocked work"));
        await waitFor(async () => expect(await trigger()).toHaveTextContent("My blocked work"));

        changeFilterByHand();
        await waitFor(async () => expect(await trigger()).toHaveTextContent("Saved Filters"));
    });

    it("shows a saved filter as applied when the selection reaches it by hand", async () => {
        // The mirror case: never touch the menu, just build a selection
        // that happens to equal a saved filter, and it counts as applied.
        renderMenu({ initial: MANUAL, manual: row().filters });
        expect(await trigger()).toHaveTextContent("Saved Filters");

        changeFilterByHand();
        await waitFor(async () => expect(await trigger()).toHaveTextContent("My blocked work"));
    });

    it("marks the matching row inside the menu, not just the button", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            row(),
            row({ id: 2, filterName: "Second", filters: { status: ["Closed"] } }),
        ]);
        renderMenu({ initial: row().filters });
        await openMenu();

        // `aria-current` carries "this is the one in effect" to screen
        // readers, and is a stabler hook than the weight/color emphasis.
        const rows = await screen.findAllByRole("menuitem");
        const applied = rows.filter((r) => r.getAttribute("aria-current") === "true");
        expect(applied).toHaveLength(1);
        expect(applied[0]).toHaveTextContent("My blocked work");
    });

    it("keeps the badge on the right row after a rename", async () => {
        // Derived, so it follows the renamed row with no bookkeeping.
        vi.mocked(updateProjectSavedFilter).mockResolvedValue(row({ filterName: "Renamed" }));
        renderMenu({ initial: row().filters });
        await waitFor(async () => expect(await trigger()).toHaveTextContent("My blocked work"));

        vi.mocked(loadProjectSavedFilters).mockResolvedValue([row({ filterName: "Renamed" })]);
        await openMenu();
        fireEvent.click(await screen.findAllByLabelText("Rename").then((els) => els[0]));
        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "Renamed" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));

        await waitFor(async () => expect(await trigger()).toHaveTextContent("Renamed"));
    });

    it("shows every row's actions, not only the auto-focused first one", async () => {
        // Regression: the actions were `opacity: 0` revealed on
        // `:hover, :focus-within`, and a Material Menu auto-focuses its
        // FIRST item on open — so row 1 alone showed its icons. They're
        // always rendered and always clickable now.
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            row(),
            row({ id: 2, filterName: "Second" }),
            row({ id: 3, filterName: "Third" }),
        ]);
        renderMenu();
        await openMenu();

        for (const label of ["Rename", "Delete", "Replace with the current filters"]) {
            const buttons = await screen.findAllByLabelText(label);
            expect(buttons).toHaveLength(3);
            for (const b of buttons) expect(b).toBeVisible();
        }

        // And the third row's action really fires — proof they aren't
        // pointer-events: none.
        fireEvent.click((await screen.findAllByLabelText("Delete"))[2]);
        expect(await screen.findByText("Delete saved filter")).toBeTruthy();
    });

    it("refetches when the dropdown opens, so a teammate's new filter shows up", async () => {
        // These rows are shared; without this a filter someone else just
        // created stays invisible until the component remounts, which
        // undercuts the reason they live server-side at all.
        renderMenu();
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledTimes(1));
        await openMenu();
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledTimes(2));
    });

    it("opens the save dialog EMPTY even while a filter is applied", async () => {
        // Seeding the name with the applied filter would pre-arm an
        // overwrite: the badge doesn't clear when the user edits a
        // dimension by hand, so "apply → tweak → Save" would silently
        // point at replacing a teammate-visible filter.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("My blocked work"));
        await waitFor(async () => expect(await trigger()).toHaveTextContent("My blocked work"));

        await openMenu();
        fireEvent.click(await screen.findByText("Save current filters…"));
        expect(screen.getByPlaceholderText("e.g. My blocked work")).toHaveValue("");
        // …and therefore offers Save, not Overwrite.
        expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull();
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

    it("deletes behind an in-app confirm and refetches", async () => {
        const confirmSpy = vi.spyOn(window, "confirm");
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));

        // Nothing happens on the icon click alone — and it must be OUR modal,
        // not the browser's `genosai.dev says…` dialog.
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(await screen.findByText("Delete saved filter")).toBeTruthy();
        // Shared project-wide, so the confirm names the blast radius AND the row.
        const body = await screen.findByText(/everyone in the project/);
        expect(body.textContent).toContain("My blocked work");

        fireEvent.click(await deleteConfirm());
        await waitFor(() => expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 1, "tok"));
        // mount + open + post-delete refresh.
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledTimes(3));
        confirmSpy.mockRestore();
    });

    it("does not delete when the confirm is dismissed", async () => {
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByText("Delete saved filter")).toBeNull());
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("keeps the delete dialog open and says so when the request fails", async () => {
        // The service fails soft (resolves false), so closing on failure would
        // look exactly like a successful delete.
        vi.mocked(deleteProjectSavedFilter).mockResolvedValue(false);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        fireEvent.click(await deleteConfirm());

        expect(await screen.findByText("Couldn’t delete. Please try again.")).toBeTruthy();
        expect(screen.getByText("Delete saved filter")).toBeTruthy();
        // No refetch — mount + open only.
        expect(loadProjectSavedFilters).toHaveBeenCalledTimes(2);
    });

    it("deletes the row whose button was pressed, not the first one", async () => {
        // The dialog is shared across rows, so the target id has to travel with
        // it. A `pendingDelete` that lost the id would pass the single-row test
        // above and silently delete the wrong filter here.
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            row(),
            row({ id: 2, filterName: "Second" }),
            row({ id: 3, filterName: "Third" }),
        ]);
        renderMenu();
        await openMenu();
        fireEvent.click((await screen.findAllByLabelText("Delete"))[2]);

        expect((await screen.findByText(/everyone in the project/)).textContent).toContain(
            "Third"
        );
        fireEvent.click(await deleteConfirm());
        await waitFor(() => expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 3, "tok"));
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
