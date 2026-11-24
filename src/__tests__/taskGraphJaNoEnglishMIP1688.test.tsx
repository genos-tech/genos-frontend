/**
 * MIP-1688: the Japanese task graph (`tasks.diagram.*`) left words in English: the schedule
 * verdicts On track / At risk / Behind, the legend title, "Openブロッカー", "Openマイルストーン".
 *
 * Decision: Open and Close stay English in ja because they are the app's status names (the
 * status chips, filters and the GitHub merge copy all show them). Everything else is Japanese.
 * This renders the graph in ja and reads every visible word and accessible name, and also scans
 * the whole ja block so a string the render does not reach cannot slip back.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { I18nProvider, loadLocale } from "../i18n";
import { ja } from "../i18n/locales/ja";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

// English words that must not appear. Open / Close are the status names and stay.
const ENGLISH = [
    "Legend",
    "On track",
    "At risk",
    "Behind",
    "Overdue",
    "Due",
    "Blocks",
    "Parent",
    "Child",
    "External",
    "Hide",
    "Show",
    "Collapse",
    "Expand",
    "Schedule",
    "Loading",
    "Untitled",
];
const englishIn = (text: string) =>
    ENGLISH.filter((w) => new RegExp(`(^|[^A-Za-z])${w}([^A-Za-z]|$)`).test(text));

const iso = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const row = (
    id: number,
    parentTaskId: number | null,
    status: string,
    extra: Record<string, unknown> = {}
) =>
    ({
        id: String(id),
        title: `タスク ${id}`,
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        tags: [],
        isMilestone: false,
        ...extra,
    }) as unknown as TaskTableProps;

beforeEach(() => {
    loadTaskGraph.mockReset();
    loadTaskGraph.mockImplementation(async () => ({
        rootTaskId: 1,
        tasks: [
            row(1, null, "Open", { isMilestone: true, dueDate: iso(20), startDate: iso(-10) }),
            row(2, 1, "WIP", { dueDate: iso(-2), startDate: iso(-8) }),
            row(3, 1, "Closed", { dueDate: iso(-5), startDate: iso(-9) }),
            row(4, 1, "Open", { dueDate: iso(1), startDate: iso(-1) }),
            row(5, 2, "Open", { dueDate: iso(6), startDate: iso(0) }),
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

describe("the task graph in Japanese has no English words (MIP-1688)", () => {
    it("the rendered graph, its legend and every accessible name are Japanese", async () => {
        await loadLocale("ja");
        window.localStorage.setItem("genos-locale", "ja");
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <div style={{ width: 1200, height: 800 }}>
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
        await waitFor(() => expect(document.querySelector(".react-flow__node")).not.toBeNull());

        const texts = [document.body.textContent ?? ""];
        for (const el of Array.from(document.querySelectorAll("[aria-label],[title]"))) {
            texts.push(el.getAttribute("aria-label") ?? "", el.getAttribute("title") ?? "");
        }
        const found = texts.flatMap(englishIn);
        expect(found).toEqual([]);
        expect(document.body.textContent).toContain("凡例");
    });

    it("no string of the ja block is English, except the status names Open / Close", () => {
        const diagram = (ja as unknown as { tasks: { diagram: Record<string, unknown> } }).tasks
            .diagram;
        const leaves: Array<[string, string]> = [];
        const walk = (node: unknown, path: string) => {
            if (typeof node === "string") leaves.push([path, node]);
            else if (node && typeof node === "object")
                for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
        };
        walk(diagram, "tasks.diagram");
        expect(leaves.length).toBeGreaterThan(40);
        const offenders = leaves
            .map(([k, v]) => [k, v.replace(/\{[^}]*\}/g, "")] as const)
            // Status names and key names that are English everywhere in the app.
            .map(([k, v]) => [k, v.replace(/\b(Open|Close|Enter)\b/g, "")] as const)
            .filter(([, v]) => /[A-Za-z]{2,}/.test(v))
            .map(([k]) => k);
        expect(offenders).toEqual([]);
    });

    it("the schedule words and legend are pinned", () => {
        const d = (
            ja as unknown as {
                tasks: {
                    diagram: {
                        schedule: Record<string, string>;
                        legend: { title: string };
                        tooltips: Record<string, string>;
                    };
                };
            }
        ).tasks.diagram;
        expect(d.schedule.onTrack).toBe("順調");
        expect(d.schedule.atRisk).toBe("リスクあり");
        expect(d.schedule.behind).toBe("遅れ");
        expect(d.legend.title).toBe("凡例");
        // hide and show of closed tasks use the same word
        expect(d.tooltips.hideClosed.replace("非表示にする", "")).toBe(
            d.tooltips.showClosed.replace("表示する", "")
        );
    });
});
