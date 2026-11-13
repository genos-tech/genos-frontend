/**
 * MIP-1376: which changes carry the "via MCP / via API key" mark, and what a
 * viewer may read of the key behind it.
 *
 * The rule under test (Ken, 2026-11-13): the NAME of a key or connected app is
 * its owner's alone. A key writes as its owner, so a row's actor is the owner:
 * the name is handed out only when the viewer is that actor.
 */
import { describe, expect, it } from "vitest";

import {
    commentViaByCommentId,
    isOwnRow,
    viaSourceFromVia,
    viaSourceOfRow,
} from "../features/tasks/utils/viaSource";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { TaskActivityProps } from "../types/tasks";

const KEY = { kind: "api_key", key_id: "k1", key_name: "my-laptop-claude", key_prefix: "gk_ab" };
const APP = { kind: "oauth", connection_id: "c1", client_name: "Claude" };

const row = (over: Partial<TaskActivityProps> = {}): TaskActivityProps => ({
    activityId: 1,
    actionType: "status_changed",
    fieldName: "status",
    oldValue: "Open",
    newValue: "WIP",
    metadata: { via: APP },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: "2026-11-14T00:00:00Z",
    ...over,
});

describe("isOwnRow", () => {
    it("is true only when the viewer is the actor, whatever the id's type", () => {
        expect(isOwnRow("u1", "u1")).toBe(true);
        expect(isOwnRow(7, "7")).toBe(true);
        expect(isOwnRow("u1", "u2")).toBe(false);
    });
    it("an unknown actor or an unknown viewer is nobody", () => {
        expect(isOwnRow(null, null)).toBe(false);
        expect(isOwnRow(undefined, undefined)).toBe(false);
        expect(isOwnRow(null, "u1")).toBe(false);
        expect(isOwnRow("u1", null)).toBe(false);
        expect(isOwnRow("", "")).toBe(false);
    });
});

describe("viaSourceFromVia: what earns a chip", () => {
    it("a connected app is MCP, an API key is an API key", () => {
        expect(viaSourceFromVia(APP, false)?.kind).toBe("mcp");
        expect(viaSourceFromVia(KEY, false)?.kind).toBe("apiKey");
    });

    it("the web app itself earns NO chip, an Undo click included: that is every normal edit", () => {
        expect(viaSourceFromVia({ kind: "app" }, true)).toBeNull();
        expect(
            viaSourceFromVia({ kind: "app", undo_of: { run_id: "r", step: 1 } }, true)
        ).toBeNull();
    });

    it("the in-app Genos AI, other kinds, and a missing or malformed via earn none", () => {
        for (const via of [
            { kind: "agent" },
            { kind: "pr_merge" },
            { kind: "github" },
            { kind: "something-new" },
            {},
            "removed",
            "left",
            42,
            null,
            undefined,
        ]) {
            expect(viaSourceFromVia(via, true), JSON.stringify(via)).toBeNull();
        }
    });
});

describe("viaSourceFromVia: the name is the owner's", () => {
    it("the owner reads the name of the key or app", () => {
        expect(viaSourceFromVia(KEY, true)).toEqual({ kind: "apiKey", name: "my-laptop-claude" });
        expect(viaSourceFromVia(APP, true)).toEqual({ kind: "mcp", name: "Claude" });
    });

    it("anyone else gets the kind and NO name", () => {
        expect(viaSourceFromVia(KEY, false)).toEqual({ kind: "apiKey", name: null });
        expect(viaSourceFromVia(APP, false)).toEqual({ kind: "mcp", name: null });
    });

    it("an owner whose key has no usable name gets none, not a placeholder", () => {
        expect(viaSourceFromVia({ kind: "api_key", key_name: "  " }, true)?.name).toBeNull();
        expect(viaSourceFromVia({ kind: "api_key", key_name: 5 }, true)?.name).toBeNull();
        expect(viaSourceFromVia({ kind: "oauth" }, true)?.name).toBeNull();
    });

    it("a long self-chosen app name is cut", () => {
        const name = viaSourceFromVia({ kind: "oauth", client_name: "x".repeat(500) }, true)?.name;
        expect(name).toHaveLength(60);
    });
});

describe("viaSourceOfRow: the owner is the row's actor", () => {
    it("my own row shows the name", () => {
        expect(viaSourceOfRow(row({ metadata: { via: KEY } }), "u1")).toEqual({
            kind: "apiKey",
            name: "my-laptop-claude",
        });
    });

    it("a colleague's row shows the kind only, and the name is nowhere in the result", () => {
        const seen = viaSourceOfRow(row({ metadata: { via: KEY } }), "u2");
        expect(seen).toEqual({ kind: "apiKey", name: null });
        expect(JSON.stringify(seen)).not.toContain("my-laptop-claude");
        expect(JSON.stringify(seen)).not.toContain("gk_ab");
    });

    it("a row with no actor (a deleted account) is nobody's: kind only", () => {
        expect(viaSourceOfRow(row({ actor: null, metadata: { via: APP } }), "u1")).toEqual({
            kind: "mcp",
            name: null,
        });
    });

    it("a row with no via at all has no chip", () => {
        expect(viaSourceOfRow(row({ metadata: {} }), "u1")).toBeNull();
    });
});

describe("commentViaByCommentId: a comment card's mark", () => {
    const write = (
        activityId: number,
        commentId: unknown,
        via: unknown,
        over: Partial<TaskActivityProps> = {}
    ) =>
        row({
            activityId,
            actionType: "comment_added",
            fieldName: "comment",
            oldValue: null,
            newValue: null,
            metadata: { commentId, via },
            ...over,
        });

    it("a comment written through an app is marked, one typed in Genos is not", () => {
        const map = commentViaByCommentId(
            [write(2, 11, APP), write(1, 10, { kind: "app" })],
            "u1"
        );
        expect(map.get(11)).toEqual({ kind: "mcp", name: "Claude" });
        expect(map.get(10)).toBeNull();
    });

    it("the LATEST write decides, whatever order the rows arrive in", () => {
        // Added through an app, then fixed by hand: the person's now.
        const handFixed = [
            write(5, 11, { kind: "app" }, { actionType: "comment_edited" }),
            write(2, 11, APP),
        ];
        expect(commentViaByCommentId(handFixed, "u1").get(11)).toBeNull();
        expect(commentViaByCommentId([...handFixed].reverse(), "u1").get(11)).toBeNull();
        // Typed by hand, then rewritten through an app: marked.
        const appRewrote = [
            write(5, 12, APP, { actionType: "comment_edited" }),
            write(2, 12, { kind: "app" }),
        ];
        expect(commentViaByCommentId(appRewrote, "u1").get(12)?.kind).toBe("mcp");
        expect(commentViaByCommentId([...appRewrote].reverse(), "u1").get(12)?.kind).toBe("mcp");
    });

    it("a colleague's comment shows the kind only", () => {
        const map = commentViaByCommentId([write(2, 11, KEY)], "u2");
        expect(map.get(11)).toEqual({ kind: "apiKey", name: null });
    });

    it("a comment with no row in the loaded page is simply absent: no chip, never a guess", () => {
        expect(commentViaByCommentId([write(2, 11, APP)], "u1").has(99)).toBe(false);
        expect(commentViaByCommentId([], "u1").size).toBe(0);
    });

    it("rows that are not comment writes, or carry no usable comment id, are ignored", () => {
        const map = commentViaByCommentId(
            [
                write(3, 11, APP, { actionType: "comment_deleted" }),
                write(4, null, APP),
                write(5, undefined, APP),
                write(6, "11", APP),
                row({ activityId: 7, metadata: { commentId: 11, via: APP } }),
            ],
            "u1"
        );
        expect(map.size).toBe(0);
    });
});

describe("the strings, in all seven locales", () => {
    const KEYS = ["mcp", "apiKey", "mcpHint", "mcpHintNamed", "apiKeyHint", "apiKeyHintNamed"];
    type Catalog = { tasks?: { activity?: { via?: Record<string, string> } } };
    const via = (c: unknown) => (c as Catalog).tasks?.activity?.via;

    it("English says via MCP / via API key", () => {
        expect(via(en)?.mcp).toBe("via MCP");
        expect(via(en)?.apiKey).toBe("via API key");
    });

    for (const [name, catalog] of Object.entries({ en, ja, zh, es, fr, hi, ar })) {
        it(`${name} has every key, and keeps the {name} slot in the named hints`, () => {
            for (const k of KEYS) expect(via(catalog)?.[k], `${name}.${k}`).toBeTruthy();
            expect(via(catalog)?.mcpHintNamed).toContain("{name}");
            expect(via(catalog)?.apiKeyHintNamed).toContain("{name}");
            expect(via(catalog)?.mcpHint).not.toContain("{name}");
            expect(via(catalog)?.apiKeyHint).not.toContain("{name}");
        });
        if (name !== "en") {
            it(`${name} is translated, not the English text`, () => {
                expect(via(catalog)?.mcpHint, name).not.toBe(via(en)?.mcpHint);
                expect(via(catalog)?.apiKeyHint, name).not.toBe(via(en)?.apiKeyHint);
            });
        }
    }
});
