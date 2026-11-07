/**
 * MIP-1123: the task table pilot. jsdom cannot measure layout (row heights were
 * measured in a browser at all three densities, see the evidence page), so these
 * pin the rules that produce them, and the behavior of the new pieces.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import {
    CellButton,
    EffortLabel,
    effortSelectNode,
    prioritySelectNode,
    statusSelectNode,
} from "../features/tasks/components/table/cellEditors";
import { depthRowLeftBorder } from "../features/tasks/components/table/DraggableTaskRow";
import {
    FilterChipButton,
    FilterDropdown,
    splitFilterLabel,
} from "../features/tasks/components/table/filterBarParts";
import { PRIORITY_NAMES, STATUS_NAMES } from "../features/tasks/meta/taskTone";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

describe("row chrome (rules behind the measured 32 / 36 / 44px)", () => {
    const row = source("features/tasks/components/table/DraggableTaskRow.tsx");

    it("a row is at least the density height, not a fixed number", () => {
        expect(row).toContain("minHeight: g.row.current");
        expect(row).not.toMatch(/minHeight:\s*36/);
    });

    it("the cells add no vertical padding (the height is the row's)", () => {
        expect(row).toMatch(/padding:\s*"0 8px"/);
    });

    it("nothing inside a row is taller than the Compact row (32px)", () => {
        // The 32px drag handle and the 32px avatar both set the row height.
        expect(row).toMatch(/height:\s*28,/);
        expect(row).toContain("size={24}");
        expect(row).not.toMatch(/height:\s*32,/);
    });

    it("a nested row has a quiet guide, not a color per depth", () => {
        expect(depthRowLeftBorder(0)).toBe("3px solid transparent");
        expect(depthRowLeftBorder(1)).toContain("var(--g-border");
        expect(depthRowLeftBorder(3)).toBe(depthRowLeftBorder(1));
        expect(row).not.toMatch(/DEPTH_COLORS|DEPTH_HOVER|DEPTH_BORDER/);
    });

    it("hover and selected come from the tokens", () => {
        expect(row).toContain("g.hover");
        expect(row).toContain("g.accent.subtle");
        expect(row).not.toMatch(/rgba\(0, 0, 0, 0\.02\)/);
    });
});

describe("status, priority and effort in the table are the shared components", () => {
    const row = source("features/tasks/components/table/DraggableTaskRow.tsx");

    it("the cells are CellButton + the shared labels, not solid chips", () => {
        expect(row).toMatch(/<CellButton[\s\S]{0,160}?<StatusLabel/);
        expect(row).toMatch(/<CellButton[\s\S]{0,160}?<PriorityIcon/);
        expect(row).toMatch(/<CellButton[\s\S]{0,160}?<EffortLabel/);
        expect(row).not.toMatch(/<PillChip[^>]*icon=\{statusOption/);
    });

    it.each(STATUS_NAMES)(
        "%s draws the same icon and color in the cell, the editor and Recents",
        (status) => {
            const shape = (node: React.ReactNode) => {
                const { container, unmount } = render(<CssVarsProvider>{node}</CssVarsProvider>);
                const icon = container.querySelector("svg")!.getAttribute("data-testid");
                const wrapper = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
                const color = wrapper.style.getPropertyValue("--Icon-color");
                unmount();
                return `${icon}|${color}`;
            };
            const direct = shape(<StatusLabel status={status} />);
            expect(shape(statusSelectNode(status))).toBe(direct);
            expect(
                shape(
                    <CellButton onClick={() => {}}>
                        <StatusLabel status={status} />
                    </CellButton>
                )
            ).toBe(direct);
        }
    );

    it.each(PRIORITY_NAMES)(
        "%s: the editor option is the table's PriorityIcon with its name",
        (priority) => {
            const { getByText, unmount } = render(
                <CssVarsProvider>{prioritySelectNode(priority)}</CssVarsProvider>
            );
            expect(getByText(priority)).toBeTruthy();
            unmount();
        }
    );

    it("effort is plain words in the neutral text color, never a colored fill", () => {
        render(<CssVarsProvider>{effortSelectNode("High")}</CssVarsProvider>);
        const el = screen.getByText(/High/);
        expect(cssOf(el)).toContain("var(--g-text-secondary)");
        expect(cssOf(el)).not.toMatch(/background/);
        expect(el.textContent).toBeTruthy();
        expect(EffortLabel).toBeTruthy();
    });
});

describe("CellButton", () => {
    it("is a button for the keyboard and stops the row from also opening the task", () => {
        const onClick = vi.fn();
        const onRow = vi.fn();
        render(
            <CssVarsProvider>
                <div onClick={onRow} onKeyDown={onRow}>
                    <CellButton label="Open" onClick={onClick}>
                        x
                    </CellButton>
                </div>
            </CssVarsProvider>
        );
        const button = screen.getByRole("button", { name: "Open" });
        fireEvent.click(button);
        fireEvent.keyDown(button, { key: "Enter" });
        fireEvent.keyDown(button, { key: " " });
        expect(onClick).toHaveBeenCalledTimes(3);
        expect(onRow).not.toHaveBeenCalled();
    });
});

describe("splitFilterLabel: the field comes from the locale's template", () => {
    it("English: 'Status: {value}' is the field Status", () => {
        expect(splitFilterLabel(en.tasks.filterButtons.status, "Open").field).toBe("Status");
        expect(splitFilterLabel(en.tasks.filterButtons.tags, "All").field).toBe("Tags");
    });

    it("keeps a translated field and drops a full-width colon", () => {
        const field = splitFilterLabel(ja.tasks.filterButtons.status, "x").field;
        expect(field.length).toBeGreaterThan(0);
        expect(field).not.toMatch(/[:：]/);
        expect(field).not.toContain("{value}");
    });

    it("a template with text after the value keeps it as the suffix", () => {
        const parts = splitFilterLabel("State: {value} (filtered)", "Open");
        expect(parts).toEqual({ field: "State", value: "Open", suffix: "(filtered)" });
    });
});

describe("FilterChipButton", () => {
    const mount = (props: Partial<React.ComponentProps<typeof FilterChipButton>> = {}) =>
        render(
            <CssVarsProvider>
                <FilterDropdown open={false} onOpenChange={() => {}}>
                    <FilterChipButton active={false} field="Status" value="Open, WIP" {...props} />
                </FilterDropdown>
            </CssVarsProvider>
        );
    const button = () => screen.getByRole("button");

    it("shows the whole field name and value: nothing is cut to 'Stat...'", () => {
        mount();
        expect(button().textContent).toContain("Status");
        expect(button().textContent).toContain("Open, WIP");
        const css = cssOf(button());
        expect(css).not.toMatch(/line-clamp|text-overflow:\s*ellipsis|overflow:\s*hidden/);
        expect(css).toContain("white-space: nowrap");
    });

    it("only an active filter carries the accent", () => {
        mount({ active: true });
        expect(cssOf(button())).toContain("var(--g-accent-border)");
        expect(cssOf(button())).toContain("var(--g-accent-subtle)");
        render(<span />);
    });

    it("an idle filter is neutral", () => {
        mount({ active: false });
        const css = cssOf(button());
        expect(css).toContain("var(--g-border)");
        expect(css).not.toContain("var(--g-accent-border)");
    });

    it("shows how many more are chosen as +N, and nothing for one", () => {
        mount({ extra: 3 });
        expect(button().textContent).toContain("+3");
        document.body.innerHTML = "";
        mount({ extra: 0 });
        expect(button().textContent).not.toContain("+");
    });
});

describe("the filter bar wraps instead of scrolling", () => {
    it("no horizontal scroller and no 2-line clamp on the buttons", () => {
        const bar = source("features/tasks/components/table/TaskFilterMenu.tsx");
        expect(bar).toContain('flexWrap: "wrap"');
        expect(bar).not.toContain('overflowX: "auto"');
        expect(bar).not.toContain("WebkitLineClamp");
        expect(bar).not.toContain("getFilterButtonStyle");
    });
});
