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
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { SavedFiltersMenu } from "../features/tasks/components/table/SavedFiltersMenu";
import {
    createProjectSavedFilter,
    deleteProjectSavedFilter,
    loadProjectSavedFilters,
    updateProjectSavedFilter,
    type ProjectSavedFilter,
    type SavedFilterPayload,
} from "../features/tasks/services/projectSavedFilters";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { en } from "../i18n/locales/en";

vi.mock("../features/tasks/services/projectSavedFilters", async (importActual) => ({
    // The keepalive variant is the real one: its fetch is what the page-close test reads.
    deleteProjectSavedFilterOnExit: (
        await importActual<typeof import("../features/tasks/services/projectSavedFilters")>()
    ).deleteProjectSavedFilterOnExit,
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

// Mounted under Joy's provider ALONE. Until MIP-1121 the hosts wrapped this in a
// Material `ThemeProvider` too, because its Material Button / Menu threw without
// one; leaving the Material theme out here is what pins that it is gone.

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
        <CssVarsProvider>
            <ToastHost />
            <Host getCurrentSpy={getCurrentFilters} onApplySpy={onApply} {...props} />
        </CssVarsProvider>
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

// Delete is an Undo toast, not a dialog (MIP-1274): the DELETE is sent only when the Undo
// window ends. `flushUndoables` is "the window ended" without waiting 8 s.
const UNDO = en.common.feedback.toast.undo;
const deletedToast = (name: string) => en.tasks.savedFilters.deleted.replace("{name}", name);
const windowEnds = () => act(() => flushUndoables("navigate"));

afterEach(() => {
    cleanup();
    __resetUndoables();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
    document.getElementById("genos-banner-region")?.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

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
        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("My blocked work")
            )
        );
    });

    it("is an icon-only button; its tooltip names it (MIP-1123 review)", async () => {
        renderMenu({ initial: MANUAL, manual: row().filters });
        const button = await trigger();
        expect(button.textContent?.trim()).toBe("");
        expect(button.querySelector("svg")).toBeTruthy();
        expect(button.getAttribute("aria-label")).toBeTruthy();
    });

    it("drops the badge once the user edits a filter on top of an applied one", async () => {
        // Apply f1, then change a dimension by hand: the selection is no
        // longer f1, so the button must stop claiming it is.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByText("My blocked work"));
        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("My blocked work")
            )
        );

        changeFilterByHand();
        await waitFor(async () =>
            expect((await trigger()).getAttribute("aria-label")).not.toContain(": ")
        );
    });

    it("shows a saved filter as applied when the selection reaches it by hand", async () => {
        // The mirror case: never touch the menu, just build a selection
        // that happens to equal a saved filter, and it counts as applied.
        renderMenu({ initial: MANUAL, manual: row().filters });
        expect((await trigger()).getAttribute("aria-label")).not.toContain(": ");

        changeFilterByHand();
        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("My blocked work")
            )
        );
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
        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("My blocked work")
            )
        );

        vi.mocked(loadProjectSavedFilters).mockResolvedValue([row({ filterName: "Renamed" })]);
        await openMenu();
        fireEvent.click(await screen.findAllByLabelText("Rename").then((els) => els[0]));
        fireEvent.change(screen.getByPlaceholderText("e.g. My blocked work"), {
            target: { value: "Renamed" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));

        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("Renamed")
            )
        );
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
        expect(await screen.findByText(deletedToast("Third"))).toBeTruthy();
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
        await waitFor(async () =>
            expect(await trigger()).toHaveAttribute(
                "aria-label",
                expect.stringContaining("My blocked work")
            )
        );

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

    it("delete takes the row away at once, says who it affects, and sends nothing yet", async () => {
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));

        // No confirm dialog (and not the browser's): a toast with Undo.
        expect(screen.queryByRole("alertdialog")).toBeNull();
        // Shared project-wide, so the toast still names the blast radius AND the row.
        const toastText = await screen.findByText(/everyone in the project/);
        expect(toastText.textContent).toBe(deletedToast("My blocked work"));
        expect(screen.getByRole("button", { name: UNDO })).toBeTruthy();
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();

        // The row is gone from the list.
        await openMenu();
        await waitFor(() => expect(screen.queryByText("My blocked work")).toBeNull());
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("the DELETE is sent when the window ends, once, and the list is refetched", async () => {
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();

        await windowEnds();
        await waitFor(() => expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 1, "tok"));
        expect(deleteProjectSavedFilter).toHaveBeenCalledTimes(1);
        // mount + open + post-delete refresh.
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledTimes(3));
    });

    it("the toast times out after 8 s and then sends the DELETE", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        await act(async () => void (await vi.advanceTimersByTimeAsync(7000)));
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
        await act(async () => void (await vi.advanceTimersByTimeAsync(1500)));
        expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 1, "tok");
    });

    it("Undo sends nothing and the row is back", async () => {
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        fireEvent.click(await screen.findByRole("button", { name: UNDO }));
        await windowEnds();

        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
        await openMenu();
        expect(await screen.findByText("My blocked work")).toBeTruthy();
    });

    it("a refetch while the delete is pending does not bring the row back", async () => {
        // The server still has it until the DELETE is sent, and every menu open refetches.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        await openMenu();
        await waitFor(() => expect(loadProjectSavedFilters).toHaveBeenCalledTimes(3));
        expect(screen.queryByText("My blocked work")).toBeNull();
    });

    it("puts the row back and says so when the DELETE fails", async () => {
        // The service fails soft (resolves false): the row was hidden on the promise
        // that the delete worked.
        vi.mocked(deleteProjectSavedFilter).mockResolvedValue(false);
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        await windowEnds();

        expect(
            await screen.findByText(
                en.tasks.savedFilters.errorDeleteRestored.replace("{name}", "My blocked work")
            )
        ).toBeTruthy();
        await openMenu();
        expect(await screen.findByText("My blocked work")).toBeTruthy();
        spy.mockRestore();
    });

    it("deletes the row whose button was pressed, not the first one", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            row(),
            row({ id: 2, filterName: "Second" }),
            row({ id: 3, filterName: "Third" }),
        ]);
        renderMenu();
        await openMenu();
        fireEvent.click((await screen.findAllByLabelText("Delete"))[2]);

        expect((await screen.findByText(/everyone in the project/)).textContent).toBe(
            deletedToast("Third")
        );
        await windowEnds();
        await waitFor(() => expect(deleteProjectSavedFilter).toHaveBeenCalledWith(7, 3, "tok"));
        expect(deleteProjectSavedFilter).toHaveBeenCalledTimes(1);
        // The others are untouched.
        await openMenu();
        expect(await screen.findByText("My blocked work")).toBeTruthy();
        expect(screen.getByText("Second")).toBeTruthy();
        expect(screen.queryByText("Third")).toBeNull();
    });

    it("closing the tab inside the window still deletes (a keepalive fetch, not axios)", async () => {
        const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
        vi.stubGlobal("fetch", fetchSpy);
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));

        window.dispatchEvent(new Event("pagehide"));
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toMatch(/\/project\/saved-task-filters\/$/);
        expect(init.method).toBe("DELETE");
        expect(init.keepalive).toBe(true);
        expect(JSON.parse(String(init.body))).toEqual({ project_id: 7, id: 1 });
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
        expect(deleteProjectSavedFilter).not.toHaveBeenCalled();
    });

    it("saving under the name of a filter that is waiting to be deleted says the name is taken", async () => {
        // The name is still taken on the server (unique per project) until the DELETE is sent.
        renderMenu();
        await openMenu();
        fireEvent.click(await screen.findByLabelText("Delete"));
        await openMenu();
        fireEvent.click(await screen.findByText(en.tasks.savedFilters.saveCurrent));
        fireEvent.change(
            await screen.findByPlaceholderText(en.tasks.savedFilters.namePlaceholder),
            {
                target: { value: "my blocked work" },
            }
        );
        fireEvent.click(screen.getByRole("button", { name: en.tasks.savedFilters.saveConfirm }));

        expect(await screen.findByText(en.tasks.savedFilters.errorNameTaken)).toBeTruthy();
        expect(createProjectSavedFilter).not.toHaveBeenCalled();
        expect(updateProjectSavedFilter).not.toHaveBeenCalled();
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
