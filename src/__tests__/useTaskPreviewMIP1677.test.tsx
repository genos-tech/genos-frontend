/**
 * MIP-1677. The task behind a task note (the header's project avatar and task pill) was loaded
 * again on EVERY note switch: the effect depended on the whole `pathname`, which changes with each
 * note, so it ran once when the note changed and again when the URL followed. Each run was a load
 * (the second answered from the cache, so no extra request) and a write, and so a commit of the whole
 * app. Only whether the route is a notes route matters, and that does not change between notes. A
 * reload that answers with an equal task now keeps the one that is shown.
 */
import { useState } from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskPreview } from "../features/notes/common/hooks/useTaskPreview";
import type { UserProps } from "../types/admin";
import type { TaskProps } from "../types/tasks";

const loaded = vi.hoisted(() => ({
    calls: [] as Array<[number, number]>,
    answer: (p: number, t: number): unknown[] => [{ id: t, projectId: p, title: `Task ${t}` }],
}));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async (_me: unknown, projectId: number, taskId: number) => {
        loaded.calls.push([projectId, taskId]);
        return loaded.answer(projectId, taskId);
    }),
}));

const me = { teamId: "team-1", userId: "u1" } as UserProps;
const probe: {
    navigate: (to: string) => void;
    renders: number;
    shown: TaskProps | undefined;
} = { navigate: () => {}, renders: 0, shown: undefined };

const Probe = ({ note }: { note: { projectId: number; taskId: number } | null }) => {
    const [preview, setPreview] = useState<TaskProps | undefined>(undefined);
    const navigate = useNavigate();
    probe.navigate = (to) => void navigate(to);
    probe.renders += 1;
    probe.shown = preview;
    useTaskPreview({
        currentTaskNote: note,
        myself: me,
        accessToken: "tok",
        setCurrentPreviewTask: setPreview,
    });
    return null;
};
const mount = (path: string, note: { projectId: number; taskId: number } | null) => {
    const view = render(
        <MemoryRouter initialEntries={[path]}>
            <Probe note={note} />
        </MemoryRouter>
    );
    const set = (next: { projectId: number; taskId: number } | null) =>
        view.rerender(
            <MemoryRouter initialEntries={[path]}>
                <Probe note={next} />
            </MemoryRouter>
        );
    return { ...view, set };
};
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const go = (to: string) => act(async () => probe.navigate(to));

beforeEach(() => {
    loaded.calls.length = 0;
    loaded.answer = (p, t) => [{ id: t, projectId: p, title: `Task ${t}` }];
    probe.renders = 0;
    probe.shown = undefined;
});

describe("the task behind a task note", () => {
    it("is loaded once when a task note is open on a notes route", async () => {
        mount("/workspace/notes/task/5", { projectId: 1, taskId: 50 });
        await settle();
        expect(loaded.calls).toEqual([[1, 50]]);
        expect(probe.shown?.title).toBe("Task 50");
    });

    it("is NOT loaded again when the path moves to another note (the note switch)", async () => {
        mount("/workspace/notes/task/5", { projectId: 1, taskId: 50 });
        await settle();
        await go("/workspace/notes/task/6");
        await go("/workspace/notes/task/7");
        await settle();
        expect(loaded.calls).toHaveLength(1);
    });

    it("is loaded for the next note when the note changes", async () => {
        const view = mount("/workspace/notes/task/5", { projectId: 1, taskId: 50 });
        await settle();
        view.set({ projectId: 1, taskId: 60 });
        await settle();
        expect(loaded.calls).toEqual([
            [1, 50],
            [1, 60],
        ]);
        expect(probe.shown?.title).toBe("Task 60");
    });

    it("is not loaded away from the notes pages, and is loaded once the route settles on one", async () => {
        // The first note opened: the note is set a tick before the route reaches /workspace/notes.
        mount("/workspace/tasks", { projectId: 1, taskId: 50 });
        await settle();
        expect(loaded.calls).toHaveLength(0);
        await go("/workspace/notes/task/5");
        await settle();
        expect(loaded.calls).toEqual([[1, 50]]);
    });

    it("is not loaded when no task note is open", async () => {
        mount("/workspace/notes/my/3", null);
        await settle();
        expect(loaded.calls).toHaveLength(0);
    });
});

describe("a reload that answers with the task that is already shown", () => {
    it("keeps it, and nothing re-renders for it", async () => {
        const view = mount("/workspace/notes/task/5", { projectId: 1, taskId: 50 });
        await settle();
        const first = probe.shown;
        const rendersBefore = probe.renders;
        // Same task, asked again (a new note object, the same task), answered with a NEW object of equal content.
        view.set({ projectId: 1, taskId: 50 });
        await settle();
        expect(loaded.calls).toHaveLength(2);
        expect(probe.shown).toBe(first);
        // Re-rendered for the new `note` prop at most once; the answer itself caused no extra render.
        expect(probe.renders - rendersBefore).toBeLessThanOrEqual(1);
    });

    it("replaces it when the task really changed", async () => {
        const view = mount("/workspace/notes/task/5", { projectId: 1, taskId: 50 });
        await settle();
        const first = probe.shown;
        loaded.answer = (p, t) => [{ id: t, projectId: p, title: "Renamed" }];
        view.set({ projectId: 1, taskId: 50 });
        await settle();
        expect(probe.shown).not.toBe(first);
        expect(probe.shown?.title).toBe("Renamed");
    });
});
