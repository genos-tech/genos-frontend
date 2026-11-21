/**
 * MIP-1830 (option A): a graph card is one Tab stop. The controls inside it (status
 * menu, date editor, open, add) leave the Tab order; their own behaviour is unchanged
 * and they stay clickable. The preview they open keeps every control in the Tab order.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import type { TaskNodeData } from "../features/tasks/diagram/types";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    Handle: () => null,
}));

const NOOP = () => {};

const node = (): TaskNodeData =>
    ({
        task: {
            id: 7,
            displayId: "MIP-7",
            title: "Node title",
            status: "Open",
            priority: null,
            assigneeId: null,
            assigneeName: "",
            startDate: null,
            dueDate: "2030-01-02",
            isMilestone: false,
            projectId: 1,
            tags: [],
        } as unknown as TaskTableProps,
        isRoot: false,
        isCurrentPreview: false,
        isNewlyCreated: false,
        isInLineage: false,
        isAssignedToViewer: false,
        isExternal: false,
        isDimmed: false,
        openBlockerCount: 0,
        closedDescendantCount: 0,
        totalDescendantCount: 0,
        sprint: null,
        projectName: "",
        onChange: vi.fn(),
        onAddSubtask: vi.fn(),
        onDelete: vi.fn(),
        onOpenPreview: vi.fn(),
    }) as unknown as TaskNodeData;

const renderNode = () =>
    render(
        <AvatarContextProvider
            value={{
                myself: { userId: "me", userName: "Me" } as unknown as UserProps,
                setMyself: NOOP,
                teamMemberProfiles: {},
                setTeamMemberProfiles: NOOP,
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>
                <TaskNodeView data={node()} withHandles />
            </CssVarsProvider>
        </AvatarContextProvider>
    );

describe("a graph card's controls on the keyboard (MIP-1830)", () => {
    it("takes every control inside the card out of the Tab order", () => {
        const { container } = renderNode();
        const controls = Array.from(
            container.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]")
        );
        expect(controls.length).toBeGreaterThan(0);
        for (const el of controls) {
            expect(el.getAttribute("tabindex")).toBe("-1");
        }
    });

    it("leaves the card itself to React Flow's node wrapper (no tab stop of its own)", () => {
        const { getByTestId } = renderNode();
        const card = getByTestId("task-card");
        expect(card.hasAttribute("tabindex")).toBe(false);
    });
});
