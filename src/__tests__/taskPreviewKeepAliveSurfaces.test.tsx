/**
 * MIP-981: a task preview opened on the TASK page must not show up on the
 * CHAT page after navigating there.
 *
 * `useSurfaceTaskPreviewVisible` keeps the previous GLOBAL preview state in a
 * ref and adopts an "opened / switched" transition only while its surface is
 * the active route. It relied on the hidden (keep-alive) Chat Home still
 * re-rendering while the preview opened on the task page, so the ref stayed
 * current. MIP-959 (`FreezeWhenHidden`) and MIP-971 (`FreezeRouterWhenHidden`)
 * stopped exactly that: a hidden Home does not re-render, its ref still said
 * "closed" from before the user left, and the first render after coming back
 * (now active, global flag true) read as a fresh open.
 *
 * Earlier tests exercised the hook alone with hand-fed props, which cannot see
 * this. This file builds the real shape: the app's router, one shared
 * `useTM`-like state that lives ABOVE the screens (as `useTaskManagement` does
 * in `App`), and two keep-alive screens each wrapped in the real
 * `FreezeWhenHidden` and `FreezeRouterWhenHidden`. The chat screen runs the
 * real `useSurfaceTaskPreviewVisible` and `useTaskPreviewPaneVisible`.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FreezeRouterWhenHidden } from "../components/layout/FreezeRouterWhenHidden";
import { FreezeWhenHidden } from "../components/layout/FreezeWhenHidden";
import { useSurfaceTaskPreviewVisible } from "../hooks/tasks/useSurfaceTaskPreviewVisible";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { useTaskPreviewPaneVisible } from "../hooks/tasks/useTaskPreviewPaneVisible";

type FakeTM = TaskManagementState;

// A fresh object every render, like the real `useTaskManagement` return.
const useFakeTM = (): FakeTM => {
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState(-1);
    // The same counter `useTaskManagement` keeps above the screens.
    const [previewCloseCount, setPreviewCloseCount] = useState(0);
    const wasVisibleRef = useRef(false);
    useEffect(() => {
        if (wasVisibleRef.current && !isTaskPreviewVisible) setPreviewCloseCount((n) => n + 1);
        wasVisibleRef.current = isTaskPreviewVisible;
    }, [isTaskPreviewVisible]);
    // `useCM.isThreadTaskVisible`: the cross-page "open this thread's task in chat" intent.
    const [threadTaskIntent, setThreadTaskIntent] = useState(false);
    return {
        previewCloseCount,
        threadTaskIntent,
        setThreadTaskIntent,
        isTaskPreviewVisible,
        setIsTaskPreviewVisible,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        currentPreviewTask: undefined,
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
    } as unknown as FakeTM;
};

// Stands in for TaskHome: reads the router like the real one, and shows its
// preview from the global state (the task page keeps its own state in the
// route; here the global flag is what it reads).
const TasksHome = ({ useTM }: { useTM: FakeTM; isActiveRoute: boolean }) => {
    const tm = useTM as FakeTM & { setThreadTaskIntent: (v: boolean) => void };
    useLocation();
    const navigate = useNavigate();
    return (
        <div>
            <button
                data-testid="tasks-open"
                onClick={() => {
                    useTM.setIsTaskPreviewVisible(true);
                    useTM.setCurrentPreviewTaskId(5);
                    // The task page keeps its preview in the URL too.
                    navigate("/workspace/tasks/5");
                }}
            />
            {/* moveToSpecificChat: select the thread's task, raise the intent, go to chat. */}
            <button
                data-testid="tasks-intent"
                onClick={() => {
                    useTM.setCurrentPreviewTaskId(9);
                    tm.setThreadTaskIntent(true);
                }}
            />
            <button
                data-testid="tasks-close"
                onClick={() => {
                    useTM.setIsTaskPreviewVisible(false);
                    useTM.setCurrentPreviewTaskId(-1);
                    navigate("/workspace/tasks");
                }}
            />
            {useTM.isTaskPreviewVisible && useTM.currentPreviewTaskId !== -1 && (
                <div data-testid="tasks-preview">{`task ${useTM.currentPreviewTaskId}`}</div>
            )}
        </div>
    );
};

// Stands in for ChatHome: the real surface hooks, wired as chatHome.tsx wires
// them.
const ChatHome = ({ useTM, isActiveRoute }: { useTM: FakeTM; isActiveRoute: boolean }) => {
    useLocation();
    const [surfaceVisible, setSurfaceVisible] = useSurfaceTaskPreviewVisible(
        "chat",
        isActiveRoute,
        useTM
    );
    const tm = useTM as FakeTM & {
        threadTaskIntent: boolean;
        setThreadTaskIntent: (v: boolean) => void;
    };
    // Mirrors the consumer effect in chatHome.tsx, declared AFTER the surface
    // hook like there (the later setState wins within one commit).
    useEffect(() => {
        if (!tm.threadTaskIntent) return;
        useTM.setIsTaskPreviewVisible(true);
        setSurfaceVisible(true);
        tm.setThreadTaskIntent(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tm.threadTaskIntent]);
    const paneVisible = useTaskPreviewPaneVisible(
        surfaceVisible && useTM.isTaskPreviewVisible === true,
        useTM
    );
    return (
        <div>
            {/* The callers on the chat page (PM message card "Open Task",
                thread header, task chip) all do exactly this pair. */}
            <button
                data-testid="chat-open"
                onClick={() => {
                    useTM.setIsTaskPreviewVisible(true);
                    useTM.setCurrentPreviewTaskId(7);
                }}
            />
            <button data-testid="chat-switch" onClick={() => useTM.setCurrentPreviewTaskId(8)} />
            <button
                data-testid="chat-close"
                onClick={() => {
                    useTM.setIsTaskPreviewVisible(false);
                    useTM.setCurrentPreviewTaskId(-1);
                    setSurfaceVisible(false);
                }}
            />
            {paneVisible && (
                <div data-testid="chat-preview">{`task ${useTM.currentPreviewTaskId}`}</div>
            )}
            <span data-testid="chat-flag">{String(surfaceVisible)}</span>
        </div>
    );
};

const Frozen = ({ active, children }: { active: boolean; children: ReactNode }) => (
    <FreezeWhenHidden active={active}>
        <FreezeRouterWhenHidden active={active}>{children}</FreezeRouterWhenHidden>
    </FreezeWhenHidden>
);
const MemoOnly = ({ active, children }: { active: boolean; children: ReactNode }) => (
    <FreezeWhenHidden active={active}>{children}</FreezeWhenHidden>
);
const Plain = ({ children }: { active: boolean; children: ReactNode }) => <>{children}</>;

// Mirrors AppBody: shared task state above both screens, the active service
// derived from the URL, both screens kept mounted and hidden with display:none.
const makeBody = (Wrap: typeof Frozen) =>
    function Body() {
        const useTM = useFakeTM();
        const { pathname } = useLocation();
        const navigate = useNavigate();
        const active = pathname.includes("/chat") ? "chat" : "tasks";
        return (
            <div>
                <button data-testid="go-chat" onClick={() => navigate("/workspace/chat/dm")} />
                <button data-testid="go-tasks" onClick={() => navigate("/workspace/tasks")} />
                <div style={{ display: active === "tasks" ? "contents" : "none" }}>
                    <Wrap active={active === "tasks"}>
                        <TasksHome isActiveRoute={active === "tasks"} useTM={useTM} />
                    </Wrap>
                </div>
                <div style={{ display: active === "chat" ? "contents" : "none" }}>
                    <Wrap active={active === "chat"}>
                        <ChatHome isActiveRoute={active === "chat"} useTM={useTM} />
                    </Wrap>
                </div>
            </div>
        );
    };

const mount = (Wrap: typeof Frozen, start = "/workspace/tasks") => {
    const Body = makeBody(Wrap);
    return render(
        <MemoryRouter initialEntries={[start]}>
            <Routes>
                <Route element={<Body />} path="/workspace/*" />
            </Routes>
        </MemoryRouter>
    );
};

const click = (id: string) => act(() => void fireEvent.click(screen.getByTestId(id)));
const chatPreview = () => screen.queryByTestId("chat-preview");
const tasksPreview = () => screen.queryByTestId("tasks-preview");

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("task preview across the keep-alive task and chat screens (MIP-981)", () => {
    describe.each([
        ["with FreezeWhenHidden + FreezeRouterWhenHidden", Frozen],
        ["with FreezeWhenHidden only", MemoOnly],
        ["without the freeze (control)", Plain],
    ] as const)("%s", (_name, Wrap) => {
        it("a preview opened on the task page does NOT show on chat", () => {
            mount(Wrap);
            // Visit chat once so the screen exists and is hidden while the
            // user works on the task page, as in a real session.
            click("go-chat");
            click("go-tasks");

            click("tasks-open");
            expect(tasksPreview()).not.toBeNull();

            click("go-chat");
            expect(chatPreview()).toBeNull();
            expect(screen.getByTestId("chat-flag").textContent).toBe("false");
        });

        it("a preview opened on the task page does NOT show on chat when chat was first mounted before it", () => {
            // Chat is the initial screen, so it is mounted and active first.
            mount(Wrap, "/workspace/chat/dm");
            click("go-tasks");
            click("tasks-open");
            click("go-chat");
            expect(chatPreview()).toBeNull();
        });

        it("a task SWITCHED on the task page while a preview is open does not show on chat either", () => {
            mount(Wrap);
            click("go-chat");
            click("go-tasks");
            click("tasks-open");
            click("go-chat");
            click("go-tasks");
            // switch to another task on the task page
            act(() => void fireEvent.click(screen.getByTestId("tasks-open")));
            click("go-chat");
            expect(chatPreview()).toBeNull();
        });

        it("a preview opened INSIDE chat shows there", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            expect(chatPreview()?.textContent).toBe("task 7");
        });

        it("switching task inside chat while visible keeps it visible", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            click("chat-switch");
            expect(chatPreview()?.textContent).toBe("task 8");
        });

        it("a preview opened in chat, then closed on the task page, is closed on chat", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            click("go-tasks");
            click("tasks-close");
            click("go-chat");
            expect(chatPreview()).toBeNull();
        });

        it("closing in chat closes it", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            click("chat-close");
            expect(chatPreview()).toBeNull();
        });

        it("a preview opened in chat, after a visit to the task page, is still adopted", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("go-tasks");
            click("tasks-open");
            click("go-chat");
            expect(chatPreview()).toBeNull();
            // now open one from chat itself
            click("chat-open");
            expect(chatPreview()?.textContent).toBe("task 7");
        });

        it("opened in chat earlier, then closed and reopened on the task page, does not show on chat", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            click("go-tasks");
            click("tasks-close");
            click("tasks-open");
            click("go-chat");
            expect(chatPreview()).toBeNull();
        });

        it("the cross-page 'open this thread's task in chat' intent shows on chat", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("go-tasks");
            click("tasks-intent");
            click("go-chat");
            expect(chatPreview()?.textContent).toBe("task 9");
        });

        it("the intent still shows on chat after an earlier open, close and reopen", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            click("go-tasks");
            click("tasks-close");
            click("tasks-open");
            click("tasks-intent");
            click("go-chat");
            expect(chatPreview()?.textContent).toBe("task 9");
        });

        it("coming back to the task page keeps its preview", () => {
            mount(Wrap);
            click("tasks-open");
            click("go-chat");
            click("go-tasks");
            expect(tasksPreview()?.textContent).toBe("task 5");
        });

        it("the chat surface flag is persisted per surface when adopted in chat", () => {
            mount(Wrap, "/workspace/chat/dm");
            click("chat-open");
            expect(localStorage.getItem("taskPreviewVisible:chat")).toBe("true");
            click("chat-close");
            expect(localStorage.getItem("taskPreviewVisible:chat")).toBe("false");
        });
    });
});
