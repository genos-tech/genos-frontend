/**
 * The diagram modal hands its scope to the canvas (MIP-1094).
 *
 * "tree" is the default: with no scope the canvas draws the whole hierarchy, as
 * every existing opener expects. "task" reaches the canvas untouched.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";

type CanvasProps = { rootTaskId: number; scope?: string; projectId: number };
vi.mock("../features/tasks/diagram/components/TaskFlowCanvas", () => ({
    TaskFlowCanvas: (props: CanvasProps) => (
        <div
            data-project={props.projectId}
            data-root={props.rootTaskId}
            data-scope={props.scope ?? ""}
            data-testid="canvas"
        />
    ),
}));

const renderModal = (scope?: "tree" | "task") =>
    render(
        <CssVarsProvider>
            <ModalTaskDiagram
                myself={{ userId: "u1", teamId: "t1" } as never}
                open={true}
                projectId={1}
                rootLabel="KDS-5 · Five"
                rootTaskId={5}
                scope={scope}
                usePM={{} as never}
                useTM={{} as never}
                onClose={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("ModalTaskDiagram scope", () => {
    it("passes the task scope to the canvas", () => {
        renderModal("task");

        const canvas = screen.getByTestId("canvas");
        expect(canvas.getAttribute("data-scope")).toBe("task");
        expect(canvas.getAttribute("data-root")).toBe("5");
    });

    it("passes the tree scope to the canvas", () => {
        renderModal("tree");

        expect(screen.getByTestId("canvas").getAttribute("data-scope")).toBe("tree");
    });

    it("leaves the scope unset when the opener gives none, so the canvas keeps its default", () => {
        renderModal();

        expect(screen.getByTestId("canvas").getAttribute("data-scope")).toBe("");
    });
});
