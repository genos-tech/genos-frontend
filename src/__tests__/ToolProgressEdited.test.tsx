/**
 * After an approve the person edited, the strip says so and shows the values
 * that actually ran (`edited_arguments`), localized: the mark and the words of
 * the app's own vocabulary, never the raw paths and never a `current → new`.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ToolProgressList } from "../features/agentQA/ToolProgressList";
import type { ToolEvent } from "../features/agentQA/types";
import { I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const done = (over: Partial<ToolEvent> = {}): ToolEvent => ({
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: "PRJ-1", title: "New title" },
    summary: "Updated PRJ-1",
    status: "done",
    ...over,
});

const show = (events: ToolEvent[], locale?: string) => {
    if (locale) localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return render(
        <CssVarsProvider>
            <I18nProvider>
                <ToolProgressList events={events} isDark={false} />
            </I18nProvider>
        </CssVarsProvider>
    );
};

beforeAll(async () => {
    await loadLocale("ja");
});

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("an edited approve", () => {
    it("carries the mark and the values that ran", () => {
        show([
            done({
                edited: true,
                edited_arguments: { title: "New title", due_date: "", priority: "High" },
            }),
        ]);
        expect(screen.getByText("Updated PRJ-1")).toBeTruthy();
        expect(screen.getByText("Edited")).toBeTruthy();
        expect(screen.getByText("Title: New title")).toBeTruthy();
        // An empty value is the tools' "clear it".
        expect(screen.getByText("Due date: none")).toBeTruthy();
        expect(screen.getByText("Priority: High")).toBeTruthy();
    });

    it("names a bulk row by its task, and a reminder in the user's clock", () => {
        show([
            done({
                tool_name: "update_tasks_bulk",
                arguments: { updates: [{ display_id: "PRJ-5" }, { display_id: "PRJ-6" }] },
                edited: true,
                edited_arguments: { "updates[1].priority": "Critical", "updates[0].due_date": "" },
            }),
            done({
                step: 2,
                tool_name: "update_todo_item",
                arguments: { time_zone: "Asia/Tokyo" },
                edited: true,
                edited_arguments: { remind_at: "2026-11-07T15:30" },
            }),
        ]);
        expect(screen.getByText("PRJ-6 · Priority: Critical")).toBeTruthy();
        expect(screen.getByText("PRJ-5 · Due date: none")).toBeTruthy();
        expect(screen.getByText("Reminder: 2026-11-07 15:30")).toBeTruthy();
    });

    it("falls back to the row number when the row has no display id", () => {
        show([
            done({
                tool_name: "update_tasks_bulk",
                arguments: { updates: [{}, {}] },
                edited: true,
                edited_arguments: { "updates[1].status": "Open" },
            }),
        ]);
        expect(screen.getByText("Row 2 · Status: Open")).toBeTruthy();
    });

    it("lists tags, and says so when they were all removed", () => {
        show([
            done({ edited: true, edited_arguments: { tags: ["bug", "ui"] } }),
            done({ step: 2, edited: true, edited_arguments: { tags: [] } }),
        ]);
        expect(screen.getByText("Tags: bug, ui")).toBeTruthy();
        expect(screen.getByText("Tags: No tags (this clears them)")).toBeTruthy();
    });

    it("clips a long body to a line, whitespace collapsed", () => {
        const long = `${"word ".repeat(80)}\n\nmore`;
        show([done({ edited: true, edited_arguments: { content_text: long } })]);
        const line = screen.getByText(/^Description: word word/);
        expect(line.textContent!.endsWith("…")).toBe(true);
        expect(line.textContent!.length).toBeLessThan(170);
    });

    it("a path this client does not know is shown as it came, not dropped", () => {
        show([done({ edited: true, edited_arguments: { future_field: "x" } })]);
        expect(screen.getByText('future_field: "x"')).toBeTruthy();
    });

    it("is in Japanese in a Japanese UI, mark and labels both", () => {
        show(
            [
                done({
                    edited: true,
                    edited_arguments: { title: "新しいタイトル", priority: "High", due_date: "" },
                }),
            ],
            "ja"
        );
        expect(screen.getByText("編集済み")).toBeTruthy();
        expect(screen.getByText("タイトル: 新しいタイトル")).toBeTruthy();
        expect(screen.getByText(/^優先度: /)).toBeTruthy();
        expect(screen.getByText("締切: なし")).toBeTruthy();
        expect(screen.queryByText("Edited")).toBeNull();
    });
});

describe("no mark where there was no edit", () => {
    it("a plain approve", () => {
        show([done()]);
        expect(screen.getByText("Updated PRJ-1")).toBeTruthy();
        expect(screen.queryByText("Edited")).toBeNull();
    });

    it("a tool error, even if an event carried the mark (the run refused it: nothing ran)", () => {
        show([
            done({
                status: "error",
                error: "Unknown tag: nope",
                summary: undefined,
                edited: true,
                edited_arguments: { tags: ["nope"] },
            }),
        ]);
        expect(screen.getByText(/Unknown tag: nope/)).toBeTruthy();
        expect(screen.queryByText("Edited")).toBeNull();
        expect(screen.queryByText(/Tags: nope/)).toBeNull();
    });

    it("a step still pending", () => {
        show([
            done({
                status: "pending",
                summary: undefined,
                edited: true,
                edited_arguments: { title: "x" },
            }),
        ]);
        expect(screen.queryByText("Edited")).toBeNull();
    });

    it("`edited` without values is not a mark (nothing to show)", () => {
        show([done({ edited: true })]);
        expect(screen.queryByText("Edited")).toBeNull();
    });
});
