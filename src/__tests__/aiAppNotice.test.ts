/**
 * "Your AI app did X" notices (MIP-1432), end to end on the client:
 * facts in the activity `meta` -> adapter -> feed filters / aggregation ->
 * words in the member's language -> notification intent -> manager.
 */
import { describe, expect, it, vi } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { aggregateActivityMessages } from "../features/chat/utils/activityAggregation";
import {
    ACTIVITY_PRIMARY_FILTERS,
    CHIP_ORDER,
    CHIP_PREDICATES,
} from "../features/chat/utils/activityChipFilters";
import {
    AI_APP_SURFACE,
    aiAppCategory,
    aiAppHeadline,
    aiAppSentence,
    parseAiAppNotice,
    type AiAppStrings,
} from "../features/chat/utils/aiAppNotice";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { NOTIFICATION_CATEGORIES } from "../services/notifications/categories";
import { NotificationManager } from "../services/notifications/notificationManager";
import { buildActivityIntent } from "../services/notifications/notificationRouter";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "../services/notifications/types";

const S = en.chat!.activity!.aiApp as AiAppStrings;
const JA = ja.chat!.activity!.aiApp as AiAppStrings;

const item = (over: Record<string, unknown> = {}) => ({
    kind: "task",
    id: 7,
    displayId: "QR-7",
    title: "Fix login",
    url: "/workspace/tasks/project/1/task/7",
    projectId: 1,
    taskId: 7,
    ...over,
});

const meta = (over: Record<string, unknown> = {}) => ({
    aiApp: true,
    app: "Claude Code",
    credentialKind: "api_key",
    tool: "create_task",
    verb: "created",
    kind: "task",
    count: 1,
    items: [item()],
    url: "/workspace/tasks/project/1/task/7",
    projectId: 1,
    taskId: 7,
    ...over,
});

const wire = (m: Record<string, unknown> = meta(), over: Record<string, unknown> = {}) =>
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
        meta: m,
        isRead: false,
        tsCreated: "2026-11-13T10:00:00Z",
        ...over,
    }) as never;

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

const headline = (m: Record<string, unknown>) => aiAppHeadline(parseAiAppNotice(m), S);

describe("aiAppNotice wording", () => {
    it("words every kind of write the API files", () => {
        expect(headline(meta())).toBe("Claude Code created task QR-7 Fix login");
        expect(headline(meta({ count: 3, items: [item(), item(), item()] }))).toBe(
            "Claude Code created 3 tasks"
        );
        // Two is already "many": naming one of them would hide the other.
        expect(headline(meta({ count: 2, items: [item(), item()] }))).toBe(
            "Claude Code created 2 tasks"
        );
        expect(
            headline(
                meta({
                    kind: "milestone",
                    taskCount: 4,
                    items: [item({ kind: "milestone", displayId: "MS-1", title: "Launch" })],
                })
            )
        ).toBe("Claude Code created milestone MS-1 Launch with 4 tasks");
        expect(
            headline(meta({ kind: "note", items: [item({ kind: "note", displayId: null })] }))
        ).toBe("Claude Code created note Fix login");
        expect(
            headline(meta({ kind: "todo", items: [item({ kind: "todo", displayId: null })] }))
        ).toBe("Claude Code added to-do Fix login");
        expect(headline(meta({ verb: "status", status: "Closed" }))).toBe(
            "Claude Code set QR-7 Fix login to Closed"
        );
        expect(headline(meta({ verb: "status", status: "Closed", count: 3 }))).toBe(
            "Claude Code set 3 tasks to Closed"
        );
        expect(headline(meta({ verb: "status", count: 3 }))).toBe(
            "Claude Code changed the status of 3 tasks"
        );
        expect(headline(meta({ verb: "commented", kind: "comment" }))).toBe(
            "Claude Code commented on QR-7"
        );
        expect(headline(meta({ verb: "deleted", kind: "comment" }))).toBe(
            "Claude Code deleted a comment on QR-7"
        );
        expect(
            headline(meta({ verb: "deleted", kind: "note", items: [item({ displayId: null })] }))
        ).toBe("Claude Code deleted note Fix login");
    });

    it("falls back to a generic line for a verb it does not know", () => {
        expect(headline(meta({ verb: "teleported" }))).toBe("Claude Code made a change");
        // A status change that names no status and touches one task has nothing to say.
        expect(headline(meta({ verb: "status" }))).toBe("Claude Code made a change");
    });

    it("survives a malformed meta: no items, no count, no app", () => {
        const n = parseAiAppNotice({ aiApp: true, items: "nope", count: -2 });
        expect(n.items).toEqual([]);
        expect(n.count).toBe(1);
        expect(n.app).toBe("AI");
        expect(aiAppSentence(n, S)).toBe("made a change");
    });

    it("words the line in the member's language (word order is the locale's)", () => {
        expect(aiAppHeadline(parseAiAppNotice(meta()), JA)).toBe(
            "Claude Code が タスク QR-7 Fix login を作成しました".replace("が タ", "がタ")
        );
    });

    it("every locale words every key, with its placeholders intact", () => {
        const locales = { ja, es, fr, zh, ar, hi } as const;
        for (const [name, loc] of Object.entries(locales)) {
            const block = loc.chat!.activity!.aiApp as Record<string, string>;
            for (const [key, english] of Object.entries(S)) {
                const text = block[key];
                expect(text, `${name}.chat.activity.aiApp.${key}`).toBeTruthy();
                const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
                expect(holes(text), `${name}.${key} placeholders`).toBe(holes(english));
            }
            expect(loc.chat!.sidebar!.chipAiApp, `${name} chipAiApp`).toBeTruthy();
            const cats = loc.services!.notifications!;
            for (const key of ["aiApps", "aiAppTasks", "aiAppNotes", "aiAppTodos"] as const) {
                expect(cats.categories![key], `${name} category label ${key}`).toBeTruthy();
                expect(
                    cats.settings!.categoryDescriptions![key],
                    `${name} category description ${key}`
                ).toBeTruthy();
            }
        }
    });
});

describe("adapter + feed", () => {
    it("adapts a surface-10 activity into a row that carries the facts", () => {
        const a = v3ActivityToLegacy(wire(), myself);
        expect(a.chatType).toBe(AI_APP_SURFACE);
        expect(a.aiApp?.app).toBe("Claude Code");
        expect(a.aiApp?.items[0].displayId).toBe("QR-7");
        expect(a.senderId).toBe("me");
        expect(a.isRead).toBe(false);
        expect(a.projectId).toBe(1);
        expect(a.taskId).toBe(7);
    });

    it("leaves every other surface alone", () => {
        const a = v3ActivityToLegacy(
            wire(
                { projectName: "P", taskId: 3, projectId: 1 },
                { surfaceType: 5, activityType: 3 }
            ),
            myself
        );
        expect(a.aiApp).toBeUndefined();
        expect(a.chatType).toBe(5);
    });

    it("keeps two notices as two rows: they are never the same topic", () => {
        const rows = [
            v3ActivityToLegacy(wire(meta(), { id: "a" }), myself),
            v3ActivityToLegacy(
                wire(meta(), { id: "b", tsCreated: "2026-11-13T10:05:00Z" }),
                myself
            ),
        ];
        expect(aggregateActivityMessages(rows)).toHaveLength(2);
    });

    it("is not a Task (primary filter) but has its own chip", () => {
        const a = v3ActivityToLegacy(wire(), myself);
        expect(ACTIVITY_PRIMARY_FILTERS[2](a)).toBe(false);
        expect(ACTIVITY_PRIMARY_FILTERS[0](a)).toBe(true);
        expect(CHIP_PREDICATES.aiApp(a)).toBe(true);
        expect(CHIP_ORDER).toContain("aiApp");
        // and no other chip claims it
        for (const [id, pred] of Object.entries(CHIP_PREDICATES)) {
            if (id === "aiApp") continue;
            // A task id rides in for deep links; `task`/`project` chips key off it.
            if (id === "task") continue;
            expect(pred(a), id).toBe(false);
        }
    });
});

describe("notification", () => {
    const useTEM = { teamMemberProfiles: {}, currentTeam: null } as never;
    const useCM = { allChats: [] } as never;
    const row = () => v3ActivityToLegacy(wire(), myself);

    it("has its own group: a lead entry and one switch per kind, all on by default", () => {
        const entries = NOTIFICATION_CATEGORIES.filter((c) => c.group === "ai_apps");
        expect(entries.map((e) => e.key)).toEqual([
            "ai_apps",
            "ai_app_tasks",
            "ai_app_notes",
            "ai_app_todos",
        ]);
        expect(entries.every((e) => e.defaultEnabled)).toBe(true);
        // The lead only titles the group; the three below it are the switches.
        expect(entries.filter((e) => !("hideSubToggle" in e && e.hideSubToggle))).toHaveLength(3);
        // And nothing else sits in it, nor does it sit in the Inbox group any more.
        expect(NOTIFICATION_CATEGORIES.filter((c) => (c.key as string) === "ai_app")).toHaveLength(
            0
        );
    });

    it("answers to the switch of what it is about", () => {
        expect(aiAppCategory("task")).toBe("ai_app_tasks");
        expect(aiAppCategory("milestone")).toBe("ai_app_tasks");
        expect(aiAppCategory("comment")).toBe("ai_app_tasks");
        expect(aiAppCategory("note")).toBe("ai_app_notes");
        expect(aiAppCategory("todo")).toBe("ai_app_todos");
        expect(aiAppCategory("something new")).toBe("ai_app_tasks");
    });

    it("builds an intent even though the actor is the recipient", () => {
        const intent = buildActivityIntent(row(), myself, useTEM, useCM);
        expect(intent).not.toBeNull();
        expect(intent!.category).toBe("ai_app_tasks");
        // The server push's tag, so the two collapse into one card.
        expect(intent!.id).toBe("ai_app_tasks:act-1");
        expect(intent!.title).toBe("Claude Code created task QR-7 Fix login");
        expect(intent!.body).toBe("Fix login");
        // Carrying a senderId would trip the manager's own self check.
        expect(intent!.senderId).toBeUndefined();
    });

    it("still ignores a row that is not an AI-app notice from me", () => {
        const plain = { ...row(), aiApp: undefined, chatType: 3 };
        expect(buildActivityIntent(plain as never, myself, useTEM, useCM)).toBeNull();
    });

    it("takes the category of its kind", () => {
        const note = v3ActivityToLegacy(
            wire(meta({ kind: "note", items: [item({ kind: "note", displayId: null })] })),
            myself
        );
        expect(buildActivityIntent(note, myself, useTEM, useCM)!.category).toBe("ai_app_notes");
    });

    it("toasts by default and stays silent once the member switches it off", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const toast = vi.fn();
        mgr.subscribeToasts(toast);
        const intent = buildActivityIntent(row(), myself, useTEM, useCM)!;
        expect(mgr.notify(intent)).toBe("toast");

        const off = new NotificationManager({ currentUserId: "me" });
        off.hydratePreferences({
            ...DEFAULT_NOTIFICATION_PREFERENCE,
            categorySettings: { ai_app_tasks: false },
        });
        expect(off.notify({ ...intent, id: "ai_app_tasks:other" })).toBe("ignored-disabled");
    });

    it("one kind off leaves the others on: task updates only", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        mgr.hydratePreferences({
            ...DEFAULT_NOTIFICATION_PREFERENCE,
            categorySettings: { ai_app_notes: false, ai_app_todos: false },
        });
        const task = buildActivityIntent(row(), myself, useTEM, useCM)!;
        const note = buildActivityIntent(
            v3ActivityToLegacy(
                wire(meta({ kind: "note", items: [item({ kind: "note" })] }), { id: "act-n" }),
                myself
            ),
            myself,
            useTEM,
            useCM
        )!;
        expect(mgr.notify(task)).toBe("toast");
        expect(mgr.notify(note)).toBe("ignored-disabled");
    });

    it("is a group of its own: the group off silences every kind, the Inbox group does not", () => {
        const intent = buildActivityIntent(row(), myself, useTEM, useCM)!;
        const inboxOff = new NotificationManager({ currentUserId: "me" });
        inboxOff.setGroupEnabled("inbox", false);
        expect(inboxOff.notify(intent)).toBe("toast");

        const groupOff = new NotificationManager({ currentUserId: "me" });
        groupOff.setGroupEnabled("ai_apps", false);
        expect(groupOff.notify(intent)).toBe("ignored-disabled");
    });
});
