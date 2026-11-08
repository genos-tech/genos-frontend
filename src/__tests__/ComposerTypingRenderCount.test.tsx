/**
 * Typing render budget of every chat-style composer (MIP-1161).
 *
 * The composers are mounted under a `<Profiler>` and the number of commits their subtree makes is
 * counted while the user types. The rule (see the typing-perf notes in the MIP-904 series and
 * `useEditorDraft`): no per-keystroke React state above the editor, the draft is persisted on a
 * debounce, nothing in the composer re-renders per keystroke. The only legitimate re-render in
 * the typing path is the one that flips the Send button when the composer goes from empty to
 * non-empty.
 *
 * The numbers were measured on the code BEFORE the shared hook existed (origin/main 5a370edf);
 * this test fails if the converged code is worse.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BnChatEditor } from "../components/editors/bnChatEditor";
import { BnTaskCommentEditor } from "../components/editors/bnTaskCommentEditor";
import { BnThreadEditor } from "../components/editors/bnThreadEditor";
import { BnUpdateEditor } from "../components/editors/bnUpdateEditor";
import { BnUpdateTaskCommentEditor } from "../components/editors/bnUpdateTaskCommentEditor";
import { BnUpdateThreadEditor } from "../components/editors/bnUpdateThreadEditor";
import { MessageComposerV3 } from "../features/channel/components/MessageComposerV3";
import { harness, lastEditor, para } from "./helpers_composerHarness";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.mock("@mui/joy/styles", async (original) => ({
    ...(await original<typeof import("@mui/joy/styles")>()),
    useColorScheme: () => ({ mode: "light" }),
}));
vi.mock("@blocknote/mantine", async () =>
    (await import("./helpers_composerHarness")).blockNoteMantineMock()
);
vi.mock("../components/editors/genos/useGenosEditor", async () =>
    (await import("./helpers_composerHarness")).useGenosEditorMock()
);
vi.mock("../components/editors/genos/genosSchema", async (original) => ({
    ...(await original<typeof import("../components/editors/genos/genosSchema")>()),
    useGenosSchema: () => ({}),
}));
vi.mock("@blocknote/react", async (original) => ({
    ...(await original<typeof import("@blocknote/react")>()),
    SuggestionMenuController: () => null,
}));
vi.mock("../components/editors/HashMention", async (original) => ({
    ...(await original<typeof import("../components/editors/HashMention")>()),
    HashSuggestionMenuController: () => null,
}));
vi.mock("../components/editors/genos/GenosSuggestionMenus", () => ({
    GenosSuggestionMenus: () => null,
}));
vi.mock("../components/editors/genos/GenosToolbars", async () =>
    (await import("./helpers_composerHarness")).genosToolbarsMock()
);
vi.mock("../components/editors/blockNoteI18n", () => ({ useBlockNoteDictionary: () => ({}) }));
vi.mock("../components/editors/sub/EditorSendButton", async () =>
    (await import("./helpers_composerHarness")).sendButtonMock()
);
vi.mock("../components/ui/feedback/FileUploadProgress", async () =>
    (await import("./helpers_composerHarness")).uploadChromeMock()
);
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/gif/GifPicker", () => ({ GifPicker: () => null }));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../context/MentionGroupsContext", () => ({
    useMentionGroupsContext: () => ({ mentionGroups: [] }),
}));
vi.mock("../hooks/common/UrlLinkModalContext", () => ({ useUrlLinkModal: () => null }));
vi.mock("../hooks/common/useAnchorClickIntercept", () => ({ useAnchorClickIntercept: () => {} }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: vi.fn(async () => 1024),
    invalidateUploadLimit: vi.fn(),
}));
vi.mock("../features/chat/services/sendChatMessage", () => ({ sendChatMessage: vi.fn() }));
vi.mock("../features/tasks/services/taskEvents", () => ({ emitTaskTouched: vi.fn() }));
vi.mock("../services/requestErrorNotifier", () => ({
    emitRequestError: vi.fn(),
    notifyActionError: vi.fn(),
}));

const myself = { userId: "u1", userName: "Me", userEmail: "me@x.io" } as any;
const common = {
    myself,
    setMyself: vi.fn(),
    useTEM: { teamMembers: [], teamMemberProfiles: [] },
    useUISM: {},
    useCM: { isSubChatVisible: false },
    socket: { emit: vi.fn() },
    numEditorLines: 1,
    setNumEditorLines: vi.fn(),
};
const stored = [para("original"), para("")];
const chatMessage = { content: stored, messageIdWithChatId: "c:1" } as any;
const threadMessage = {
    content: stored,
    chatId: "c",
    messageIdWithChatIdAndThreadId: "c:t:1",
} as any;
const comment = { commentId: 1, commentBody: stored } as any;
const task = { id: 1, displayId: "P-1", project: { projectId: 1, projectName: "P" } } as any;

const composers: Record<string, () => JSX.Element> = {
    BnChatEditor: () => (
        <BnChatEditor
            {...(common as any)}
            chat={{ chatId: "c", chatType: 1 } as any}
            setCurrentChat={vi.fn()}
        />
    ),
    BnThreadEditor: () => (
        <BnThreadEditor
            {...(common as any)}
            setCurrentChat={vi.fn()}
            setCurrentThreadChat={vi.fn()}
            thread={{ chatId: "c", chatType: 1, threadId: "t" } as any}
        />
    ),
    BnTaskCommentEditor: () => (
        <BnTaskCommentEditor
            {...(common as any)}
            setTaskCommentLines={vi.fn()}
            setTaskComments={vi.fn()}
            task={task}
            taskCommentLines={0}
            taskComments={[]}
            uploadChannelId="pm"
            useTM={{ setIsTaskCommentUpdated: vi.fn() } as any}
        />
    ),
    BnUpdateEditor: () => (
        <BnUpdateEditor
            {...(common as any)}
            chat={{ chatId: "c" } as any}
            message={chatMessage}
            setIsInEdit={vi.fn()}
            socket={null}
            isInEdit
        />
    ),
    BnUpdateThreadEditor: () => (
        <BnUpdateThreadEditor
            {...(common as any)}
            message={threadMessage}
            setCurrentChat={vi.fn()}
            setIsInEdit={vi.fn()}
            thread={{ chatId: "c", threadId: "t" } as any}
            isInEdit
        />
    ),
    BnUpdateTaskCommentEditor: () => (
        <BnUpdateTaskCommentEditor
            {...(common as any)}
            setIsInEdit={vi.fn()}
            setTaskCommentLines={vi.fn()}
            targetComment={comment}
            taskCommentLines={0}
            taskId={1}
            useTM={{ setIsTaskCommentUpdated: vi.fn() } as any}
            isInEdit
        />
    ),
    MessageComposerV3: () => <MessageComposerV3 channelId="c-1" currentUserId="u1" />,
};

beforeEach(() => {
    harness.reset();
    localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

const keystrokes = (n: number) =>
    Array.from({ length: n }, (_, i) => "word ".repeat(1 + i / 5).slice(0, i + 1));

describe.each(Object.entries(composers))("%s typing render budget", (name, build) => {
    const mountProfiled = async () => {
        let commits = 0;
        render(
            <Profiler id={name} onRender={() => (commits += 1)}>
                {build()}
            </Profiler>
        );
        // The upload-tier lookup resolves a tick after mount and re-renders once: not typing.
        await act(async () => {
            for (let i = 0; i < 8; i += 1) await Promise.resolve();
        });
        return () => commits;
    };
    const typeAll = (texts: string[]) =>
        texts.forEach((text) => act(() => lastEditor().type(text)));

    it("zero re-renders for every keystroke after the Send state has settled", async () => {
        const commits = await mountProfiled();
        // The edit composers open non-empty (Send already enabled), the others flip on the first
        // character. React renders a component once more for the first same-value `setState`
        // after a real update before it bails out (it cannot bail eagerly while the alternate
        // fiber still carries the earlier lane), so settle with two characters, then count.
        typeAll(["x", "xy"]);
        const settled = commits();
        typeAll(keystrokes(60));
        expect(commits() - settled).toBe(0);
    });

    it("the first character costs at most one re-render (the Send flip)", async () => {
        const commits = await mountProfiled();
        const before = commits();
        typeAll(["x"]);
        expect(commits() - before).toBeLessThanOrEqual(1);
    });
});
