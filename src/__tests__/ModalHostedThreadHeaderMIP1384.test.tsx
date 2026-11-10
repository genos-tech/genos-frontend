/**
 * MIP-1384: a thread opened in the preview dialog (UrlLinkModal) must not drive the PAGE behind
 * it. "Open Task" (menu row and task pill) re-targets the dialog to the task, like the task
 * preview's "Check thread" does the other way; "Thread note" and "Thread task" have no dialog
 * target, so they are not offered while hosted. On the page nothing changes.
 *
 * Rendered for real: the thread header is mounted with and without `hostZIndex` (the prop
 * UrlLinkModal -> ModalChatView -> ThreadPane passes), at the phone layout and the desktop one.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThreadChatPaneHeader } from "../features/chat/components/headers/ThreadChatPaneHeader";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

const mobile = vi.hoisted(() => ({ value: true }));
const thread = vi.hoisted(() => ({ taskId: 42 }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("../i18n", async () => {
    const { en } = await import("../i18n/locales/en");
    return { useTranslation: () => ({ t: en }) };
});
vi.mock("../features/chat/context/ChatContext", () => ({
    useChatContext: () => ({
        currentThreadTaskId: thread.taskId,
        usePM: { currentProject: null, setCurrentProject: vi.fn() },
    }),
}));
vi.mock("../features/threadAsk/useThreadAsk", () => ({
    useThreadAsk: () => ({ open: vi.fn() }),
}));
vi.mock("../features/threadAsk/ThreadAskModal", () => ({ ThreadAskModal: () => null }));
vi.mock("../services/notifications/MuteTargetButton", () => ({
    MuteTargetButton: () => null,
}));
vi.mock("../components/ui/avatars/AvatarContext", () => ({
    useResolvedUserName: (_id: unknown, fallback: string) => fallback,
}));
vi.mock("../features/chat/components/shared/ExternalChatChip", () => ({
    ExternalChatChip: () => null,
}));
vi.mock("../features/tasks/components/TaskInfoPill", () => ({
    TaskInfoPill: ({ onOpen }: { onOpen: () => void }) => (
        <button onClick={onOpen}>task pill</button>
    ),
}));

const openModalByHref = vi.fn(() => "opened" as const);
beforeEach(() => {
    vi.clearAllMocks();
    thread.taskId = 42;
});
afterEach(cleanup);

const renderHeader = ({
    hosted,
    chatType = 1,
    withModalContext = true,
}: {
    hosted: boolean;
    chatType?: number;
    withModalContext?: boolean;
}) => {
    const useCM = {
        allChats: [],
        currentThreadChat: {
            chatId: "c1",
            chatName: "Partner",
            chatType,
            dmPartnerUser: { userId: "other" },
            messages: [],
            project: { projectId: "p9" },
            threadId: "t1",
        },
        setCurrentThreadChat: vi.fn(),
        setIsMainChatVisible: vi.fn(),
        setIsThreadVisible: vi.fn(),
    };
    const useTM = {
        setCurrentPreviewTaskId: vi.fn(),
        setIsCreatingTask: vi.fn(),
        setIsTaskPreviewVisible: vi.fn(),
    };
    const header = (
        <CssVarsProvider>
            <ThreadChatPaneHeader
                hostZIndex={hosted ? 10020 : undefined}
                myself={{ userId: "me" } as never}
                threadTaskMeta={
                    thread.taskId === -1
                        ? null
                        : ({ id: "42", project: { projectId: "p9" } } as never)
                }
                useCM={useCM as never}
                useNM={{ chatPanelApi: { openOrCreate: vi.fn() } } as never}
                useTM={useTM as never}
            />
        </CssVarsProvider>
    );
    render(
        withModalContext ? (
            <UrlLinkModalProvider value={{ openModalByHref }}>{header}</UrlLinkModalProvider>
        ) : (
            header
        )
    );
    return { useCM, useTM };
};

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /more options/i }));

describe("the phone thread header menu", () => {
    beforeEach(() => {
        mobile.value = true;
    });

    it("on the page: Open task drives the page, Thread note is offered", () => {
        const { useTM } = renderHeader({ hosted: false });
        openMenu();
        expect(screen.getByText("Thread note")).toBeTruthy();
        fireEvent.click(screen.getByText("Open Task"));
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        expect(openModalByHref).not.toHaveBeenCalled();
    });

    it("in the dialog: Open task re-targets the dialog, the page state is untouched", () => {
        const { useCM, useTM } = renderHeader({ hosted: true });
        openMenu();
        fireEvent.click(screen.getByText("Open Task"));
        expect(openModalByHref).toHaveBeenCalledWith("/workspace/tasks/project/p9/task/42");
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
        expect(useCM.setIsMainChatVisible).not.toHaveBeenCalled();
    });

    it("in the dialog: Thread note is not offered", () => {
        renderHeader({ hosted: true });
        openMenu();
        expect(screen.queryByText("Thread note")).toBeNull();
        expect(screen.getByText("Open Task")).toBeTruthy();
    });

    it("in the dialog without a modal provider: Open task is not offered (no dead row)", () => {
        renderHeader({ hosted: true, withModalContext: false });
        openMenu();
        expect(screen.queryByText("Open Task")).toBeNull();
    });
});

describe("the desktop thread header", () => {
    beforeEach(() => {
        mobile.value = false;
    });

    it("on the page: the task pill drives the page, Thread note is in the menu", () => {
        const { useTM } = renderHeader({ hosted: false });
        fireEvent.click(screen.getByText("task pill"));
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        openMenu();
        expect(screen.getByText("Thread note")).toBeTruthy();
    });

    it("in the dialog: the task pill re-targets the dialog, Thread note is gone", () => {
        const { useTM } = renderHeader({ hosted: true });
        fireEvent.click(screen.getByText("task pill"));
        expect(openModalByHref).toHaveBeenCalledWith("/workspace/tasks/project/p9/task/42");
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
        openMenu();
        expect(screen.queryByText("Thread note")).toBeNull();
        expect(screen.getByText(/copy thread link|copy link/i)).toBeTruthy();
    });
});

describe("Create task from a thread that has no task yet", () => {
    // A page panel (it sets the page's create-task state): offered on the page, not in the dialog.
    it.each([
        ["phone", true],
        ["desktop", false],
    ])("%s: offered on the page, not in the dialog", (_name, isPhone) => {
        mobile.value = isPhone;
        thread.taskId = -1;
        renderHeader({ hosted: false });
        openMenu();
        expect(screen.getByText("Thread task")).toBeTruthy();
        cleanup();
        renderHeader({ hosted: true });
        openMenu();
        expect(screen.queryByText("Thread task")).toBeNull();
    });
});
