// MIP-2553: "Task PRJ-12 is now Closed." in a chat thread reads in the app's language.
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { v3ThreadMessagesToLegacy } from "../features/chat/adapters/v3ToLegacy";
import { TaskClosedNoticeRow } from "../features/chat/components/bubbles/TaskClosedNoticeRow";
import { I18nProvider, loadLocale } from "../i18n";
import type { Message } from "../types/channel";

const message = (overrides: Partial<Message>): Message =>
    ({
        id: "root",
        sender: null,
        seq: 1,
        body: [],
        bodyText: "",
        isThreadReply: false,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        taskId: null,
        displayId: null,
        deletedAt: null,
        tsSent: "2026-11-28T00:00:00Z",
        tsUpdated: "2026-11-28T00:00:00Z",
        ...overrides,
    }) as Message;

const reply = (overrides: Partial<Message>) =>
    v3ThreadMessagesToLegacy({
        messages: [
            message({}),
            message({
                id: "r1",
                isThreadReply: true,
                parentId: "root",
                bodyText: "Task PRJ-12 is now Closed.",
                metadata: { systemNotice: "task_closed", closedTaskDisplayId: "PRJ-12" },
                ...overrides,
            }),
        ],
        channelId: "c",
        threadRootUuid: "root",
        chatType: 2,
    })[1];

describe("the closed-task line", () => {
    afterEach(() => localStorage.clear());

    it("is marked on an authorless notice only", () => {
        expect(reply({}).closedTaskId).toBe("PRJ-12");
        expect(reply({ sender: { userId: "u2" } as never }).closedTaskId).toBeUndefined();
        expect(reply({ metadata: { systemNotice: "task_closed" } }).closedTaskId).toBeUndefined();
    });

    it.each([
        ["en", "Task PRJ-12 is now Closed."],
        ["ja", /タスク PRJ-12 は/],
    ] as const)("reads in %s", async (locale, text) => {
        localStorage.setItem("genos-locale", locale);
        await loadLocale(locale);
        const { container } = render(
            <I18nProvider>
                <CssVarsProvider>
                    <TaskClosedNoticeRow displayId="PRJ-12" />
                </CssVarsProvider>
            </I18nProvider>
        );
        await screen.findByText((_, el) => el?.tagName === "BDI" && el.textContent === "PRJ-12");
        if (typeof text === "string") expect(container.textContent).toBe(text);
        else expect(container.textContent).toMatch(text);
    });
});
