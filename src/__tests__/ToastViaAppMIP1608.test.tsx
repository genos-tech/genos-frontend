/**
 * MIP-1608: the in-app toast for a change an official AI app made shows that app's round
 * mark in place of the avatar, instead of an initial ("C") drawn from the title.
 *
 * Driven from the wire end: a raw `activity.created` payload -> `v3ActivityToLegacy` ->
 * `buildActivityIntent` -> `NotificationToastHost`, so a trimmed object that dropped `meta`
 * on the way would fail here. Pinned: both the AI-app notice (`meta.appFamily`) and the
 * mention / comment cards (`meta.via.app`) earn the mark; a spoof ("Claude ", "claude-evil",
 * a number, an object) and an absent family earn nothing and the old avatar stays; the
 * toast text never changes; and no name or connection id reaches the DOM.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { buildActivityIntent } from "../services/notifications/notificationRouter";
import { NotificationToastHost } from "../services/notifications/NotificationToastHost";
import type { NotificationIntent } from "../services/notifications/types";

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
const useTEM = { teamMemberProfiles: {}, currentTeam: null } as never;
const useCM = { allChats: [] } as never;

const NOTICE_META = {
    aiApp: true,
    app: "Claude Code",
    verb: "created",
    kind: "task",
    count: 1,
    items: [{ kind: "task", id: 7, displayId: "QR-7", title: "Fix login", taskId: 7 }],
    url: "/workspace/tasks/project/1/task/7",
    projectId: 1,
    taskId: 7,
};

/** What the API sends for "your AI app did X" (surface 10). */
const noticeWire = (extra: Record<string, unknown> = {}) =>
    ({
        id: "act-1",
        activityType: 6,
        surfaceType: 10,
        recipientUserId: "me",
        teamId: "t1",
        channelId: null,
        channelKind: null,
        messageId: null,
        actor: { userId: "me", userName: "Me", userEmail: "me@test" },
        message: null,
        meta: { ...NOTICE_META, ...extra },
        isRead: false,
        tsCreated: "2026-11-15T10:00:00Z",
    }) as never;

/** A channel-less comment card on a task body, a colleague's, for me. */
const commentWire = (extra: Record<string, unknown> = {}) =>
    ({
        id: "act-2",
        activityType: 1,
        surfaceType: 5,
        recipientUserId: "me",
        teamId: "t1",
        channelId: null,
        channelKind: null,
        messageId: null,
        actor: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
        message: null,
        meta: {
            projectName: "Apollo",
            projectId: 1,
            taskId: 3,
            isComment: true,
            firstLineContent: "Looks good to me",
            ...extra,
        },
        isRead: false,
        tsCreated: "2026-11-15T10:00:00Z",
    }) as never;

/** A channel-backed mention card. */
const mentionWire = (extra: Record<string, unknown> = {}) =>
    ({
        id: "act-3",
        activityType: 3,
        recipientUserId: "me",
        teamId: "t1",
        channelId: "c1",
        channelKind: 3,
        messageId: "m1",
        actor: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
        message: {
            id: "m1",
            channelId: "c1",
            channelKind: 3,
            sender: { userId: "u9", userName: "Ada", userEmail: "ada@test" },
            isThreadReply: false,
            bodyText: "hello @Me",
        },
        meta: { ...extra },
        isRead: false,
        tsCreated: "2026-11-15T10:00:00Z",
    }) as never;

const intentOf = (wire: never): NotificationIntent => {
    const intent = buildActivityIntent(v3ActivityToLegacy(wire, myself), myself, useTEM, useCM);
    expect(intent).not.toBeNull();
    return intent as NotificationIntent;
};

/** Mount the host and push one intent through the same subscription the manager uses. */
const showToast = (intent: NotificationIntent) => {
    let push: (i: NotificationIntent) => void = () => {};
    const view = render(
        <CssVarsProvider>
            <NotificationToastHost
                subscribeToasts={(listener) => {
                    push = listener;
                    return () => {};
                }}
            />
        </CssVarsProvider>
    );
    act(() => push(intent));
    return view;
};

const CLAUDE = { kind: "oauth", app: "claude" };
const CHATGPT = { kind: "oauth", app: "chatgpt" };
const SPOOFS = ["Claude ", "claude-evil", "CLAUDE", "", 5, { a: 1 }, null];

describe("the toast for an AI-app notice (meta.appFamily)", () => {
    it("shows the Claude mark, with the text unchanged", () => {
        const intent = intentOf(noticeWire({ appFamily: "claude" }));
        expect(intent.viaApp).toBe("claude");
        const { container } = showToast(intent);
        expect(container.ownerDocument.querySelector('[data-via-app="claude"]')).not.toBeNull();
        expect(screen.getByRole("img", { name: "via Claude" })).toBeTruthy();
        expect(screen.getByText("Claude Code created task QR-7 Fix login")).toBeTruthy();
        expect(screen.getByText("Fix login")).toBeTruthy();
        // The initial that used to stand in for the app is gone.
        expect(container.ownerDocument.body.textContent).not.toMatch(/(^|\s)C(\s|$)/);
    });

    it("shows the ChatGPT mark", () => {
        const intent = intentOf(noticeWire({ app: "ChatGPT", appFamily: "chatgpt" }));
        showToast(intent);
        expect(document.querySelector('[data-via-app="chatgpt"]')).not.toBeNull();
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeTruthy();
    });

    it("an unknown, spoofed or absent family keeps today's initial avatar", () => {
        for (const appFamily of [...SPOOFS, undefined]) {
            const intent = intentOf(noticeWire(appFamily === undefined ? {} : { appFamily }));
            expect(intent.viaApp, String(appFamily)).toBeUndefined();
            const { unmount } = showToast(intent);
            expect(document.querySelector("[data-via-app]"), String(appFamily)).toBeNull();
            // The BaseAvatar initial, from the title ("Claude Code created ...").
            expect(screen.getByText("C"), String(appFamily)).toBeTruthy();
            expect(screen.getByText("Claude Code created task QR-7 Fix login")).toBeTruthy();
            unmount();
        }
    });
});

describe("the toast for a comment / mention card (meta.via.app)", () => {
    const cards: Array<[string, (extra: Record<string, unknown>) => never]> = [
        ["task comment (surface 5)", commentWire],
        ["channel mention", mentionWire],
    ];

    for (const [label, wire] of cards) {
        it(`${label}: Claude and ChatGPT show their mark, the text is unchanged`, () => {
            const plain = intentOf(wire({}));
            for (const [via, app] of [
                [CLAUDE, "claude"],
                [CHATGPT, "chatgpt"],
            ] as const) {
                const intent = intentOf(wire({ via }));
                expect(intent.viaApp).toBe(app);
                // Everything but the mark is what a person's card carries.
                expect({ ...intent, viaApp: undefined }).toEqual({ ...plain, viaApp: undefined });
                const { unmount } = showToast(intent);
                expect(document.querySelector(`[data-via-app="${app}"]`)).not.toBeNull();
                expect(screen.getByText(intent.title)).toBeTruthy();
                unmount();
            }
        });

        it(`${label}: a spoof, a non-app via and no via keep the old avatar`, () => {
            const bad: unknown[] = [
                ...SPOOFS.map((app) => ({ kind: "oauth", app })),
                { kind: "api_key", app: "claude" },
                { kind: "app", app: "claude" },
                { kind: "oauth" },
                "claude",
                null,
                undefined,
            ];
            for (const via of bad) {
                const intent = intentOf(wire(via === undefined ? {} : { via }));
                expect(intent.viaApp, JSON.stringify(via)).toBeUndefined();
                expect("viaApp" in intent, JSON.stringify(via)).toBe(false);
                const { unmount } = showToast(intent);
                expect(document.querySelector("[data-via-app]")).toBeNull();
                expect(screen.getByText(intent.title)).toBeTruthy();
                unmount();
            }
        });
    }

    it("no app name, connection id or key name reaches the DOM", () => {
        const intent = intentOf(
            commentWire({
                via: {
                    ...CLAUDE,
                    connection_id: "conn-9f3a",
                    client_name: "Ken's private app",
                    key_name: "my key",
                },
            })
        );
        const { container } = showToast(intent);
        const html = container.ownerDocument.body.innerHTML;
        for (const secret of ["conn-9f3a", "Ken's private app", "my key"]) {
            expect(html).not.toContain(secret);
        }
        expect(JSON.stringify(intent)).not.toContain("conn-9f3a");
    });
});

describe("the toast host itself", () => {
    const base: NotificationIntent = {
        id: "x",
        category: "comments",
        title: "Ada commented",
        body: "hi",
    };

    it("never trusts a viaApp it was handed: a bad value leaves today's avatar", () => {
        for (const viaApp of SPOOFS) {
            const { unmount } = showToast({ ...base, viaApp: viaApp as never });
            expect(document.querySelector("[data-via-app]"), String(viaApp)).toBeNull();
            expect(screen.getByText("A"), String(viaApp)).toBeTruthy();
            unmount();
        }
    });

    it("a mark wins over a picture, and a picture is kept without one", () => {
        const withPicture = { ...base, icon: "https://media.test/a.png" };
        const marked = showToast({ ...withPicture, viaApp: "claude" });
        expect(document.querySelector('[data-via-app="claude"]')).not.toBeNull();
        expect(document.querySelector('img[src="https://media.test/a.png"]')).toBeNull();
        marked.unmount();

        showToast(withPicture);
        expect(document.querySelector("[data-via-app]")).toBeNull();
    });
});
