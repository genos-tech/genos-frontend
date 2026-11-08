/**
 * MIP-1220, the rest of the shell follow-ups.
 *
 * jsdom measures no layout, so the layout facts are pinned from the source (the way
 * `ShellChromeMIP1134` pins the banner's safe-area calc); the behaviour that can run is run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

describe("task details: rows pair up by the width of their pane, not of the window", () => {
    const src = read("features/tasks/components/contents/base/TaskMainBlock.tsx");

    it("Assignee/Reporter and Project/Tags use a container query", () => {
        expect(src).toContain("TWO_COLUMN_MIN_PX");
        expect(src.match(/@container \(min-width: \$\{TWO_COLUMN_MIN_PX\}px\)/g)?.length).toBe(2);
    });

    it("no MUI Grid with viewport breakpoints is left in the block", () => {
        // `sm={6} xs={12}` pairs fields at 600px of WINDOW: a task preview docked next to the table
        // is narrow on a 920px window and the two pickers overlapped.
        expect(src).not.toMatch(/<Grid\b/);
        expect(src).not.toMatch(/sm=\{6\}/);
    });
});

describe("the Tasks dashboard wears the shared page header", () => {
    it("draws its title with PageHeader, not an h2 inside the content", () => {
        const src = read("features/tasks/components/dashboard/TaskHomeContent.tsx");
        expect(src).toContain("<PageHeader");
        expect(src).toContain('data-testid="task-dashboard-header"');
        expect(src).not.toContain("Dashboard Title");
    });

    it("the layout lets it run edge to edge like the table and board headers", () => {
        const src = read("features/tasks/components/layout/TaskHomeLayout.tsx");
        expect(src).toContain(
            "const flushMainPanel = hasPageHeader || useTM.isTaskDashboardVisible"
        );
    });
});
