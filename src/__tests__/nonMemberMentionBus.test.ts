import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    notifyNonMemberMentions,
    registerNonMemberMentionListener,
    unregisterNonMemberMentionListener,
} from "../services/nonMemberMentionBus";

// This runs inside the axios response interceptor, on EVERY successful
// response in the app. So the contract that matters is that it stays
// silent and never throws on anything unexpected — a malformed hint
// must not be able to break saving a note.
describe("nonMemberMentionBus", () => {
    beforeEach(() => unregisterNonMemberMentionListener());

    it("forwards a well-formed payload", () => {
        const seen = vi.fn();
        registerNonMemberMentionListener(seen);
        notifyNonMemberMentions({
            nonMemberMentions: {
                scopeKind: "project",
                scopeId: "12",
                scopeName: "Proj",
                users: [{ userId: "u1", userName: "A" }],
            },
        });
        expect(seen).toHaveBeenCalledTimes(1);
        expect(seen.mock.calls[0][0].scopeName).toBe("Proj");
    });

    it("stays silent on responses that carry no hint", () => {
        const seen = vi.fn();
        registerNonMemberMentionListener(seen);
        // The overwhelmingly common case — every other response in the app.
        notifyNonMemberMentions({ noteId: 1, title: "x" });
        notifyNonMemberMentions(null);
        notifyNonMemberMentions("a string body");
        notifyNonMemberMentions({ nonMemberMentions: null });
        expect(seen).not.toHaveBeenCalled();
    });

    it("drops malformed payloads rather than prompting with no usable scope", () => {
        const seen = vi.fn();
        registerNonMemberMentionListener(seen);
        for (const bad of [
            { scopeKind: "nonsense", scopeId: "1", users: [{ userId: "u" }] },
            { scopeKind: "project", scopeId: "1", users: [] },
            { scopeKind: "project", users: [{ userId: "u" }] },
            { scopeKind: "project", scopeId: 12, users: [{ userId: "u" }] },
        ]) {
            notifyNonMemberMentions({ nonMemberMentions: bad });
        }
        expect(seen).not.toHaveBeenCalled();
    });

    it("does nothing once unregistered", () => {
        const seen = vi.fn();
        registerNonMemberMentionListener(seen);
        unregisterNonMemberMentionListener();
        notifyNonMemberMentions({
            nonMemberMentions: {
                scopeKind: "channel",
                scopeId: "c1",
                scopeName: "GM",
                users: [{ userId: "u1", userName: "A" }],
            },
        });
        expect(seen).not.toHaveBeenCalled();
    });
});
