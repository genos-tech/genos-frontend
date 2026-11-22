/**
 * MIP-1807: from a week on, `formatRelativeAge` wrote the date with
 * `toLocaleDateString(undefined, ...)`, i.e. in the BROWSER's language, not the
 * language picked in Settings ("Nov 11, 2026" in an Arabic app on an English
 * browser, and the reverse). It now takes the app's locale from its callers.
 *
 * The runtime here is an English browser (jsdom: navigator.language "en-US"), so
 * any date that comes out in ar, fr or ja can only have come from the app locale.
 * The activity feed, the Last Progress column and the milestone card are rendered
 * under the real I18nProvider, the way the app mounts them.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import { MilestoneCardBody } from "../features/tasks/components/MilestoneCardBody";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { formatRelativeAge } from "../features/tasks/utils/relativeAge";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { I18nProvider, loadLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { Locale } from "../i18n/types";
import type { UserProps } from "../types/admin";
import type { TaskActivityProps, TaskTableProps } from "../types/tasks";

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));
vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/integrations/components/PrStatusCell", () => ({
    PrStatusCell: () => null,
}));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
// 10 days before NOW: 2026-11-11 (noon UTC, the same calendar day in every zone).
const TEN_DAYS_AGO = new Date(NOW - 10 * DAY).toISOString();
const TEN_DAYS_TS = NOW - 10 * DAY;

const messages = en.tasks.activity;

// What the app's language says for that day: the same Intl call, given the tag.
const expected = (locale: Locale) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(TEN_DAYS_TS)
    );

// The month text itself, per language (ICU: Nov / 11月 / nov. / نوفمبر / नव॰ ...).
const MONTH_TEXT: Record<string, RegExp> = {
    en: /Nov/,
    fr: /nov/,
    ja: /11月/,
    ar: /نوفمبر/,
    es: /nov/,
    zh: /11月/,
    hi: /नव/,
};

beforeEach(() => {
    // The browser says English; every assertion below is about the app's choice.
    expect(navigator.language.toLowerCase().startsWith("en")).toBe(true);
});

afterEach(() => {
    cleanup();
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.restoreAllMocks();
});

describe("formatRelativeAge: the date is in the app's language (MIP-1807)", () => {
    it.each(["ar", "fr", "ja", "en", "es", "zh", "hi"] as Locale[])(
        "a 10-day-old value reads in %s",
        (locale) => {
            const text = formatRelativeAge(TEN_DAYS_AGO, messages, NOW, locale);
            expect(text).toBe(expected(locale));
            expect(text).toMatch(MONTH_TEXT[locale]);
        }
    );

    it("is not English for the languages whose month words differ", () => {
        for (const locale of ["ar", "fr", "ja"] as Locale[]) {
            expect(formatRelativeAge(TEN_DAYS_AGO, messages, NOW, locale)).not.toMatch(/Nov\b/);
        }
    });

    it("never hands Intl an undefined locale (that is the browser's)", () => {
        const spy = vi.spyOn(Date.prototype, "toLocaleDateString");
        formatRelativeAge(TEN_DAYS_AGO, messages, NOW, "ja");
        formatRelativeAge(TEN_DAYS_AGO, messages, NOW);
        formatRelativeAge(TEN_DAYS_AGO, messages, NOW, undefined);
        expect(spy).toHaveBeenCalledTimes(3);
        for (const call of spy.mock.calls) expect(call[0]).toBeTruthy();
    });

    it("leaves the relative wording (under a week) alone", () => {
        expect(formatRelativeAge(new Date(NOW - 3 * DAY).toISOString(), messages, NOW, "ja")).toBe(
            "3 days ago"
        );
    });
});

const activity = (): TaskActivityProps => ({
    activityId: 1,
    actionType: "created",
    fieldName: null,
    oldValue: null,
    newValue: null,
    metadata: { via: { kind: "app" } },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date(Date.now() - 10 * DAY).toISOString(),
});

const tenDaysAgoNow = () => Date.now() - 10 * DAY;
const expectedNow = (locale: Locale) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(tenDaysAgoNow())
    );

const withLocale = async (locale: Locale, ui: React.ReactNode) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    await loadLocale(locale);
    return render(
        <I18nProvider>
            <CssVarsProvider>{ui}</CssVarsProvider>
        </I18nProvider>
    );
};

describe("the Activity tab of a task follows the app's language (MIP-1807)", () => {
    it.each(["ar", "ja", "fr", "en"] as Locale[])("a 10-day-old row in %s", async (locale) => {
        await withLocale(
            locale,
            <TaskActivityFeed
                activities={[activity()]}
                allTasks={[]}
                isLoading={false}
                loadFailed={false}
                myself={{ userId: "u1" } as never}
                setMyself={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onRetry={() => {}}
            />
        );
        const shown = screen.getByText(expectedNow(locale));
        expect(shown.textContent).toMatch(MONTH_TEXT[locale]);
    });
});

describe("the milestone card's Last Progress follows the app's language (MIP-1807)", () => {
    it.each(["ar", "ja", "fr", "en"] as Locale[])("a 10-day-old value in %s", async (locale) => {
        await withLocale(
            locale,
            <MilestoneCardBody
                sprintName={null}
                topRight={null}
                milestone={
                    {
                        id: 1,
                        title: "M",
                        tasksTotal: 4,
                        tasksClosed: 1,
                        assignees: [],
                        tags: [],
                        dueDate: null,
                        lastProgressAt: new Date(Date.now() - 10 * DAY).toISOString(),
                    } as never
                }
            />
        );
        expect(
            screen.getByText(
                new RegExp(expectedNow(locale).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            )
        ).toBeTruthy();
    });
});

const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;
const columns = defaultColumns
    .filter((c) => c.field === "lastProgressAt")
    .map((c) => ({ ...c, width: c.width || 100 }));
const useTM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
} as unknown as TaskManagementState;

const task = () =>
    ({
        id: "1",
        displayId: "PRJ-1",
        title: "Task 1",
        status: "Open",
        priority: "High",
        effortLevel: "Medium",
        dueDate: "2026-12-01",
        assigneeId: "u-dan",
        assigneeName: "Dan OConnor",
        parentTaskId: null,
        rootTaskId: 1,
        projectId: 1,
        tags: [],
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        lastProgressAt: new Date(Date.now() - 10 * DAY).toISOString(),
    }) as unknown as TaskTableProps;

describe("the task table's Last Progress column follows the app's language (MIP-1807)", () => {
    it.each(["ar", "ja", "fr", "en"] as Locale[])("a 10-day-old value in %s", async (locale) => {
        await withLocale(
            locale,
            <AvatarContextProvider
                value={{
                    myself: me,
                    setMyself: () => {},
                    teamMemberProfiles: {},
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
                    <DragDropContext onDragEnd={() => {}}>
                        <Droppable droppableId="t">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    <DraggableTaskRow
                                        columns={columns}
                                        customFieldDefs={[]}
                                        depth={0}
                                        expandedRows={new Set()}
                                        hasChildren={false}
                                        index={0}
                                        isSelected={false}
                                        mode="light"
                                        myself={me}
                                        projectTags={[]}
                                        setMyself={vi.fn()}
                                        socket={null}
                                        task={task()}
                                        teamMembers={[me]}
                                        toggleExpand={vi.fn()}
                                        useCM={{} as never}
                                        useTEM={{} as never}
                                        useTM={useTM}
                                        useUISM={{} as never}
                                        onDeleteTask={vi.fn()}
                                        onOpenDiagram={vi.fn()}
                                        onQuickAddChild={vi.fn()}
                                        onRequestPreview={vi.fn()}
                                        onRowUpdate={vi.fn(async (t: TaskTableProps) => t)}
                                    />
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </ThemeProvider>
            </AvatarContextProvider>
        );
        expect(screen.getByText(expectedNow(locale)).textContent).toMatch(MONTH_TEXT[locale]);
    });
});
