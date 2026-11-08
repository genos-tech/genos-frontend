/**
 * MIP-1242: the task table's loading skeleton keeps the table's own geometry (gutter, column widths,
 * row height), so nothing moves when the rows arrive. jsdom has no layout: this reads the DOM and the
 * CSS the component emits; the pixels were measured in Chromium (see the PR).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TaskTableSkeleton } from "../features/tasks/components/table/TaskTableSkeleton";

afterEach(cleanup);

const allCss = () =>
    Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent ?? "")
        .join("\n");

/** The declarations of every rule whose selector carries one of the element's Emotion classes. */
const rulesOf = (el: Element, pseudo = "") => {
    const css = allCss();
    const out: string[] = [];
    for (const cls of Array.from(el.classList).filter((c) => c.startsWith("css-"))) {
        const re = new RegExp(`\\.${cls}${pseudo.replace(":", "\\:")}\\{([^}]*)\\}`, "g");
        for (const m of css.matchAll(re)) out.push(m[1]);
    }
    return out.join(";");
};

describe("the task table skeleton keeps the table's geometry", () => {
    const columns = [
        { field: "__expand", width: 16, align: "center" as const },
        { field: "id", width: 124, align: "center" as const },
        { field: "status", width: 105, align: "center" as const },
        { field: "tags", width: 110, align: "center" as const },
        { field: "title", width: 300, align: "left" as const },
        { field: "cf_9", width: 140 },
    ];
    const mount = (rows = 3) =>
        render(
            <CssVarsProvider>
                <TaskTableSkeleton
                    columns={columns}
                    gutterWidth={68}
                    label="Loading tasks"
                    rows={rows}
                />
            </CssVarsProvider>
        );

    it("is one status region with the given name, not a bar per row", () => {
        mount();
        const region = screen.getByRole("status", { name: "Loading tasks" });
        expect(region.getAttribute("aria-busy")).toBe("true");
    });

    it("draws the requested rows, each with a cell for every column in header order", () => {
        mount(4);
        const rows = document.querySelectorAll("[data-skeleton-row]");
        expect(rows).toHaveLength(4);
        const fields = Array.from(rows[0].querySelectorAll("[data-skeleton-col]")).map((e) =>
            e.getAttribute("data-skeleton-col")
        );
        expect(fields).toEqual(columns.map((c) => c.field));
    });

    it("gives each cell its column's width (the expand cell keeps its 1px border)", () => {
        mount(1);
        const width = (field: string) => {
            const cell = document.querySelector(`[data-skeleton-col="${field}"]`)!;
            return rulesOf(cell).match(/(?:^|;)width:(\d+)px/)?.[1];
        };
        expect(width("id")).toBe("124");
        expect(width("title")).toBe("300");
        expect(width("cf_9")).toBe("140");
        expect(width("__expand")).toBe("17");
    });

    it("follows the user's row height and the real row's left marker", () => {
        mount(1);
        const rule = rulesOf(document.querySelector("[data-skeleton-row]")!);
        expect(rule).toMatch(/min-height:var\(--g-row\)/);
        expect(rule).toMatch(/border-left:3px solid transparent/);
    });

    it("is what the table renders while the first read is in flight, not the generic rows", () => {
        const text = readFileSync(
            resolve(
                dirname(fileURLToPath(import.meta.url)),
                "../features/tasks/components/table/DraggableTaskTable.tsx"
            ),
            "utf8"
        ).replace(/\s+/g, " ");
        expect(text).toContain("<TaskTableSkeleton columns={columnsWithWidths}");
        expect(text).not.toContain("<SkeletonRows");
    });
});
