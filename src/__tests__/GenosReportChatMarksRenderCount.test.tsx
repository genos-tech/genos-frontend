/**
 * MIP-1333: the chat avatars cost the Inbox nothing it did not already pay.
 *
 * Same budget as the project pictures (`GenosReportRenderCount`): the chat list is replaced on
 * almost every message, so the card is drawn again only when an avatar it shows really changed,
 * and a report with no chat line never scans the chats.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosReportBody } from "../features/inbox/components/GenosReportBody";
import { reportChatMarkMap } from "../features/inbox/utils/reportChatMarks";

const rows = vi.hoisted(() => ({ renders: 0 }));

vi.mock("../features/inbox/utils/reportChatMarks", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/inbox/utils/reportChatMarks")>();
    return { ...actual, reportChatMarkMap: vi.fn(actual.reportChatMarkMap) };
});
vi.mock("../features/tasks/components/meta/StatusLabel", () => ({
    StatusLabel: ({ status }: { status: string }) => {
        rows.renders += 1;
        return <span>{status}</span>;
    },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const GM = "11111111-1111-4111-8111-111111111111";

// One task line (counts renders through the status label) beside one chat line.
const withChat = {
    version: 2,
    sections: [
        {
            heading: "h",
            key: "overdue",
            items: [
                { text: "t", kind: "task", display_id: "T-1", title: "t", status: "Open" },
                {
                    text: "Design crew: 2 messages",
                    kind: "chat",
                    link: `/workspace/chat/gm/${GM}`,
                },
            ],
        },
    ],
};
const withoutChat = {
    version: 2,
    sections: [
        {
            heading: "h",
            key: "overdue",
            items: [{ text: "t", kind: "task", display_id: "T-1", title: "t", status: "Open" }],
        },
    ],
};

const gm = (over: Record<string, unknown> = {}) => ({
    chatType: 2,
    chatId: GM,
    chatName: "Design crew",
    ...over,
});
const unrelated = (n: number) => ({ chatType: 2, chatId: `other-${n}`, chatName: `Other ${n}` });

const tree = (itemBody: unknown, allChats: unknown[]) => (
    <CssVarsProvider>
        <MemoryRouter>
            <GenosReportBody allChats={allChats as never} itemBody={itemBody} />
        </MemoryRouter>
    </CssVarsProvider>
);

describe("chat avatars: render budget", () => {
    beforeEach(() => {
        rows.renders = 0;
        vi.mocked(reportChatMarkMap).mockClear();
    });

    it("a report with no chat line never scans the chats", () => {
        const { rerender } = render(tree(withoutChat, [gm()]));
        rerender(tree(withoutChat, [gm(), unrelated(1)]));
        expect(reportChatMarkMap).not.toHaveBeenCalled();
    });

    it("does not draw the card again when only an unrelated chat changed", () => {
        const body = withChat;
        const { rerender } = render(
            tree(body, [gm({ profileImagePath: "https://m.example/a.png" })])
        );
        expect(rows.renders).toBe(1);
        // A message arrives in some other chat: a new list, the report's chat unchanged.
        for (let i = 1; i <= 4; i += 1) {
            rerender(
                tree(body, [
                    gm({
                        profileImagePath: "https://m.example/a.png",
                        latestMessageText: `m${i}`,
                    }),
                    unrelated(i),
                ])
            );
        }
        expect(rows.renders).toBe(1);
    });

    it("draws the card again when the chat's picture really changed", () => {
        const body = withChat;
        const { rerender } = render(
            tree(body, [gm({ profileImagePath: "https://m.example/a.png" })])
        );
        expect(rows.renders).toBe(1);
        rerender(tree(body, [gm({ profileImagePath: "https://m.example/b.png" })]));
        expect(rows.renders).toBe(2);
    });
});
