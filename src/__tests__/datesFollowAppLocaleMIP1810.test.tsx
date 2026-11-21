/**
 * MIP-1810: every date the app writes is in the language picked in Settings, not the
 * browser's. About a dozen places still called `toLocaleDateString(undefined, ...)` (or
 * `toLocaleString()` with no tag at all), which is the BROWSER's language: an Arabic app on an
 * English browser showed "Nov 11" in the note history, the task graph, the dashboard rows,
 * the todo list and so on.
 *
 * The runtime here is English (jsdom: navigator.language "en-US", Node's ICU default "en-US"),
 * so any date that comes out in ar, fr or ja can only have come from the app's locale. Pure
 * helpers take the locale as an argument; components are rendered under the real
 * I18nProvider, the way the app mounts them. The expected text is the same `Intl` call given
 * the app's tag, and each case also checks it is NOT what the English runtime would write.
 *
 * "Now" is frozen (Date only: timers stay real) so a 10-day-old value is always past the
 * week where the relative wording turns into a date.
 */
import { useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamConnectedAppsSection } from "../components/layout/TeamConnectedAppsSection";
import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { HelperUtils } from "../db/utils/helpers";
import { PendingInvitesSection } from "../features/admin/components/modals/PendingInvitesSection";
import { ModalRecentlyDeletedChats } from "../features/chat/components/modals/ModalRecentlyDeletedChats";
import { formatCompletedAt } from "../features/chat/utils/todoCompletion";
import { ModalNoteHistory } from "../features/notes/common/components/ModalNoteHistory";
import { NoteHistoryChip } from "../features/notes/common/components/NoteHistoryChip";
import { relativeTimeLabel } from "../features/spotlight/SpotlightContent";
import { dueDisplay } from "../features/tasks/components/card";
import { MilestoneNodeView } from "../features/tasks/diagram/components/MilestoneNodeCard";
import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";
import { TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import type { TaskNodeData } from "../features/tasks/diagram/types";
import { getScheduleStatus } from "../features/tasks/diagram/utils/scheduleStatus";
import { formatDueLabel } from "../features/tasks/utils/dashboardRowFormat";
import { fmt, getMessages, I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { Locale } from "../i18n/types";
import { authApi } from "../services/api";
import { channelService } from "../services/channel/channelService";
import { formatStatusExpiry } from "../services/notifications/statusExpiry";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../services/api", () => ({ authApi: vi.fn(), nonAuthApi: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/notes/common/services/loadNoteVersion", () => ({
    loadNoteVersion: vi.fn(async () => ({
        versionNo: 1,
        title: "Plan",
        body: [],
        editor: { userId: "u2", userName: "Ann", avatarUrl: null },
        tsCreatedAt: "2026-11-11T05:30:00Z",
        tsUpdatedAt: "2026-11-11T05:30:00Z",
    })),
}));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/tasks/diagram/components/TaskFlowCanvas", () => ({
    TaskFlowCanvas: ({ onOverviewChange }: { onOverviewChange?: (o: unknown) => void }) => {
        useEffect(() => {
            onOverviewChange?.({
                spanStart: "2026-12-02",
                spanEnd: "2026-12-20",
                spanDays: 19,
                total: 4,
                closed: 1,
                sprint: { name: "S1", startDate: "2026-12-02", endDate: "2026-12-16" },
                health: null,
            });
        }, [onOverviewChange]);
        return <div data-testid="canvas" />;
    },
}));
vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    Handle: () => <i />,
}));

const LOCALES: Locale[] = ["ar", "fr", "ja", "en"];
const NON_EN: Locale[] = ["ar", "fr", "ja"];
const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);
const DAY = 86_400_000;
// 10 days before NOW: 2026-11-15 (noon UTC, the same calendar day in every zone). Day and
// month differ (15/11), so the numeric forms of en, fr, ja and ar all differ.
const TEN_DAYS_AGO = new Date(NOW - 10 * DAY).toISOString();

const intl = (locale: string, options: Intl.DateTimeFormatOptions, date: Date) =>
    new Intl.DateTimeFormat(locale, options).format(date);

// A `YYYY-MM-DD` date is a calendar day: that day at LOCAL midnight. (`new Date("2026-12-02")`
// is UTC midnight, Dec 1 west of UTC: building the expected text that way hid MIP-1811.)
const day = (iso: string): Date => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
};

const MONTH: Record<string, RegExp> = { en: /Nov/, fr: /nov/, ja: /11月/, ar: /نوفمبر/ };
const DEC: Record<string, RegExp> = { en: /Dec/, fr: /déc/, ja: /12月/, ar: /ديسمبر/ };

beforeEach(async () => {
    // The browser AND the JS runtime say English: every assertion is about the app's choice.
    expect(navigator.language.toLowerCase().startsWith("en")).toBe(true);
    expect(Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("en")).toBe(
        true
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await Promise.all(LOCALES.map((l) => loadLocale(l)));
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.restoreAllMocks();
});

const withLocale = async (locale: Locale, ui: React.ReactNode) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    await loadLocale(locale);
    return render(
        <I18nProvider>
            <CssVarsProvider>{ui}</CssVarsProvider>
        </I18nProvider>
    );
};

describe("pure helpers take the app's locale", () => {
    it.each(LOCALES)("formatCompletedAt (todo rows) in %s", (locale) => {
        const iso = "2026-11-11T05:30:00Z";
        const text = formatCompletedAt(iso, locale);
        expect(
            text.startsWith(intl(locale, { month: "short", day: "numeric" }, new Date(iso)))
        ).toBe(true);
        expect(text).toMatch(MONTH[locale]);
    });

    it.each(LOCALES)("formatDueLabel (dashboard rows, board list) in %s", (locale) => {
        const labels = getMessages(locale).tasks.dueLabel;
        // 5 days out: the weekday.
        const weekday = formatDueLabel("2026-11-30", locale);
        const d5 = day("2026-11-30");
        expect(weekday.text).toBe(
            fmt(labels.dueOn, { when: intl(locale, { weekday: "short" }, d5) })
        );
        // 14 days out: month and day.
        const later = formatDueLabel("2026-12-05", locale);
        const d14 = day("2026-12-05");
        expect(later.text).toBe(
            fmt(labels.dueOn, { when: intl(locale, { month: "short", day: "numeric" }, d14) })
        );
        expect(later.text).toMatch(DEC[locale]);
        // And through the card's own entry point.
        expect(dueDisplay("2026-12-05", "row", locale).text).toBe(later.text);
    });

    it("formatDueLabel is not the English runtime's weekday and month", () => {
        for (const locale of NON_EN) {
            expect(formatDueLabel("2026-12-05", locale).text).not.toMatch(/Dec/);
            expect(formatDueLabel("2026-11-30", locale).text).not.toMatch(/Mon/);
        }
    });

    it.each(LOCALES)("getScheduleStatus (graph node dates) in %s", (locale) => {
        const s = getScheduleStatus("2026-12-02", "2026-12-20", "Open", locale);
        expect(s.startLabel).toBe(
            intl(locale, { month: "short", day: "numeric" }, day("2026-12-02"))
        );
        expect(s.dueLabel).toBe(
            intl(locale, { month: "short", day: "numeric" }, day("2026-12-20"))
        );
        expect(s.startLabel).toMatch(DEC[locale]);
    });

    it.each(LOCALES)("formatStatusExpiry (status and pause) in %s", (locale) => {
        const iso = "2026-11-28T05:30:00Z";
        const text = formatStatusExpiry(iso, locale, NOW);
        expect(text).toBe(
            new Date(iso).toLocaleString(locale, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
            })
        );
        if (locale !== "en") {
            expect(text).not.toBe(formatStatusExpiry(iso, "en", NOW));
        }
    });

    it.each(LOCALES)("HelperUtils.formatTimestamp in %s", (locale) => {
        const ts = Date.UTC(2026, 10, 11, 5, 30, 0);
        expect(HelperUtils.formatTimestamp(ts, locale)).toBe(new Date(ts).toLocaleString(locale));
    });

    it.each(LOCALES)("relativeTimeLabel (Genos history rows) in %s", (locale) => {
        const ts = getMessages(locale).spotlight;
        expect(relativeTimeLabel(TEN_DAYS_AGO, ts, locale)).toBe(
            new Date(TEN_DAYS_AGO).toLocaleDateString(locale)
        );
    });
});

describe("components render their dates in the app's language", () => {
    it.each(LOCALES)("Recently deleted groups in %s", async (locale) => {
        vi.spyOn(channelService, "listDeletedChannels").mockResolvedValue([
            {
                id: "g-1",
                title: "Launch crew",
                isPrivate: true,
                deletedAt: TEN_DAYS_AGO,
                memberCount: 4,
            },
        ]);
        await withLocale(
            locale,
            <ModalRecentlyDeletedChats teamId="team-1" open onClose={vi.fn()} />
        );
        const when = intl(
            locale,
            { year: "numeric", month: "short", day: "numeric" },
            new Date(TEN_DAYS_AGO)
        );
        const row = await screen.findByText(new RegExp(escape(when)));
        expect(row.textContent).toMatch(MONTH[locale]);
    });

    const tenDaysNote = {
        versionNo: 2,
        title: "Plan",
        editor: { userId: "u2", userName: "Ann", avatarUrl: null },
        tsCreatedAt: TEN_DAYS_AGO,
        tsUpdatedAt: TEN_DAYS_AGO,
    };
    const nm = {
        currentNoteVersions: [tenDaysNote, { ...tenDaysNote, versionNo: 1 }],
        currentNoteMembers: [],
        loadNoteVersionsFor: vi.fn(),
    } as never;
    const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;

    it.each(LOCALES)("the note history chip in %s", async (locale) => {
        await withLocale(
            locale,
            <NoteHistoryChip
                myself={me}
                noteId={1}
                noteType={1}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                useNM={nm}
                useUISM={{} as never}
            />
        );
        const text = screen.getByRole("button").getAttribute("aria-label") ?? "";
        expect(text).toContain(
            intl(locale, { month: "short", day: "numeric" }, new Date(TEN_DAYS_AGO))
        );
        expect(text).toMatch(MONTH[locale]);
    });

    it.each(LOCALES)("the note history modal (list and snapshot) in %s", async (locale) => {
        await withLocale(
            locale,
            avatars(
                <ModalNoteHistory
                    myself={me}
                    noteId={1}
                    noteType={1}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useNM={nm}
                    useUISM={{} as never}
                    open
                    onClose={vi.fn()}
                />
            )
        );
        const listed = intl(
            locale,
            { month: "short", day: "numeric", hour: "numeric", minute: "numeric" },
            new Date(TEN_DAYS_AGO)
        );
        expect((await screen.findAllByText(listed)).length).toBeGreaterThan(0);
        const snapshot = fmt(getMessages(locale).notes.history.snapshotFrom, {
            time: new Date("2026-11-11T05:30:00Z").toLocaleString(locale),
        });
        await screen.findByText(snapshot);
    });

    const nodeData = (over: Partial<TaskNodeData> = {}, task: Partial<TaskTableProps> = {}) =>
        ({
            task: {
                id: 7,
                displayId: "MIP-7",
                title: "Node title",
                status: "Open",
                priority: null,
                assigneeId: null,
                assigneeName: "",
                startDate: "2026-12-02",
                dueDate: "2026-12-20",
                isMilestone: false,
                ...task,
            } as unknown as TaskTableProps,
            isRoot: false,
            isCurrentPreview: false,
            isMilestone: false,
            isExternal: false,
            closedDescendantCount: 0,
            totalDescendantCount: 0,
            openBlockerCount: 0,
            projectName: null,
            onChange: vi.fn(),
            onAddSubtask: vi.fn(),
            onDelete: vi.fn(),
            onOpenPreview: vi.fn(),
            ...over,
        }) as TaskNodeData;

    const avatars = (node: React.ReactNode) => (
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
            {node}
        </AvatarContextProvider>
    );

    const range = (locale: string) => {
        const f = (iso: string) => intl(locale, { month: "short", day: "numeric" }, day(iso));
        return `${f("2026-12-02")} – ${f("2026-12-20")}`;
    };

    it.each(LOCALES)("a task node's dates in %s", async (locale) => {
        await withLocale(locale, avatars(<TaskNodeView data={nodeData()} />));
        const el = screen.getByText(range(locale));
        expect(el.textContent).toMatch(DEC[locale]);
    });

    it.each(LOCALES)("a milestone node's dates and sprint window in %s", async (locale) => {
        await withLocale(
            locale,
            avatars(
                <MilestoneNodeView
                    data={nodeData(
                        {
                            isMilestone: true,
                            totalDescendantCount: 3,
                            closedDescendantCount: 1,
                            sprint: {
                                id: 1,
                                name: "S1",
                                startDate: "2026-12-02",
                                endDate: "2026-12-16",
                            } as never,
                        },
                        { isMilestone: true }
                    )}
                />
            )
        );
        expect(screen.getByText(range(locale))).toBeTruthy();
        const f = (iso: string) => intl(locale, { month: "short", day: "numeric" }, day(iso));
        const sprint = screen.getByText((_, el) => {
            const own = el?.textContent ?? "";
            return own === `${f("2026-12-02")} – ${f("2026-12-16")}`;
        });
        expect(sprint.textContent).toMatch(DEC[locale]);
    });

    it.each(LOCALES)("the graph modal's header span and sprint in %s", async (locale) => {
        await withLocale(
            locale,
            <ModalTaskDiagram
                myself={me}
                projectId={1}
                rootLabel="KDS-5 · Five"
                rootTaskId={5}
                usePM={{} as never}
                useTM={{} as never}
                open
                onClose={vi.fn()}
            />
        );
        const f = (iso: string) => intl(locale, { month: "short", day: "numeric" }, day(iso));
        await waitFor(() => {
            expect(document.body.textContent).toContain(`${f("2026-12-02")} – ${f("2026-12-20")}`);
            expect(document.body.textContent).toContain(`${f("2026-12-02")} – ${f("2026-12-16")}`);
        });
        expect(document.body.textContent).toMatch(DEC[locale]);
    });

    it.each(LOCALES)("team connected apps 'last used' in %s", async (locale) => {
        const get = vi.fn().mockResolvedValue({
            data: {
                connections: [
                    {
                        id: "c1",
                        userId: "u1",
                        userName: "Vic",
                        client: { name: "Claude", kind: "registered", host: "", url: "" },
                        scope: "write",
                        allowDestructive: false,
                        isDefaultTeam: true,
                        otherTeams: 0,
                        lastUsedAt: TEN_DAYS_AGO,
                        createdAt: "2026-11-06T00:00:00Z",
                        revocable: true,
                    },
                ],
            },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
        await withLocale(locale, <TeamConnectedAppsSection teamId="t-1" />);
        const row = await screen.findByTestId("team-app-c1");
        const date = new Date(TEN_DAYS_AGO).toLocaleDateString(locale);
        expect(row.textContent).toContain(
            fmt(getMessages(locale).settings.connectedApps.lastUsed, { date })
        );
    });

    it.each(LOCALES)("pending invites 'expires' in %s", async (locale) => {
        const get = vi.fn().mockResolvedValue({
            data: {
                invites: [
                    {
                        id: "i1",
                        email: "a@b.co",
                        memberRole: "member",
                        projectId: null,
                        projectName: null,
                        invitedBy: "Ken",
                        expiresAt: TEN_DAYS_AGO,
                        createdAt: TEN_DAYS_AGO,
                    },
                ],
            },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
        await withLocale(locale, <PendingInvitesSection teamId="t-1" zIndex={1} />);
        const row = await screen.findByTestId("invite-i1");
        const date = new Date(TEN_DAYS_AGO).toLocaleDateString(locale);
        expect(row.textContent).toContain(
            fmt(getMessages(locale).admin.teamProfile.pendingInvites.detail, {
                name: "Ken",
                date,
            })
        );
    });
});

function escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
