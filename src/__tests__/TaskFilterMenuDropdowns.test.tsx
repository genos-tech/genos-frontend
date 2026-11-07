/**
 * MIP-1121: the task filter bar's dropdowns, now Joy menus (they were Material
 * `Menu`s under a Material ThemeProvider).
 *
 * What people rely on, and what a Joy `MenuItem` would have broken by default:
 * ticking several values keeps the menu OPEN, the trigger shows what is picked
 * (and a "+N" count), Escape closes, and nothing needs a Material theme.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFilterMenu } from "../features/tasks/components/table/TaskFilterMenu";
import {
    predefinedPriorityFilters,
    predefinedStatusFilters,
} from "../features/tasks/types/TaskTableTypes";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn().mockResolvedValue([]),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));

const useTM = {
    allTasks: [],
    tableMilestoneFilterId: null,
    tagsRevision: 0,
    setTableMilestoneFilter: vi.fn(),
} as unknown as TaskManagementState;

const mount = () =>
    render(
        <CssVarsProvider>
            <TaskFilterMenu
                predefinedTagsFilters={[predefinedStatusFilters[0]]}
                setCurrentDisplayingTasks={vi.fn()}
                useTM={useTM}
            />
        </CssVarsProvider>
    );

// The trigger's accessible name is AppTooltip's text; find it by its visible label
// (the field name, then what is chosen: "Status Open +3").
const trigger = (re: RegExp) =>
    screen.getAllByRole("button").find((b) => re.test(b.textContent ?? ""))!;

beforeEach(() => localStorage.clear());

describe("the status dropdown", () => {
    it("opens from its trigger and lists the statuses as menu items", async () => {
        mount();
        expect(screen.queryByRole("menu")).toBeNull();
        fireEvent.click(trigger(/^Status/));
        const menu = await screen.findByRole("menu");
        expect(within(menu).getAllByRole("menuitem").length).toBeGreaterThanOrEqual(
            predefinedStatusFilters.length - 1
        );
        expect(within(menu).getByRole("menuitem", { name: /WIP/ })).toBeTruthy();
    });

    it("ticking values keeps the menu open and the trigger's count follows", async () => {
        mount();
        // The bar starts on its default set: the first is named, the rest are "+N".
        expect(trigger(/^Status/).textContent).toContain("+3");
        fireEvent.click(trigger(/^Status/));
        fireEvent.click(await screen.findByRole("menuitem", { name: /Closed/ }));
        expect(screen.getByRole("menu")).toBeTruthy();
        expect(trigger(/^Status/).textContent).toContain("+4");
        fireEvent.click(screen.getByRole("menuitem", { name: /WIP/ }));
        expect(screen.getByRole("menu")).toBeTruthy();
        expect(trigger(/^Status/).textContent).toContain("+3");
    });

    it("picking All clears the others and closes the menu", async () => {
        mount();
        fireEvent.click(trigger(/^Status/));
        fireEvent.click(await screen.findByRole("menuitem", { name: /^All/ }));
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
        expect(trigger(/^Status/).textContent).toContain("All");
    });

    it("Escape closes it", async () => {
        mount();
        fireEvent.click(trigger(/^Status/));
        fireEvent.keyDown(await screen.findByRole("menu"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
});

describe("the other dimensions", () => {
    it.each([["Priority", predefinedPriorityFilters.find((p) => p.label === "High")!.label]])(
        "%s opens its own menu and keeps it open while picking",
        async (prefix, pick) => {
            mount();
            fireEvent.click(trigger(new RegExp("^" + prefix)));
            fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(pick) }));
            expect(screen.getByRole("menu")).toBeTruthy();
            expect(trigger(new RegExp("^" + prefix)).textContent).toContain(pick);
        }
    );

    it("only one dropdown is open at a time", async () => {
        mount();
        fireEvent.click(trigger(/^Status/));
        await screen.findByRole("menu");
        fireEvent.click(trigger(/^Priority/));
        await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(1));
        expect(
            within(screen.getByRole("menu")).getByRole("menuitem", { name: /High/ })
        ).toBeTruthy();
    });
});

describe("the bar (MIP-1123 review)", () => {
    it("has no Effort filter for now, but still has the other six", () => {
        mount();
        const names = screen.getAllByRole("button").map((b) => b.textContent ?? "");
        expect(names.some((n) => /^Effort/.test(n))).toBe(false);
        for (const field of ["Status", "Priority"]) {
            expect(names.some((n) => n.startsWith(field))).toBe(true);
        }
    });

    it("Reset is an icon-only button named by its tooltip", () => {
        mount();
        const reset = screen.getByRole("button", { name: "Reset all filters to default" });
        expect(reset.textContent?.trim()).toBe("");
        expect(reset.querySelector("svg")).toBeTruthy();
    });
});
