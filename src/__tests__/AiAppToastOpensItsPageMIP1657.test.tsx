/**
 * MIP-1657: a click on the "your AI app did X" toast opens the thing it is about.
 *
 * The notice the API files for an MCP write carries the in-app path of what changed (the created
 * task's preview, the edited note). The Activity row opened it; the toast did not: its intent had a
 * source with only the surface type, no chat and no task, so `openIntent` fell through to its last
 * resort, the chat page. The toast now carries the same path, by the same rule the row uses, and the
 * click opens it first.
 *
 * Driven from the wire end, as `ToastViaAppMIP1608.test.tsx` is: a raw `activity.created` payload ->
 * `v3ActivityToLegacy` -> `buildActivityIntent`. The click itself lives in `App.tsx`, which jsdom does
 * not mount whole, so its wiring is pinned on the source and the end-to-end click was checked in a real
 * browser (see the PR).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { inAppPath } from "../features/chat/utils/aiAppNotice";
import { buildActivityIntent } from "../services/notifications/notificationRouter";

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

const notice = (meta: Record<string, unknown>) =>
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
        meta: {
            aiApp: true,
            app: "Claude Code",
            verb: "created",
            kind: "task",
            count: 1,
            items: [{ kind: "task", id: 7, displayId: "QR-7", title: "Fix login", taskId: 7 }],
            ...meta,
        },
        isRead: false,
        tsCreated: "2026-11-16T10:00:00Z",
    }) as never;

const intentFor = (meta: Record<string, unknown>) =>
    buildActivityIntent(v3ActivityToLegacy(notice(meta), myself), myself, useTEM, useCM);

describe("the toast carries the page the change is on", () => {
    it.each([
        ["a created task", { url: "/workspace/tasks/project/1/task/7" }],
        [
            "an edited personal note",
            { kind: "note", verb: "edited", url: "/workspace/notes/my/12" },
        ],
        [
            "a task's note",
            {
                kind: "note",
                verb: "created",
                url: "/workspace/notes/task/project/1/task/7/note/3",
            },
        ],
        ["a milestone", { kind: "milestone", url: "/workspace/tasks/project/1/milestone/4" }],
    ])("%s", (_name, meta) => {
        expect(intentFor(meta)?.url).toBe(meta.url);
    });

    it.each([
        ["a full URL", "https://evil.example/workspace/tasks"],
        ["a protocol-relative URL", "//evil.example/x"],
        ["a script URL", "javascript:alert(1)"],
        ["nothing (a deleted item has no page)", ""],
    ])("never %s", (_name, url) => {
        const intent = intentFor({ url });
        expect(intent).not.toBeNull();
        expect(intent?.url).toBeUndefined();
    });

    it("keeps everything else the toast had", () => {
        const intent = intentFor({ url: "/workspace/tasks/project/1/task/7" })!;
        expect(intent.source).toEqual({ surfaceType: 10 });
        expect(intent.body).toBe("Fix login");
        expect(intent.id).toMatch(/:act-1$/);
    });
});

describe("one rule for a path that may be opened", () => {
    it("is an in-app path or nothing", () => {
        expect(inAppPath("/workspace/x")).toBe("/workspace/x");
        for (const bad of ["", "//h/x", "https://h/x", "workspace/x", null, undefined]) {
            expect(inAppPath(bad as never)).toBeNull();
        }
    });
});

describe("the wiring", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const read = (rel: string) => readFileSync(resolve(here, rel), "utf8").replace(/\s+/g, " ");
    const app = read("../App.tsx");
    const open = app.slice(app.indexOf("const openIntent = useCallback("));

    it("a click opens the intent's own path, before any source rule and the chat fallback", () => {
        const pathAt = open.indexOf("const path = inAppPath(intent.url);");
        expect(pathAt).toBeGreaterThan(-1);
        expect(open).toContain("if (path) { navigate(path); return; }");
        expect(pathAt).toBeLessThan(open.indexOf("const src = intent.source;"));
        expect(pathAt).toBeLessThan(open.indexOf('navigate("/workspace/chat")'));
    });

    it("a reopen callback still wins (agent-run notices)", () => {
        expect(open.indexOf("intent.onOpen();")).toBeLessThan(
            open.indexOf("const path = inAppPath(intent.url);")
        );
    });

    it("the Activity row and the toast use the same rule", () => {
        const row = read("../features/chat/components/sidebar/activity/AiAppActivityRow.tsx");
        expect(row).toContain("const url = inAppPath(notice.url);");
    });
});
