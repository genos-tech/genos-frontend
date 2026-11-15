/**
 * MIP-1573 / MIP-1571: the notification cards in the chat sidebar's Activity feed show
 * the Claude / ChatGPT round mark when the API says the change came through that app.
 *
 * Pinned here: the adapter carries only the two exact family strings (a spoof, a number
 * or an object is dropped, so the card is today's card), the card header and the
 * "your AI app did X" row show the mark and nothing else changes without it, and no name
 * (the app's, the connection's, the client's) is reachable from the DOM or the aria text.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { ActivityHeader } from "../features/chat/components/sidebar/activity/ActivityHeader";
import { AiAppActivityRow } from "../features/chat/components/sidebar/activity/AiAppActivityRow";
import { parseAiAppNotice } from "../features/chat/utils/aiAppNotice";
import type { ActivityMessageProps } from "../types/chat";

vi.mock("../features/chat/components/sidebar/activity/ActivityAvatar", () => ({
    ActivityAvatar: () => <span data-testid="avatar" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: vi.fn() }),
}));

afterEach(cleanup);

const myself = {
    userId: "me",
    userName: "Me",
    userEmail: "me@test",
    avatarImgPath: "",
    teamId: "t1",
    teamName: "T",
    tsLastSeen: "",
    tsJoined: "",
} as never;

const baseMessage = {
    id: "m1",
    channelId: "c1",
    channelKind: 3,
    sender: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
    isThreadReply: false,
    bodyText: "hello @Me",
};

/** A channel-backed mention card, as `GET /api/v3/activities/` sends it. */
const mentionWire = (meta: Record<string, unknown> | undefined) =>
    ({
        id: "act-1",
        activityType: 3,
        recipientUserId: "me",
        teamId: "t1",
        channelId: "c1",
        channelKind: 3,
        messageId: "m1",
        actor: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
        message: baseMessage,
        ...(meta === undefined ? {} : { meta }),
        isRead: false,
        tsCreated: "2026-11-14T10:00:00Z",
    }) as never;

/** A channel-less surface card (task body / comment), same wire. */
const surfaceWire = (meta: Record<string, unknown>, over: Record<string, unknown> = {}) =>
    ({
        id: "act-2",
        activityType: 3,
        surfaceType: 5,
        recipientUserId: "me",
        teamId: "t1",
        channelId: null,
        channelKind: null,
        messageId: null,
        actor: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
        message: null,
        meta: { projectName: "P", projectId: 1, taskId: 3, ...meta },
        isRead: false,
        tsCreated: "2026-11-14T10:00:00Z",
        ...over,
    }) as never;

const CLAUDE = { kind: "oauth", app: "claude" };
const CHATGPT = { kind: "oauth", app: "chatgpt" };

describe("adapter: meta.via -> viaApp", () => {
    it("carries claude and chatgpt on a channel-backed card and on a surface card", () => {
        expect(v3ActivityToLegacy(mentionWire({ via: CLAUDE }), myself).viaApp).toBe("claude");
        expect(v3ActivityToLegacy(mentionWire({ via: CHATGPT }), myself).viaApp).toBe("chatgpt");
        expect(v3ActivityToLegacy(surfaceWire({ via: CLAUDE }), myself).viaApp).toBe("claude");
        expect(
            v3ActivityToLegacy(surfaceWire({ via: CHATGPT, isComment: true }), myself).viaApp
        ).toBe("chatgpt");
    });

    it("stores nothing else of the via: no name, connection or client", () => {
        const row = v3ActivityToLegacy(
            mentionWire({
                via: {
                    ...CLAUDE,
                    connection_id: "conn-9f3a",
                    client_name: "Ken's private app",
                    key_name: "my key",
                },
            }),
            myself
        );
        const stored = JSON.stringify(row);
        expect(row.viaApp).toBe("claude");
        for (const secret of ["conn-9f3a", "Ken's private app", "my key", "connection_id"]) {
            expect(stored).not.toContain(secret);
        }
    });

    it("absent, or an app-less oauth via: no field at all (the stored row is unchanged)", () => {
        for (const meta of [undefined, {}, { via: { kind: "oauth" } }, { via: null }]) {
            const row = v3ActivityToLegacy(mentionWire(meta as never), myself);
            expect("viaApp" in row).toBe(false);
        }
        expect("viaApp" in v3ActivityToLegacy(surfaceWire({}), myself)).toBe(false);
        expect(
            "viaApp" in v3ActivityToLegacy(surfaceWire({ via: { kind: "oauth" } }), myself)
        ).toBe(false);
    });

    it("ignores spoofs: lookalike strings, other cases, numbers, objects, arrays", () => {
        const spoofs: unknown[] = [
            "Claude",
            "CLAUDE",
            "Claude ",
            " claude",
            "claude\n",
            "claude-evil",
            "chatgpt ",
            "ChatGPT",
            "openai",
            "",
            1,
            0,
            true,
            ["claude"],
            { name: "claude" },
            { toString: () => "claude" },
            null,
        ];
        for (const app of spoofs) {
            expect(
                "viaApp" in
                    v3ActivityToLegacy(mentionWire({ via: { kind: "oauth", app } }), myself),
                `app ${JSON.stringify(app)}`
            ).toBe(false);
        }
    });

    it("only a connected app counts: an api_key, in-app or unknown kind names no family", () => {
        for (const kind of ["api_key", "app", "agent", "other", 7, undefined]) {
            const row = v3ActivityToLegacy(mentionWire({ via: { kind, app: "claude" } }), myself);
            expect("viaApp" in row).toBe(false);
        }
        // a bare string `via` is not an object
        expect(
            "viaApp" in v3ActivityToLegacy(mentionWire({ via: "claude" as never }), myself)
        ).toBe(false);
    });

    it("the AI-app notice row (surface 10) is untouched by meta.via", () => {
        const row = v3ActivityToLegacy(
            surfaceWire(
                { aiApp: true, app: "My app", verb: "created", via: CLAUDE },
                {
                    surfaceType: 10,
                    activityType: 6,
                }
            ),
            myself
        );
        expect("viaApp" in row).toBe(false);
    });
});

describe("parseAiAppNotice: meta.appFamily", () => {
    it("reads exactly claude and chatgpt", () => {
        expect(parseAiAppNotice({ app: "x", appFamily: "claude" }).appFamily).toBe("claude");
        expect(parseAiAppNotice({ app: "x", appFamily: "chatgpt" }).appFamily).toBe("chatgpt");
    });

    it("absent or anything else: no field", () => {
        for (const appFamily of [
            undefined,
            null,
            "Claude",
            "Claude ",
            "claude-evil",
            "CHATGPT",
            "",
            2,
            {},
            ["claude"],
        ]) {
            expect(
                "appFamily" in parseAiAppNotice({ app: "x", appFamily }),
                String(appFamily)
            ).toBe(false);
        }
        expect("appFamily" in parseAiAppNotice({ app: "x" })).toBe(false);
    });

    it("the adapter hands it on with the notice", () => {
        const row = v3ActivityToLegacy(
            surfaceWire(
                {
                    aiApp: true,
                    app: "My app",
                    verb: "created",
                    kind: "task",
                    appFamily: "chatgpt",
                },
                { surfaceType: 10, activityType: 6 }
            ),
            myself
        );
        expect(row.aiApp?.appFamily).toBe("chatgpt");
    });
});

const header = (activity: ActivityMessageProps) =>
    render(
        <CssVarsProvider>
            <ActivityHeader
                activity={activity}
                chatTypeLookup={{ 3: "PM" }}
                isYou={false}
                myself={myself}
                setMyself={vi.fn()}
                socket={null}
                useCM={{ allChats: [] } as never}
                useTEM={{} as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("Activity card header", () => {
    it("shows the Claude mark when the row carries claude", () => {
        header(v3ActivityToLegacy(mentionWire({ via: CLAUDE }), myself));
        expect(screen.getByRole("img", { name: "via Claude" })).toHaveAttribute(
            "data-via-app",
            "claude"
        );
        expect(screen.queryByText("via MCP")).toBeNull();
    });

    it("shows the ChatGPT mark when the row carries chatgpt", () => {
        header(v3ActivityToLegacy(surfaceWire({ via: CHATGPT }), myself));
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toHaveAttribute(
            "data-via-app",
            "chatgpt"
        );
    });

    it("shows nothing extra for absent, app-less oauth and spoofed families", () => {
        for (const meta of [
            undefined,
            { via: { kind: "oauth" } },
            { via: { kind: "oauth", app: "Claude " } },
            { via: { kind: "oauth", app: "claude-evil" } },
            { via: { kind: "oauth", app: 7 } },
            { via: { kind: "oauth", app: { a: 1 } } },
        ]) {
            const { container, unmount } = header(
                v3ActivityToLegacy(mentionWire(meta as never), myself)
            );
            expect(container.querySelector("[data-via-app]")).toBeNull();
            expect(container.querySelector("[data-via]")).toBeNull();
            expect(screen.queryByRole("img")).toBeNull();
            expect(screen.queryByText("via MCP")).toBeNull();
            unmount();
        }
    });

    it("a row stored with a hand-edited family still shows no mark", () => {
        const row = {
            ...v3ActivityToLegacy(mentionWire(undefined), myself),
            viaApp: "claude-evil",
        } as unknown as ActivityMessageProps;
        const { container } = header(row);
        expect(container.querySelector("[data-via-app]")).toBeNull();
    });

    it("leaks no name into the DOM or the accessible text", () => {
        const { container } = header(
            v3ActivityToLegacy(
                mentionWire({
                    via: {
                        ...CLAUDE,
                        connection_id: "conn-9f3a",
                        client_name: "Ken's private app",
                    },
                }),
                myself
            )
        );
        const html = container.innerHTML;
        for (const secret of ["conn-9f3a", "Ken's private app", "client_name"]) {
            expect(html).not.toContain(secret);
        }
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
    });
});

const noticeRow = (meta: Record<string, unknown>) => {
    const activity = v3ActivityToLegacy(
        surfaceWire(
            { aiApp: true, app: "Ken's Claude Code", verb: "created", kind: "task", ...meta },
            { surfaceType: 10, activityType: 6 }
        ),
        myself
    );
    return render(
        <CssVarsProvider>
            <MemoryRouter>
                <AiAppActivityRow
                    activity={activity}
                    activityMessages={[activity]}
                    myself={myself}
                    selectedActivityId=""
                    setSelectedActivityId={vi.fn()}
                    useCM={{} as never}
                />
            </MemoryRouter>
        </CssVarsProvider>
    );
};

describe("AiAppActivityRow", () => {
    it("shows the family mark in the robot slot, labelled by family only", () => {
        const { container } = noticeRow({ appFamily: "claude" });
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(container.querySelector('[data-testid="SmartToyRoundedIcon"]')).toBeNull();
        // The member's own name for the app still leads the row, as today.
        expect(screen.getByText("Ken's Claude Code")).toBeInTheDocument();
    });

    it("shows the ChatGPT mark for chatgpt", () => {
        noticeRow({ appFamily: "chatgpt" });
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
    });

    it("keeps the robot icon without a family, or with a spoofed one", () => {
        for (const appFamily of [undefined, "Claude ", "claude-evil", 5, { a: 1 }]) {
            const { container, unmount } = noticeRow({ appFamily });
            expect(container.querySelector('[data-testid="SmartToyRoundedIcon"]')).not.toBeNull();
            expect(container.querySelector("[data-via-app]")).toBeNull();
            expect(screen.queryByRole("img")).toBeNull();
            unmount();
        }
    });

    it("the app's name never reaches the mark's label", () => {
        noticeRow({ appFamily: "claude" });
        const mark = screen.getByRole("img", { name: "via Claude" });
        expect(mark.getAttribute("aria-label")).not.toContain("Ken");
        expect(mark.innerHTML).not.toContain("Ken");
    });
});
