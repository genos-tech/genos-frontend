/**
 * MIP-1856: a task graph card's accessible name says the status in the member's language.
 *
 * The card shows its status through `StatusLabel`, which translates the status through
 * `t.tasks.filters`. The card's accessible name (MIP-1830, `cardAriaLabel`) used the raw enum
 * (`Open`, `WIP`, `Closed`), so a screen reader in es read "Open" while the card showed "Abiertas".
 * The name now uses the same label source as the card. In ja, the filter labels for these six
 * statuses are the English words, so the ja name is the same text, but it still comes from that
 * source, which is what this pins.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { fmt, I18nProvider, loadLocale, useTranslation } from "../i18n";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
// Stub the card bodies: the accessible name is set on the React Flow node wrapper, which is what
// these tests read.
vi.mock("../features/tasks/diagram/components/TaskNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/TaskNodeCard")
    >()),
    TaskNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>{data.task.id}</div>
    ),
}));
vi.mock("../features/tasks/diagram/components/MilestoneNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/MilestoneNodeCard")
    >()),
    MilestoneNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>{data.task.id}</div>
    ),
}));

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const row = (id: number, parentTaskId: number | null, status: string, isMilestone = false) =>
    ({
        id: String(id),
        title: `task ${id}`,
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        tags: [],
        isMilestone,
    }) as unknown as TaskTableProps;

const wrapperOf = (id: number) =>
    document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;

// Captures the translator the provider hands out, so the test can build the expected name from the
// same messages the card reads.
let captured: ReturnType<typeof useTranslation>["t"] | null = null;
const Probe = () => {
    captured = useTranslation().t;
    return null;
};

const renderCanvasIn = async (locale: "en" | "ja" | "es") => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    const view = render(
        <CssVarsProvider>
            <I18nProvider>
                <Probe />
                <div style={{ width: 800, height: 600 }}>
                    <TaskFlowCanvas
                        hideClosed={false}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        projectId={1}
                        rootTaskId={1}
                        usePM={{} as never}
                        useTM={
                            {
                                currentPreviewTaskId: -1,
                                setAllTasks: vi.fn(),
                                setCurrentPreviewTaskId: vi.fn(),
                            } as never
                        }
                        onCloseModal={vi.fn()}
                    />
                </div>
            </I18nProvider>
        </CssVarsProvider>
    );
    await act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    return view;
};

beforeEach(() => {
    loadTaskGraph.mockReset();
    loadTaskGraph.mockImplementation(async () => ({
        rootTaskId: 1,
        tasks: [
            row(1, null, "Open", true),
            row(2, 1, "WIP"),
            row(3, 1, "Closed"),
            row(4, 2, "Open"),
        ],
        externalTasks: [],
        dependencyEdges: [],
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    window.localStorage.removeItem("genos-locale");
    vi.restoreAllMocks();
});

describe("a task graph card's accessible name uses the translated status (MIP-1856)", () => {
    it("es: an Open card is named with the Spanish word the card shows, not the enum", async () => {
        await renderCanvasIn("es");
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        const label = wrapperOf(4).getAttribute("aria-label") ?? "";
        const expected = fmt(captured!.tasks.diagram.tooltips.cardAriaLabel, {
            id: "4",
            title: "task 4",
            status: captured!.tasks.filters.open,
        });
        expect(captured!.tasks.filters.open).toBe("Abiertas");
        expect(label).toBe(expected);
        expect(label).toContain("Abiertas");
        expect(label).not.toContain("Open");
    });

    it("es: a WIP card is named with the translated status word", async () => {
        await renderCanvasIn("es");
        await waitFor(() => expect(wrapperOf(2)).not.toBeNull());
        const label = wrapperOf(2).getAttribute("aria-label") ?? "";
        expect(label).toContain(captured!.tasks.filters.wip);
        expect(label).not.toMatch(/\bWIP\b/);
    });

    it("ja: the name is built from the ja status label, the same source the card shows", async () => {
        await renderCanvasIn("ja");
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        const label = wrapperOf(4).getAttribute("aria-label") ?? "";
        const expected = fmt(captured!.tasks.diagram.tooltips.cardAriaLabel, {
            id: "4",
            title: "task 4",
            status: captured!.tasks.filters.open,
        });
        expect(label).toBe(expected);
        expect(label.endsWith(`、${captured!.tasks.filters.open}`)).toBe(true);
    });

    it("en: the name is unchanged, '4 task 4, Open'", async () => {
        await renderCanvasIn("en");
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        expect(wrapperOf(4).getAttribute("aria-label")).toBe("4 task 4, Open");
    });
});
