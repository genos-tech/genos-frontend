/**
 * MIP-1132: every new feedback string exists in all seven locales, translated.
 * `DeepPartial<Messages>` lets a locale omit a key and quietly show English,
 * so these read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Tree = { [key: string]: Tree | string };
const get = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

const KEYS = [
    "common.feedback.loading",
    "common.feedback.toast.region",
    "common.feedback.toast.undo",
    "common.feedback.loadFailedBody",
    "common.feedback.sync.banner",
    "common.feedback.sync.bannerRetrying",
    "common.feedback.sync.chatsFailed",
    "common.feedback.sync.activityFailed",
    "common.feedback.sync.inboxFailed",
    "common.feedback.sync.tasksFailed",
    "common.feedback.sync.projectsFailed",
    "notes.editor.loadFailed",
    "tasks.activity.loadFailed",
    "tasks.dashboard.velocity.loadFailed",
    "integrations.connections.loadFailed",
    "integrations.github.repoAccess.loadFailed",
    "integrations.pullRequest.linkedCard.loadFailed",
    "tasks.createForm.bootstrapFailed",
    "chat.channel.pane.loadFailed",
    "chat.channel.thread.loadFailed",
    "chat.threadTabs.ariaLabel",
    "inbox.tabs.ariaLabel",
    "notes.tabs.ariaLabel",
    "notes.tabs.closeTab",
] as const;

const OTHERS = { ja, es, fr, zh, ar, hi } as const;

// The same word in the language, by its own spelling (not a missing translation).
const SAME: Partial<Record<keyof typeof OTHERS, string[]>> = {
    fr: ["common.feedback.toast.region"],
};

describe("feedback strings", () => {
    it("English has all of them", () => {
        for (const k of KEYS) expect(get(en, k), k).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all of them, translated (not the English)`, () => {
            for (const k of KEYS) {
                expect(get(catalog, k), `${name}.${k}`).toBeTruthy();
                if (SAME[name as keyof typeof OTHERS]?.includes(k)) continue;
                expect(get(catalog, k), `${name}.${k} is the English text`).not.toBe(get(en, k));
            }
        });
    }

    it("no new toast or empty-state string apologizes", () => {
        for (const k of KEYS) expect(get(en, k), k).not.toMatch(/sorry|oops|unfortunately/i);
    });
});
