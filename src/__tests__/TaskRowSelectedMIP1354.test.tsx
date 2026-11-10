/**
 * MIP-1354: the task table's open (previewed) row is firmer than the shared selected tint.
 *
 * `accent.subtle` is 10% in light and 20% in dark, which was too quiet to find an open row
 * among many (Ken, in light especially). The row now mixes 8% more of the theme's accent into
 * it and draws a hairline of the accent border above and below. It uses only the tokens, so
 * every theme and both modes keep their own accent; jsdom can't paint, so how it looks was
 * checked in a browser and these pin the rule and where it is applied.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    depthRowBackground,
    selectedRowBackground,
    selectedRowRing,
} from "../features/tasks/components/table/depthTone";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { THEME_IDS } from "../theme/themePalettes";
import { buildRoles, type Mode } from "../theme/tokens/roles";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));

describe("the selected row's tint", () => {
    it("is the theme's accent mixed into the shared selected tint, tokens only", () => {
        expect(selectedRowBackground).toBe(
            "color-mix(in srgb, var(--g-accent) 8%, var(--g-accent-subtle))"
        );
        expect(selectedRowRing).toBe(
            "inset 0 1px 0 var(--g-accent-border), inset 0 -1px 0 var(--g-accent-border)"
        );
        expect(selectedRowBackground).not.toMatch(/#|rgba?\(/);
    });

    it.each(THEME_IDS.flatMap((id) => (["light", "dark"] as Mode[]).map((m) => [id, m] as const)))(
        "%s / %s ends up clearly firmer than the shared tint, without turning solid",
        (id, mode) => {
            const base = buildRoles(id, mode).accentSubtle.a;
            // 8% of the solid accent over the tint: alpha = 0.08 + 0.92 * base.
            const row = 0.08 + 0.92 * base;
            expect(row).toBeGreaterThan(base + 0.06);
            expect(row).toBeLessThan(0.3);
        }
    );
});

const myself = { userId: "u1", teamId: "t1" } as unknown as UserProps;
const task = {
    id: "42",
    displayId: "PRJ-42",
    title: "Some task",
    status: "Open",
    assigneeId: null,
    assigneeName: null,
    parentTaskId: null,
    rootTaskId: null,
    projectId: 1,
    tags: [],
    daysLeft: 3,
    dueDate: "2026-07-20",
    isMilestone: false,
    milestoneId: null,
} as unknown as TaskTableProps;

const useTM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
} as unknown as TaskManagementState;

const renderRow = (isSelected: boolean, depth = 0) =>
    render(
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
                <DragDropContext onDragEnd={() => {}}>
                    <Droppable droppableId="test-drop">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}>
                                <DraggableTaskRow
                                    columns={[]}
                                    depth={depth}
                                    expandedRows={new Set()}
                                    hasChildren={false}
                                    index={0}
                                    isSelected={isSelected}
                                    mode="light"
                                    myself={myself}
                                    setMyself={vi.fn()}
                                    socket={null}
                                    task={task}
                                    teamMembers={[]}
                                    toggleExpand={vi.fn()}
                                    useCM={{} as never}
                                    useTEM={{} as never}
                                    useTM={useTM}
                                    useUISM={{} as never}
                                    onOpenDiagram={vi.fn()}
                                    onQuickAddChild={vi.fn()}
                                    onRequestPreview={vi.fn()}
                                    onRowUpdate={vi.fn()}
                                />
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </ThemeProvider>
        </CssVarsProvider>
    );

const rowStyle = () => (screen.getByRole("row") as HTMLElement).getAttribute("style") ?? "";

describe("the row", () => {
    it("wears the firmer tint, the hairlines and the accent guide while it is the open one", () => {
        renderRow(true);
        const style = rowStyle();
        expect(style).toContain("color-mix(in srgb, var(--g-accent) 8%");
        expect(style).toContain("inset 0 1px 0 var(--g-accent-border)");
        expect(style).toContain("inset 0 -1px 0 var(--g-accent-border)");
        expect(style).toMatch(/border-left:\s*3px solid var\(--g-accent\)/);
        expect(screen.getByRole("row").getAttribute("data-task-selected")).toBe("true");
    });

    it("an ordinary row has none of it", () => {
        renderRow(false);
        const style = rowStyle();
        expect(style).not.toContain("color-mix(in srgb, var(--g-accent) 8%");
        expect(style).not.toContain("--g-accent-border");
        expect(screen.getByRole("row").getAttribute("data-task-selected")).toBeNull();
    });

    it("the open row replaces a nested row's depth wash instead of stacking on it", () => {
        renderRow(true, 2);
        const style = rowStyle();
        expect(style).toContain("color-mix(in srgb, var(--g-accent) 8%");
        expect(style).not.toContain(depthRowBackground(2));
    });
});
