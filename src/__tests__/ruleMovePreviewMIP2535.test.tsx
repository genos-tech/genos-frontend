/**
 * MIP-2535: the chat list row of a project rule's move is worded in the viewer's language, not
 * with the English text stored on the message, and names neither the task nor the project.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { channelToLegacyChat } from "../features/chat/adapters/v3ToLegacy";
import { ChatListItemMessage } from "../features/chat/components/sidebar/ChatListItemMessage";
import { ruleMovePreviewText } from "../features/chat/utils/ruleMovePreview";
import { I18nProvider } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { deepMerge, type Messages } from "../i18n/types";
import type { Channel, Message } from "../types/channel";

const STORED = 'Rule "R" moved a task to another project.';

const chatWith = (over: Partial<Message>) =>
    channelToLegacyChat({
        channel: {
            id: "c1",
            kind: 3,
            title: "Old project",
            projectId: 3,
            unreadCount: 0,
            latestMessage: {
                id: "m1",
                channelKind: 3,
                sender: null,
                seq: 5,
                body: [],
                bodyText: STORED,
                metadata: {
                    systemNotice: "task_moved_by_rule",
                    movedTaskId: 41,
                    destinationProjectId: 7,
                    ruleName: "Handover {project}",
                },
                tsSent: "2026-11-28T00:00:00Z",
                ...over,
            } as Message,
        } as unknown as Channel,
        isPinned: false,
        currentUserId: "u1",
    });

const rowText = (chat: ReturnType<typeof chatWith>) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <ChatListItemMessage chat={chat} />
            </I18nProvider>
        </CssVarsProvider>
    ).container.textContent?.replace(/[⁨⁩]/g, "");

describe("the chat list preview of a rule's move", () => {
    it("is the app's sentence, naming neither the task nor the project", () => {
        expect(rowText(chatWith({}))).toBe(
            "Rule “Handover {project}” moved a task to another project."
        );
    });

    it("says milestone for a moved milestone", () => {
        const chat = chatWith({});
        const notice = { ...chat.latestMessage.ruleMove!, milestone: true };
        expect(ruleMovePreviewText(notice, en.chat.ruleMoveNotice)).toContain("moved a milestone");
    });

    it("leaves a member's own message as written", () => {
        expect(rowText(chatWith({ sender: { userId: "u2" } as never }))).toBe(STORED);
    });

    it("is filled in every language, with the rule's name", () => {
        const notice = { ruleName: "R-1", taskId: 41, projectId: 7 };
        for (const overrides of [en, ja, zh, es, fr, hi, ar]) {
            const locale: Messages = deepMerge(en, overrides);
            for (const milestone of [false, true]) {
                const text = ruleMovePreviewText(
                    { ...notice, milestone },
                    locale.chat.ruleMoveNotice
                );
                expect(text).toContain("R-1");
                expect(text).not.toMatch(/\{(rule|task|project)\}/);
            }
        }
        expect(ruleMovePreviewText(notice, deepMerge(en, ja).chat.ruleMoveNotice)).not.toContain(
            "moved"
        );
    });
});
