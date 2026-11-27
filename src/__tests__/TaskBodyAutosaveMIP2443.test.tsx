/**
 * MIP-2443: the task body kept half a sentence. The browser showed "…but it must be visually
 * improved.", `TaskMaster.content` stopped at "…but it must ", and nothing was saved again.
 *
 * The autosave PUT carries the body as it was when it started; when it came back it cleared the
 * "edited" flag, so words typed meanwhile (or still in the editor's debounce) were never sent. The
 * same route lost words when a save failed, when the preview closed or changed task within the
 * debounce, and when a reload of the same task landed first.
 *
 * The REAL `TaskPreview` and save hook are mounted. The body editor is a stub with the real one's
 * timing: a keystroke marks the body edited at once, its text reaches the host only on `sync` (the
 * debounce) or a flush. The PUT is answered by the test.
 */
import { act, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import { loadSpecificTask } from "../features/tasks/services/loadSpecificTask";
import {
    keepUnsavedBody,
    settleUnsavedBody,
    UNSAVED_TASK_BODY_PREFIX,
} from "../features/tasks/services/unsavedTaskBody";
import type { TaskProps } from "../types/tasks";
import { clearSignOutLocalStorage } from "../utils/signOutLeftovers";

type Put = { id: number; text: string; ok: () => void; fail: (retry: boolean) => void };
const net = vi.hoisted(() => ({ puts: [] as Put[] }));
/** What the preview hands the body block. */
type BodyProps = {
    setBody: (body: unknown[]) => void;
    setTaskBodyEdited: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    flushRef?: { current: (() => void) | null };
};
/** What the stubs read from the arguments the app calls them with. */
type SentTask = { id: number; body?: { text: string }[] };
type SaveOptions = { onNotSaved?: (retry: boolean) => void };
type MilestoneInput = { milestoneId: number; description: { text: string }[] };
type MilestoneOpts = { refusal?: SaveOptions };
const editor = vi.hoisted(() => ({
    text: "",
    pending: false,
    props: null as unknown,
}));
const doc = vi.hoisted(() => (text: string) => [{ type: "paragraph", text }]);

vi.mock("../features/tasks/services/sendUpdatedSpecificTask", () => ({
    sendUpdatedSpecificTask: vi.fn(
        (...args: unknown[]) =>
            new Promise((resolve) => {
                const task = args[2] as SentTask;
                net.puts.push({
                    id: task.id,
                    text: task.body?.[0]?.text ?? "",
                    ok: () => resolve([]),
                    fail: (retry) => {
                        (args[6] as SaveOptions | undefined)?.onNotSaved?.(retry);
                        resolve(undefined);
                    },
                });
            })
    ),
}));

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({ get: () => new Promise(() => undefined) }),
}));
vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn(async () => undefined),
    cacheFullTask: vi.fn(async () => undefined),
}));
vi.mock("../features/integrations/services/github", () => ({
    tryLoadLinkedBranches: vi.fn(async () => null),
    tryLoadLinkedPulls: vi.fn(async () => null),
}));
vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(async () => null),
}));

const sync = (props = editor.props as BodyProps) => {
    if (!editor.pending) return;
    editor.pending = false;
    props.setBody(doc(editor.text));
};
vi.mock("../features/tasks/components/contents/base/TaskBodyBlock", async () => {
    const { useEffect } = await import("react");
    return {
        TaskBodyBlock: function BodyStub(p: BodyProps) {
            editor.props = p;
            // Bound to this instance and gone with it, as the real editor's flush is.
            useEffect(() => {
                const ref = p.flushRef;
                if (!ref) return;
                ref.current = () => sync(p);
                return () => {
                    ref.current = null;
                };
            });
            return null;
        },
    };
});

// -------------------------------------------------------- stubbed leaves --

vi.mock("../features/tasks/components/contents/base/TaskTitleBlock", () => ({
    TaskTitleBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskCustomBarBlock", () => ({
    TaskCustomBarBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskTabBlock", () => ({
    TaskTabBlock: () => null,
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));
vi.mock("../features/integrations/components/LinkedPrCard", () => ({
    LinkedPrCard: () => null,
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../features/tasks/sprint-milestone/components/MilestoneFolderPicker", () => ({
    MilestoneFolderPicker: () => null,
}));
vi.mock("../features/tasks/sprint-milestone/components/SprintMilestonePicker", () => ({
    SprintMilestonePicker: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACProjectTags", () => ({
    ACProjectTags: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskEffortLevel", () => ({
    ACTaskEffortLevel: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskPriority", () => ({
    ACTaskPriority: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskSelector", () => ({
    StatusChip: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskStatus", () => ({
    ACTaskStatus: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTeamProjects", () => ({
    ACTeamProjects: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTeamUsers", () => ({
    ACTeamUsers: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/MultiMemberPicker", () => ({
    MultiMemberPicker: () => null,
}));
vi.mock("../features/tasks/components/modals/ModalManageTags", () => ({
    ModalManageTags: () => null,
}));
vi.mock("../features/tasks/components/contents/base/CustomFieldsBlock", () => ({
    CustomFieldsBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/DynamicURLManager", () => ({
    DynamicURLManager: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskDueDateInput", () => ({
    TaskDueDateInput: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskStartDateInput", () => ({
    TaskStartDateInput: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskDeliveriesBlock", () => ({
    TaskDeliveriesBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskDependenciesBlock", () => ({
    isCurrentlyBlocked: () => false,
    TaskDependenciesBlock: () => null,
}));

vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(() => new Promise(() => undefined)),
}));

// ------------------------------------------------------------------ host --

const PROJECT = { projectId: 7, projectName: "Proj" };
const ME = { userId: "u1", teamId: "t1", userName: "Me", userEmail: "me@x.io" };

const stubBag = <T extends object>(base: T): T =>
    new Proxy(base, {
        get: (target, prop) => {
            if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
            if (typeof prop === "symbol") return undefined;
            return () => undefined;
        },
    });

const makeTask = (id: number, text: string): TaskProps =>
    ({
        id,
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        body: doc(text),
        attachments: [],
        links: [],
        tags: [],
        collaborators: [],
        project: PROJECT,
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        assignee: ME,
        reporter: ME,
        parentTaskId: null,
        rootTaskId: id,
        isMilestone: false,
        updatedAt: "2026-11-01 10:00:00",
    }) as unknown as TaskProps;

const makeMilestone = (milestoneId: number) => ({
    milestoneId,
    taskId: milestoneId * 100,
    displayId: `PRJ-${milestoneId}`,
    projectId: PROJECT.projectId,
    teamId: "t1",
    sprintId: null,
    folderId: null,
    reporterId: null,
    reporter: null,
    title: `Milestone ${milestoneId}`,
    description: doc(`milestone ${milestoneId}`),
    status: "Open",
    statusCode: null,
    priority: null,
    priorityCode: null,
    startDate: null,
    dueDate: null,
    tags: [],
    links: [],
    customFieldValues: {},
    collaborators: [],
    assignees: [],
    isDeleted: false,
    tsCreatedAt: "2026-11-01 10:00:00",
    tsUpdatedAt: "2026-11-01 10:00:00",
    tasksTotal: 0,
    tasksClosed: 0,
});

const host: {
    open: (task: TaskProps) => void;
    /** The chat pane: another task is asked for, its data not here yet. */
    request: (id: number) => void;
    openMilestone: (id: number) => void;
    renew: () => void;
} = {
    open: () => undefined,
    request: () => undefined,
    openMilestone: () => undefined,
    renew: () => undefined,
};
let renewed = 0;

const patches: { milestoneId: number; text: string; ok: () => void; fail: () => void }[] = [];
const updateExistingMilestone = (
    input: MilestoneInput,
    _p: number,
    _s: unknown,
    _m: unknown,
    opts?: MilestoneOpts
) =>
    new Promise((resolve) => {
        patches.push({
            milestoneId: input.milestoneId,
            text: input.description[0].text,
            ok: () => resolve(makeMilestone(input.milestoneId)),
            fail: () => {
                opts?.refusal?.onNotSaved?.(true);
                resolve(null);
            },
        });
    });

const Host = ({ milestone, chat }: { milestone: boolean; chat: boolean }) => {
    const [requested, setRequested] = useState<number | null>(null);
    host.request = setRequested;
    const [task, setTask] = useState<TaskProps | undefined>(
        milestone ? undefined : makeTask(1, "loaded")
    );
    const [milestoneId, setMilestoneId] = useState(1);
    const [token, setToken] = useState(0);
    host.open = setTask;
    host.renew = () => setToken(1);
    host.openMilestone = setMilestoneId;
    const useTM = stubBag({
        currentPreviewTask: task,
        currentPreviewTaskId: requested ?? (task ? Number(task.id) : -1),
        setCurrentPreviewTask: setTask,
        currentPreviewKind: milestone ? "milestone" : "task",
        currentPreviewMilestoneId: milestone ? milestoneId : -1,
        previewLoadFailedTaskId: null,
        allTasks: [],
        taskComments: [],
        taskCommentLines: 1,
        taskDependencies: {},
        loadTaskDependenciesFor: () => new Promise(() => undefined),
    });
    const useSM = stubBag({
        projectMilestones: { [PROJECT.projectId]: [makeMilestone(1), makeMilestone(2)] },
        convertedMilestones: {},
        projectSprints: {},
        updateExistingMilestone: (...args: Parameters<typeof updateExistingMilestone>) => {
            renewed += token;
            return updateExistingMilestone(...args);
        },
        isMilestoneFavorited: () => false,
    });
    return (
        <TaskPreview
            guardStaleTaskId={chat}
            myself={ME as never}
            setMyself={vi.fn()}
            socket={null}
            useCM={stubBag({}) as never}
            useNM={stubBag({ taskNoteMeta: undefined }) as never}
            usePM={stubBag({ teamProjects: [] }) as never}
            useSM={useSM as never}
            useTEM={stubBag({ teamMemberProfiles: {}, teamMembers: [] }) as never}
            useTM={useTM as never}
            useUISM={stubBag({}) as never}
        />
    );
};

const pass = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const mount = async ({ milestone = false, chat = false } = {}) => {
    const view = render(
        <CssVarsProvider>
            <Host chat={chat} milestone={milestone} />
        </CssVarsProvider>
    );
    await pass(200); // the baseline of the loaded body is taken
    return view;
};
/** A keystroke: marked edited at once, the text still in the editor's debounce. */
const type = (text: string) =>
    act(async () => {
        editor.text = text;
        editor.pending = true;
        (editor.props as BodyProps).setTaskBodyEdited(true);
        (editor.props as BodyProps).setTaskBodySaved(false);
    });
/** The debounce fires. */
const pause = () => act(async () => sync());
const answer = (call: () => void) => act(async () => call());
const sent = () => net.puts.map((p) => [p.id, p.text]);
const patched = () => patches.map((p) => [p.milestoneId, p.text]);

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.mocked(loadSpecificTask).mockReset();
    vi.mocked(loadSpecificTask).mockImplementation(() => new Promise(() => undefined));
    net.puts.length = 0;
    patches.length = 0;
    renewed = 0;
    editor.pending = false;
    editor.props = null;
});
afterEach(() => {
    vi.useRealTimers();
});

describe("task body autosave", () => {
    const firstSaveInFlight = async () => {
        const view = await mount();
        await type("but it must ");
        await pause();
        await pass(3000);
        expect(sent()).toEqual([[1, "but it must "]]);
        return view;
    };

    it("sends the words typed while the save was in flight", async () => {
        await firstSaveInFlight();
        await type("but it must be visually improved.");
        await pause();
        await answer(net.puts[0].ok);
        await pass(3000);
        expect(sent()[1]).toEqual([1, "but it must be visually improved."]);
    });

    it("sends words that were still in the editor's debounce when the save finished", async () => {
        await firstSaveInFlight();
        await type("but it must be visually improved.");
        await answer(net.puts[0].ok);
        await pass(3000);
        expect(sent()[1]).toEqual([1, "but it must be visually improved."]);
    });

    it("goes quiet once everything typed is stored", async () => {
        await firstSaveInFlight();
        await answer(net.puts[0].ok);
        await pass(12000);
        expect(net.puts).toHaveLength(1);
    });

    it("saves a change that goes back to what was first loaded", async () => {
        await firstSaveInFlight();
        await answer(net.puts[0].ok);
        await type("loaded");
        await pause();
        await pass(3000);
        expect(sent()[1]).toEqual([1, "loaded"]);
    });

    it("sends a failed save again without another keystroke", async () => {
        await firstSaveInFlight();
        await answer(() => net.puts[0].fail(true));
        await pass(3000);
        expect(sent()[1]).toEqual([1, "but it must "]);
    });

    it("waits longer between one failed retry and the next", async () => {
        await firstSaveInFlight();
        for (let i = 0; i < 6; i++) {
            await answer(() => net.puts[net.puts.length - 1].fail(true));
            await pass(3000);
        }
        // 3 s ticks: first retry at once, then after 6, 12 s: not one per tick.
        expect(net.puts.length).toBeLessThan(5);
    });

    it("does not repeat a save the server will never take", async () => {
        await firstSaveInFlight();
        await answer(() => net.puts[0].fail(false));
        await pass(12000);
        expect(net.puts).toHaveLength(1);
    });

    it("saves the last words when the preview closes", async () => {
        const view = await mount();
        await type("typed just before leaving");
        view.unmount();
        expect(sent()).toEqual([[1, "typed just before leaving"]]);
    });

    it("saves the last words of the outgoing task on a switch", async () => {
        await mount();
        await type("typed just before switching");
        await act(async () => host.open(makeTask(2, "other")));
        expect(sent()).toEqual([[1, "typed just before switching"]]);
    });

    it("does not let a reload of the same task replace unsaved words", async () => {
        await mount();
        await type("not saved yet");
        await pause();
        await act(async () => host.open(makeTask(1, "loaded")));
        await pass(3000);
        expect(sent()).toEqual([[1, "not saved yet"]]);
    });
});

describe("milestone description autosave", () => {
    const firstPatchInFlight = async () => {
        const view = await mount({ milestone: true });
        await type("but it must ");
        await pause();
        await pass(3000);
        expect(patched()).toEqual([[1, "but it must "]]);
        return view;
    };

    it("sends the words typed while the save was in flight", async () => {
        await firstPatchInFlight();
        await type("but it must be visually improved.");
        await answer(patches[0].ok);
        await pass(3000);
        expect(patched()[1]).toEqual([1, "but it must be visually improved."]);
    });

    it("sends a failed save again without another keystroke", async () => {
        await firstPatchInFlight();
        await answer(patches[0].fail);
        await pass(3000);
        expect(patched()[1]).toEqual([1, "but it must "]);
    });

    it("retries with the save function of now, not the one the timer started with", async () => {
        await firstPatchInFlight();
        await answer(patches[0].fail);
        // The token was renewed: the app hands the preview a new save function.
        await act(async () => host.renew());
        await pass(3000);
        expect(renewed).toBe(1);
    });

    it("saves into its own milestone on a switch, never into the next one", async () => {
        await mount({ milestone: true });
        await type("typed just before switching");
        await act(async () => host.openMilestone(2));
        await pass(6000);
        expect(patched()).toEqual([[1, "typed just before switching"]]);
    });
});

describe("words that may not have been saved (MIP-2455)", () => {
    const kept = () =>
        Object.keys(localStorage).filter((key) => key.startsWith(UNSAVED_TASK_BODY_PREFIX));
    /** What the server answers when the repair asks for the task. */
    const serverHas = (text: string) =>
        vi.mocked(loadSpecificTask).mockImplementation(async () => [makeTask(1, text)]);

    const reload = async () => {
        const view = await mount();
        await type("typed before the reload");
        await act(async () => void window.dispatchEvent(new Event("pagehide")));
        expect(kept()).toHaveLength(1);
        // The page is gone: nothing it had on the way arrives.
        const record = localStorage.getItem(kept()[0])!;
        const key = kept()[0];
        view.unmount();
        localStorage.setItem(key, record);
        net.puts.length = 0;
    };

    it("are saved when the task is opened after a reload", async () => {
        await reload();
        serverHas("loaded");
        await mount();
        expect(sent()).toEqual([[1, "typed before the reload"]]);
        await answer(net.puts[0].ok);
        expect(kept()).toHaveLength(0);
    });

    it("never overwrite what someone wrote since", async () => {
        await reload();
        serverHas("written through the API meanwhile");
        await mount();
        await pass(6000);
        expect(net.puts).toHaveLength(0);
        expect(kept()).toHaveLength(0);
    });

    it("are kept while the server cannot be asked", async () => {
        await reload();
        vi.mocked(loadSpecificTask).mockImplementation(async () => []);
        await mount();
        expect(net.puts).toHaveLength(0);
        expect(kept()).toHaveLength(1);
    });

    it("are saved on the next visit when the save made while switching failed", async () => {
        await mount();
        await type("typed just before switching");
        await act(async () => host.open(makeTask(2, "other")));
        await answer(() => net.puts[0].fail(true));
        expect(kept()).toHaveLength(1);

        serverHas("loaded");
        await act(async () => host.open(makeTask(1, "loaded")));
        await pass(200);
        expect(sent()[1]).toEqual([1, "typed just before switching"]);
        await answer(net.puts[1].ok);
        expect(kept()).toHaveLength(0);
    });

    it("are forgotten once the save made while leaving has stored them", async () => {
        const view = await mount();
        await type("typed just before leaving");
        view.unmount();
        expect(kept()).toHaveLength(1);
        await answer(net.puts[0].ok);
        expect(kept()).toHaveLength(0);
    });

    it("do not survive a later save, which has something newer", () => {
        keepUnsavedBody("u1", 1, doc("older"), "base");
        settleUnsavedBody("u1", 1, doc("newer"), { stored: true, startedAt: Date.now() + 1 });
        expect(kept()).toHaveLength(0);
    });

    it("stay, on top of it, when an earlier save lands after they were kept", () => {
        keepUnsavedBody("u1", 1, doc("older and more"), "base");
        settleUnsavedBody("u1", 1, doc("older"), { stored: true, startedAt: Date.now() - 1000 });
        expect(JSON.parse(localStorage.getItem(kept()[0])!).base).toContain("older");
    });

    it("go with the sign-out", () => {
        keepUnsavedBody("u1", 1, doc("private"), "base");
        clearSignOutLocalStorage();
        expect(kept()).toHaveLength(0);
    });

    it("reach the save when the chat pane swaps the editor for its loader", async () => {
        await mount({ chat: true });
        await type("typed just before the loader");
        await act(async () => host.request(2));
        await act(async () => host.open(makeTask(2, "other")));
        expect(sent()).toEqual([[1, "typed just before the loader"]]);
    });
});
