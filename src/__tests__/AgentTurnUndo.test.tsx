/**
 * The Undo control on an answer turn, rendered bare (props only, no providers),
 * with the real catalog, the real store and a scripted `fetch`.
 *
 * Pinned here:
 *   - it is on screen WITHOUT hover: never inside the hover-revealed `.turn-actions`,
 *     and the slot leaves `renderExtraActions` alone;
 *   - only a write whose result carried `undo` has one, and only a turn whose host
 *     handed it `onUndo`;
 *   - states: idle, "Undoing…" (disabled, one request however many clicks),
 *     done (a status line that replaces the button), refused (a sentence per
 *     code; the button back ONLY where retrying can help);
 *   - a restored write that is already undone says so, with no button; a window
 *     that has passed on this clock offers none;
 *   - several writes: one control each, newest first, labelled with the tool;
 *   - the same turn in TWO surfaces shares one state, one request, one refresh;
 *   - RENDER BUDGET: an undo re-renders its control and nothing else, and no
 *     unrelated write re-renders any turn.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import type { ToolEvent } from "../features/agentQA/types";
import type { UndoRequest, UndoStepRef } from "../features/agentQA/undoSteps";
import { resetUndoStore, runUndo } from "../features/agentQA/undoStore";
import { getMessages, loadLocale } from "../i18n";

const counts = vi.hoisted(() => ({ turns: [] as string[] }));

// One call per render of a turn's step strip (it is not memoised): a turn that
// re-renders shows up here. Tagged by the turn's first step summary.
vi.mock("../features/agentQA/ToolProgressList", async () => {
    const actual = await vi.importActual<typeof import("../features/agentQA/ToolProgressList")>(
        "../features/agentQA/ToolProgressList"
    );
    return {
        ...actual,
        ToolProgressList: (props: React.ComponentProps<typeof actual.ToolProgressList>) => {
            counts.turns.push(props.events[0]?.summary ?? "");
            return <actual.ToolProgressList {...props} />;
        },
    };
});

const RUN = "run-9";
const FAR = new Date(Date.now() + 5 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

beforeAll(async () => {
    await loadLocale("ja");
});

const labels = (locale: "en" | "ja" = "en") =>
    buildAgentTurnLabels(getMessages(locale), "spotlight");

const write = (
    step: number,
    tool: string,
    stepId: number | null,
    over: Partial<ToolEvent> = {}
): ToolEvent => ({
    step,
    tool_name: tool,
    arguments: {},
    status: "done",
    summary: `step-${step}`,
    ...(stepId === null ? {} : { undo: { step_id: stepId, available_until: FAR, run_id: RUN } }),
    ...over,
});

// The host's callback: what `useAgentQA.undoStep` does.
const onUndo = vi.fn((r: UndoRequest) => void runUndo({ ...r, accessToken: "t" }));

const baseProps = (over: Partial<AgentTurnProps> = {}): AgentTurnProps => ({
    askedQuery: "Do it",
    answer: "Done.",
    answerSources: [],
    askError: null,
    isCurrent: false,
    isDark: false,
    labels: labels(),
    toolEvents: [write(2, "update_task", 4711)],
    runId: RUN,
    onPreview: vi.fn(),
    onUndo,
    ...over,
});

const mount = (over: Partial<AgentTurnProps> = {}) =>
    render(
        <CssVarsProvider>
            <AgentTurn {...baseProps(over)} />
        </CssVarsProvider>
    );

// -------- a scripted server --------

type Reply = { status: number; body: unknown } | "network";
const requests: string[] = [];
let pending: Array<(r: Reply) => void> = [];
const stubServer = () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(
            (url: string) =>
                new Promise<Response>((resolve, reject) => {
                    requests.push(url);
                    pending.push((reply) => {
                        if (reply === "network") reject(new TypeError("Failed to fetch"));
                        else
                            resolve({
                                ok: reply.status < 300,
                                status: reply.status,
                                json: async () => reply.body,
                            } as unknown as Response);
                    });
                })
        )
    );
};
const reply = async (r: Reply) => {
    await act(async () => {
        pending.shift()!(r);
        await new Promise((res) => setTimeout(res, 0));
    });
};

const TASK = { kind: "task", task_id: 812, project_id: 9, display_id: "PRJ-12" };
const ok = (over: Record<string, unknown> = {}) => ({
    status: 200,
    body: {
        run_id: RUN,
        step_id: 4711,
        tool_name: "update_task",
        undone_at: "2026-11-04T01:02:03Z",
        action: "restored",
        restored: ["status", "due_date"],
        skipped: [],
        entity: TASK,
        summary: "x",
        ...over,
    },
});
const refuse = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
    status,
    body: { error: "SERVER ENGLISH", code, ...extra },
});

const button = (name: string | RegExp = "Undo") => screen.queryByRole("button", { name });

const bulk: Event[] = [];
const onBulk = (e: Event) => bulk.push(e);

beforeEach(() => {
    resetUndoStore();
    requests.length = 0;
    pending = [];
    counts.turns.length = 0;
    bulk.length = 0;
    onUndo.mockClear();
    window.addEventListener("genos:tasks-bulk-changed", onBulk);
    stubServer();
});
afterEach(() => {
    window.removeEventListener("genos:tasks-bulk-changed", onBulk);
    cleanup();
    vi.unstubAllGlobals();
});

describe("where it is, and when", () => {
    it("shows one plain Undo for one approved write, outside the hover-revealed action bar", () => {
        const { container } = mount();
        const undo = button()!;
        expect(undo).toBeTruthy();
        expect(undo.closest(".turn-actions")).toBeNull();
        expect(container.querySelector(".turn-actions")).toBeTruthy(); // the bar is still there
        expect(
            within(container.querySelector(".turn-actions") as HTMLElement).queryByText("Undo")
        ).toBeNull();
    });

    it("leaves `renderExtraActions` free: both are on the turn", () => {
        mount({ renderExtraActions: () => <button type="button">Save as note</button> });
        expect(button()).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Save as note" }).closest(".turn-actions")
        ).toBeTruthy();
    });

    it("a write whose result carried no `undo` gets no Undo", () => {
        mount({ toolEvents: [write(2, "update_task", null)] });
        expect(button()).toBeNull();
    });

    it("a read, a pending write and a failed write get none", () => {
        mount({
            toolEvents: [
                write(1, "search_workspace", null),
                write(2, "update_task", 4711, { status: "pending" }),
                write(3, "update_task", 4712, { status: "error", error: "boom" }),
            ],
        });
        expect(button()).toBeNull();
    });

    it("a turn whose host gave no `onUndo` shows none", () => {
        mount({ onUndo: undefined });
        expect(button()).toBeNull();
    });

    it("a turn with no tool events shows none, and a restored one shows its own list", () => {
        const restored: UndoStepRef = {
            stepId: 4711,
            step: 2,
            toolName: "create_task",
            runId: RUN,
            availableUntil: FAR,
            undoneAt: null,
        };
        mount({ toolEvents: [], undoSteps: [restored] });
        expect(button()).toBeTruthy();
    });

    it("says what the click does in the tooltip, and that sent things stay sent", async () => {
        mount({ toolEvents: [write(2, "create_task", 4711)] });
        fireEvent.mouseOver(button()!);
        expect(
            await screen.findByText(/Deletes the task Genos created\. Anything already sent/)
        ).toBeTruthy();
    });

    it("is in the person's language", async () => {
        mount({ labels: labels("ja") });
        expect(button("元に戻す")).toBeTruthy();
        expect(button("Undo")).toBeNull();
    });
});

describe("the click", () => {
    it("sends the request for THIS step once, however many clicks, and disables the button", async () => {
        mount();
        const undo = button()!;
        fireEvent.click(undo);
        fireEvent.click(undo);
        fireEvent.click(undo);
        expect(requests).toHaveLength(1);
        expect(requests[0].endsWith(`/agent/runs/${RUN}/steps/4711/undo/`)).toBe(true);
        const busy = screen.getByRole("button", { name: /Undoing/ });
        expect((busy as HTMLButtonElement).disabled).toBe(true);
        await reply(ok());
    });

    it("done: a status line replaces the button, with the localized outcome, once", async () => {
        mount();
        fireEvent.click(button()!);
        await reply(ok({ skipped: [{ field: "priority", reason: "changed_since" }] }));
        expect(button()).toBeNull();
        expect(button(/Undoing/)).toBeNull();
        const line = screen.getByRole("status");
        expect(line.textContent).toBe(
            "Undone. Put back: Status, Due. Left as they are, because they changed since: Priority. " +
                "Anything already sent, such as notifications, isn't recalled."
        );
        expect(line.textContent).not.toContain("SERVER ENGLISH");
        expect(requests).toHaveLength(1);
    });

    it("done, for a delete: names what went", async () => {
        mount({ toolEvents: [write(2, "create_task", 4711)] });
        fireEvent.click(button()!);
        await reply(ok({ tool_name: "create_task", action: "deleted", restored: [] }));
        expect(screen.getByRole("status").textContent).toContain("Task PRJ-12 was deleted.");
    });

    it("done, in Japanese", async () => {
        mount({ labels: labels("ja"), toolEvents: [write(2, "create_task", 4711)] });
        fireEvent.click(button("元に戻す")!);
        await reply(ok({ tool_name: "create_task", action: "deleted", restored: [] }));
        expect(screen.getByRole("status").textContent).toContain("タスク PRJ-12 を削除しました");
    });
});

describe("a refusal", () => {
    // [status, code, sentence it must show, button back?]
    const CASES: Array<[number, string, string, boolean]> = [
        [404, "not_found", "Genos can't find this change any more", false],
        [409, "not_undoable", "This change can't be undone.", false],
        [409, "already_undone", "This change was already undone.", false],
        [409, "changed_since", "This was changed after Genos made its change", false],
        [410, "expired", "It's too late to undo this change", false],
        [403, "permission_lost", "You can no longer change this", false],
    ];

    it.each(CASES)("%i %s: its own sentence, no retry", async (status, code, sentence, retry) => {
        mount();
        fireEvent.click(button()!);
        await reply(refuse(status, code));
        expect(screen.getByRole("status").textContent).toContain(sentence);
        expect(screen.getByRole("status").textContent).not.toContain("SERVER ENGLISH");
        expect(button(/Try again|Undo/)).toBeNull();
        expect(Boolean(button("Try again"))).toBe(retry);
        // And a stray click on nothing sends nothing more.
        expect(requests).toHaveLength(1);
    });

    it("changed_since names the fields that had changed", async () => {
        mount();
        fireEvent.click(button()!);
        await reply(
            refuse(409, "changed_since", {
                skipped: [
                    { field: "status", reason: "changed_since" },
                    { field: "body", reason: "changed_since" },
                ],
            })
        );
        expect(screen.getByRole("status").textContent).toContain("Status, Content");
        expect(screen.getByRole("status").textContent).toContain("Nothing was undone");
    });

    it.each([
        ["a dropped connection", "network" as Reply, "Couldn't reach Genos"],
        ["a 503", { status: 503, body: {} } as Reply, "Something went wrong on our side"],
        [
            "the throttle (a {detail} body, no code)",
            { status: 429, body: { detail: "Request was throttled." } } as Reply,
            "too many undo attempts",
        ],
    ])("%s: a sentence and a Try again that sends it once more", async (_n, r, sentence) => {
        mount();
        fireEvent.click(button()!);
        await reply(r);
        expect(screen.getByRole("status").textContent).toContain(sentence);
        const retry = button("Try again")!;
        expect(retry).toBeTruthy();
        fireEvent.click(retry);
        fireEvent.click(retry);
        expect(requests).toHaveLength(2);
        await reply(ok());
        expect(screen.getByRole("status").textContent).toContain("Undone.");
        expect(button("Try again")).toBeNull();
    });

    it("an answer with no code falls back to the server's own words", async () => {
        mount();
        fireEvent.click(button()!);
        await reply({ status: 409, body: { error: "Server says this is odd." } });
        expect(screen.getByRole("status").textContent).toBe("Server says this is odd.");
        expect(button("Try again")).toBeNull();
    });
});

describe("a restored write", () => {
    const step = (over: Partial<UndoStepRef> = {}): UndoStepRef => ({
        stepId: 4711,
        step: 2,
        toolName: "update_task",
        runId: RUN,
        availableUntil: FAR,
        undoneAt: null,
        ...over,
    });

    it("already undone: says `Undone`, with no button", () => {
        mount({ toolEvents: [], undoSteps: [step({ undoneAt: "2026-11-04T00:00:00Z" })] });
        expect(button()).toBeNull();
        expect(screen.getByRole("status").textContent).toBe("Undone");
    });

    it("past its window on this clock: no button (the server stays the authority)", () => {
        mount({ toolEvents: [], undoSteps: [step({ availableUntil: PAST })] });
        expect(button()).toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
        expect(requests).toHaveLength(0);
    });

    it("within its window: offered, and the click asks the server (which may still refuse)", async () => {
        mount({ toolEvents: [], undoSteps: [step()] });
        fireEvent.click(button()!);
        await reply(refuse(409, "changed_since"));
        expect(screen.getByRole("status").textContent).toContain("changed after Genos");
    });

    it("an entry with no run id has no button: there is nothing to ask the server about", () => {
        mount({ toolEvents: [], undoSteps: [step({ runId: null })], runId: null });
        expect(button()).toBeNull();
    });
});

describe("several writes", () => {
    const three = [
        write(1, "create_task", 4711),
        write(2, "update_task", 4712),
        write(3, "add_comment", 4713),
    ];

    it("one control each, NEWEST first, each labelled with its tool", () => {
        mount({ toolEvents: three });
        const controls = screen.getAllByTestId("undo-control");
        expect(controls.map((c) => c.getAttribute("data-step-id"))).toEqual([
            "4713",
            "4712",
            "4711",
        ]);
        expect(controls[0].textContent).toContain("Adding a comment");
        expect(controls[2].textContent).toContain("Creating a task");
        expect(screen.getByRole("button", { name: "Undo: Adding a comment" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Undo: Creating a task" })).toBeTruthy();
    });

    it("each control has its own state and its own request", async () => {
        mount({ toolEvents: three });
        fireEvent.click(screen.getByRole("button", { name: "Undo: Adding a comment" }));
        expect(requests).toHaveLength(1);
        expect(requests[0]).toContain("/steps/4713/");
        // The others are untouched, and still offer Undo.
        expect(screen.getByRole("button", { name: "Undo: Updating a task" })).toBeTruthy();
        await reply(
            ok({ step_id: 4713, tool_name: "add_comment", action: "deleted", restored: [] })
        );
        expect(screen.getAllByRole("button", { name: /^Undo: / })).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", { name: "Undo: Updating a task" }));
        expect(requests[1]).toContain("/steps/4712/");
        await reply(refuse(409, "changed_since"));
    });
});

describe("one turn in two surfaces (Spotlight's overlay and the kept-alive Genos page)", () => {
    const two = () =>
        render(
            <CssVarsProvider>
                <div data-testid="overlay">
                    <AgentTurn {...baseProps()} />
                </div>
                <div data-testid="page">
                    <AgentTurn {...baseProps()} />
                </div>
            </CssVarsProvider>
        );
    const inside = (id: string) => within(screen.getByTestId(id));

    it("a click in one is seen in the other: one request, no second Undo to click", async () => {
        two();
        fireEvent.click(inside("overlay").getByRole("button", { name: "Undo" }));
        // The copy in the other surface shows the same in-flight state.
        expect(
            (inside("page").getByRole("button", { name: /Undoing/ }) as HTMLButtonElement).disabled
        ).toBe(true);
        expect(inside("page").queryByRole("button", { name: "Undo" })).toBeNull();
        await reply(ok());
        expect(inside("overlay").getByRole("status").textContent).toContain("Undone. Put back");
        expect(inside("page").getByRole("status").textContent).toContain("Undone. Put back");
        expect(requests).toHaveLength(1);
    });

    it("the app is told ONCE, not once per mounted copy", async () => {
        two();
        fireEvent.click(inside("page").getByRole("button", { name: "Undo" }));
        await reply(ok());
        expect(bulk).toHaveLength(1);
    });

    it("a refusal in one is the refusal in the other", async () => {
        two();
        fireEvent.click(inside("overlay").getByRole("button", { name: "Undo" }));
        await reply(refuse(410, "expired"));
        expect(inside("page").getByRole("status").textContent).toContain("too late");
    });
});

describe("render budget", () => {
    // Every turn gets its OWN `toolLabel` spy: an Undo control calls it once per
    // render of that control, so it counts the renders of that turn's control.
    const mountThree = () => {
        const spies = [1, 2, 3].map(() => vi.fn((tool: string) => tool));
        const props = [1, 2, 3].map((n) =>
            baseProps({
                askedQuery: `Question ${n}`,
                answer: `Answer ${n}.`,
                toolEvents: [write(2, "update_task", 4700 + n, { summary: `turn-${n}` })],
                runId: `run-${n}`,
                labels: {
                    ...labels(),
                    approval: { ...labels().approval, toolLabel: spies[n - 1] },
                },
            })
        );
        // The same props objects on every render, as a host hands them.
        const tree = () => (
            <CssVarsProvider>
                {props.map((p, i) => (
                    <AgentTurn key={i} {...p} />
                ))}
            </CssVarsProvider>
        );
        const utils = render(tree());
        return { ...utils, tree, spies };
    };
    const tally = () => {
        const out: Record<string, number> = {};
        for (const s of counts.turns) out[s] = (out[s] ?? 0) + 1;
        return out;
    };

    it("an undo re-renders the ONE control that was clicked, and no turn", async () => {
        const { spies } = mountThree();
        const before = tally();
        expect(before).toEqual({ "turn-1": 1, "turn-2": 1, "turn-3": 1 });
        spies.forEach((s) => s.mockClear());

        fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[1]);
        await reply(ok({ step_id: 4702 }));

        // No turn rendered again (its step strip would have).
        expect(tally()).toEqual(before);
        // The clicked turn's control rendered (undoing, then undone) ...
        expect(spies[1].mock.calls.length).toBeGreaterThanOrEqual(2);
        // ... and the controls of the other two turns did not render at all.
        expect(spies[0]).not.toHaveBeenCalled();
        expect(spies[2]).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2);
    });

    it("an unrelated write (the host re-rendering) re-renders no turn and no control", () => {
        const { rerender, tree, spies } = mountThree();
        const before = tally();
        spies.forEach((s) => s.mockClear());
        for (let i = 0; i < 5; i++) rerender(tree());
        expect(tally()).toEqual(before);
        spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    });

    it("a refused undo re-renders no turn either", async () => {
        const { spies } = mountThree();
        const before = tally();
        spies.forEach((s) => s.mockClear());
        fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]);
        await reply(refuse(409, "changed_since"));
        expect(tally()).toEqual(before);
        expect(spies[1]).not.toHaveBeenCalled();
        expect(spies[2]).not.toHaveBeenCalled();
    });
});
