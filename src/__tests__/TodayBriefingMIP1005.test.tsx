/**
 * MIP-1005 / MIP-1696: the Today view (Tasks dashboard tab, Genos page card).
 *
 * Covers the typed client (query, 404, error, partial answers), the paths a row opens, the
 * "since I last looked" memory, the page and the card (sections, one click to open, the
 * honest empty and error states) and the copy in all seven locales. Layout at 390 and 1440 px
 * is not testable in jsdom; it is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    BriefingTask,
    BriefingToday,
    changeHref,
    hasBriefingNews,
    loadBriefingToday,
    markLooked,
    mentionHref,
    normaliseBriefing,
    sinceForView,
    taskHref,
} from "../features/today/briefingToday";
import { changeLine, reasonLine, type TodayCopy } from "../features/today/briefingWords";
import { TodayBriefing } from "../features/today/TodayBriefing";
import { BriefingTodayStatus, useBriefingToday } from "../features/today/useBriefingToday";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: navigate }));

const NOW = Date.parse("2026-11-22T09:00:00Z");

const answer = (over: Partial<BriefingToday> = {}): BriefingToday =>
    normaliseBriefing({
        window: {
            since: "2026-11-22T00:00:00Z",
            until: "2026-11-22T09:00:00Z",
            timeZone: "UTC",
            localDate: "2026-11-22",
        },
        overdue: [
            { taskId: 11, projectId: 3, displayId: "WEB-4", title: "Fix login", daysUntilDue: -2 },
        ],
        overdueCount: 1,
        dueToday: [
            { taskId: 12, projectId: 4, displayId: "API-9", title: "Ship it", daysUntilDue: 0 },
        ],
        dueTodayCount: 1,
        mentions: [
            {
                source: "chat",
                at: "2026-11-22T08:00:00Z",
                from: "Ana",
                text: "can you look?",
                chatId: "c1",
                chatType: "gm",
                chatTitle: "Design",
            },
        ],
        changed: {
            items: [
                {
                    type: "task",
                    taskId: 13,
                    projectId: 3,
                    displayId: "WEB-7",
                    title: "Pricing page",
                    latestAt: "2026-11-22T08:30:00Z",
                    eventsTotal: 2,
                    latest: { by: "Ben", summary: "commented", text: "ok" },
                },
            ],
            total: 1,
            truncated: false,
        },
        ...over,
    });

const view = (data: BriefingToday | null, status: BriefingTodayStatus = "ready") => ({
    status,
    data,
    since: data?.window.since ?? null,
    refresh: vi.fn(),
});

const renderToday = (v: ReturnType<typeof view>, variant: "page" | "card" = "page") =>
    render(
        <CssVarsProvider>
            <TodayBriefing variant={variant} view={v} onOpenToday={vi.fn()} />
        </CssVarsProvider>
    );

beforeEach(() => {
    navigate.mockReset();
    vi.mocked(authApi).mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
});

describe("loadBriefingToday", () => {
    it("asks for the team and, when given, since; returns the normalised answer", async () => {
        const get = vi.fn().mockResolvedValue({ data: { overdue: [{ taskId: 1 }] } });
        vi.mocked(authApi).mockReturnValue({ get } as never);
        const out = await loadBriefingToday("tok", "team-1", "2026-11-21T00:00:00.000Z");
        expect(get).toHaveBeenCalledWith(
            "/briefing/today/",
            expect.objectContaining({
                params: { team_id: "team-1", since: "2026-11-21T00:00:00.000Z" },
            })
        );
        expect(out.status).toBe("ok");
        if (out.status === "ok") {
            expect(out.data.overdue).toHaveLength(1);
            expect(out.data.requests).toEqual([]); // a partial answer never reads undefined
        }
    });

    it("leaves since out on a first visit", async () => {
        const get = vi.fn().mockResolvedValue({ data: {} });
        vi.mocked(authApi).mockReturnValue({ get } as never);
        await loadBriefingToday("tok", "team-1", null);
        expect(get.mock.calls[0][1].params).toEqual({ team_id: "team-1" });
    });

    it("maps 404 to unavailable and anything else to error", async () => {
        const fail = (status: number) =>
            vi.mocked(authApi).mockReturnValue({
                get: vi.fn().mockRejectedValue({ isAxiosError: true, response: { status } }),
            } as never);
        fail(404);
        expect((await loadBriefingToday("tok", "t", null)).status).toBe("unavailable");
        fail(500);
        expect((await loadBriefingToday("tok", "t", null)).status).toBe("error");
    });
});

describe("paths", () => {
    it("opens a task in its project, and shows no link without the project", () => {
        expect(taskHref({ taskId: 5, projectId: 2 })).toBe("/workspace/tasks/project/2/task/5");
        expect(taskHref({ taskId: 5 })).toBeNull();
        expect(taskHref({ taskId: 5, projectId: "../x" as never })).toBeNull();
    });

    it("opens a chat mention at its message, a note by its kind", () => {
        expect(
            mentionHref({
                source: "chat",
                at: "",
                chatId: "c1",
                chatType: "gm",
                threadId: "t9",
                messageId: 77,
            })
        ).toBe("/workspace/chat/gm/c1/thread/t9/message/77");
        expect(mentionHref({ source: "note", at: "", noteType: "personal", noteId: 4 })).toBe(
            "/workspace/notes/my/4"
        );
        expect(
            changeHref({
                type: "note",
                noteType: "task",
                noteId: 8,
                taskId: 5,
                projectId: 2,
                latestAt: "",
                eventsTotal: 1,
                latest: {},
            })
        ).toBe("/workspace/notes/task/project/2/task/5/note/8");
        expect(mentionHref({ source: "task_comment", at: "", taskId: 5, projectId: 2 })).toBe(
            "/workspace/tasks/project/2/task/5"
        );
    });
});

describe("since I last looked", () => {
    it("is null on a first visit, then the time the viewer left; a reload keeps it", () => {
        expect(sinceForView("u", "t", NOW)).toBeNull();
        markLooked("u", "t", NOW - 3_600_000);
        const first = sinceForView("u", "t", NOW);
        expect(first).toBe(new Date(NOW - 3_600_000).toISOString());
        markLooked("u", "t", NOW - 60_000); // leaving again does not move this tab's list
        expect(sinceForView("u", "t", NOW)).toBe(first);
    });

    it("ignores a time more than 30 days back or in the future (the API refuses both)", () => {
        markLooked("u", "t", NOW - 40 * 86_400_000);
        expect(sinceForView("u", "t", NOW)).toBeNull();
        window.localStorage.clear();
        markLooked("u", "t", NOW + 3_600_000);
        expect(sinceForView("u", "t", NOW)).toBeNull();
    });

    it("keeps a separate memory per team", () => {
        markLooked("u", "t1", NOW - 1000);
        expect(sinceForView("u", "t2", NOW)).toBeNull();
    });
});

describe("useBriefingToday", () => {
    it("loads once, becomes ready, and marks the view as looked when it goes away", async () => {
        const get = vi.fn().mockResolvedValue({ data: answer() });
        vi.mocked(authApi).mockReturnValue({ get } as never);
        const { result, unmount } = renderHook(() => useBriefingToday("tok", "t", "u"));
        expect(result.current.status).toBe("loading");
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(get).toHaveBeenCalledTimes(1);
        unmount();
        expect(window.localStorage.getItem("genos.today.lastLooked.u.t")).not.toBeNull();
    });

    it("does not call the API while disabled", () => {
        const get = vi.fn();
        vi.mocked(authApi).mockReturnValue({ get } as never);
        renderHook(() => useBriefingToday("tok", "t", "u", false));
        expect(get).not.toHaveBeenCalled();
    });
});

describe("TodayBriefing", () => {
    it("shows due, waiting and changed across projects; a click opens the row", () => {
        renderToday(view(answer()));
        expect(screen.getByRole("region", { name: "Due and overdue" })).toBeInTheDocument();
        expect(screen.getByText("Fix login")).toBeInTheDocument();
        expect(screen.getByText("WEB-4")).toBeInTheDocument();
        expect(screen.getByText("2 days overdue")).toBeInTheDocument();
        expect(screen.getAllByText("Due today").length).toBeGreaterThan(0);
        expect(screen.getByText("Mentioned you in Design")).toBeInTheDocument();
        expect(screen.getByText("Ben commented: ok")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Ship it"));
        expect(navigate).toHaveBeenCalledWith("/workspace/tasks/project/4/task/12");
    });

    it("a row with no path is text, not a dead button", () => {
        renderToday(
            view(
                answer({
                    overdue: [
                        { taskId: 1, displayId: "X-1", title: "No project", daysUntilDue: -1 },
                    ],
                    overdueCount: 1,
                    dueToday: [],
                    dueTodayCount: 0,
                })
            )
        );
        expect(screen.queryByRole("button", { name: /No project/ })).toBeNull();
        expect(screen.getByText("No project")).toBeInTheDocument();
    });

    it("says plainly when nothing is waiting, and offers a retry on an error", () => {
        const empty = answer({
            overdue: [],
            overdueCount: 0,
            dueToday: [],
            dueTodayCount: 0,
            mentions: [],
            changed: { items: [], total: 0, truncated: false },
        });
        const { unmount } = renderToday(view(empty));
        expect(screen.getByText("Your day is clear")).toBeInTheDocument();
        unmount();
        const failed = view(null, "error");
        renderToday(failed);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(failed.refresh).toHaveBeenCalled();
    });

    it("the card is one short list across the sections, the rest as a count, and a way in", () => {
        const many = Array.from({ length: 5 }, (_, i) => ({
            taskId: 100 + i,
            projectId: 1,
            displayId: `P-${i}`,
            title: `T${i}`,
            daysUntilDue: -1,
        }));
        renderToday(view(answer({ overdue: many, overdueCount: 5 })), "card");
        expect(screen.getByTestId("today-card")).toBeInTheDocument();
        expect(screen.getByText("P-0 T0")).toBeInTheDocument();
        expect(screen.queryByText("P-3 T3")).toBeNull();
        expect(screen.getByText("+5 more")).toBeInTheDocument(); // 8 things in all, 3 shown
        expect(screen.getByRole("button", { name: "Open Today" })).toBeInTheDocument();
        fireEvent.click(screen.getByText("P-1 T1"));
        expect(navigate).toHaveBeenCalledWith("/workspace/tasks/project/1/task/101");
    });

    it("hasBriefingNews is false for an empty answer, so the Genos page shows no card", () => {
        expect(hasBriefingNews(null)).toBe(false);
        expect(
            hasBriefingNews(
                answer({
                    overdue: [],
                    overdueCount: 0,
                    dueToday: [],
                    dueTodayCount: 0,
                    mentions: [],
                    changed: { items: [], total: 0, truncated: false },
                })
            )
        ).toBe(false);
        expect(hasBriefingNews(answer())).toBe(true);
    });
});

describe("Today copy exists in every locale", () => {
    const keys = (o: Record<string, unknown>, p = ""): string[] =>
        Object.entries(o).flatMap(([k, v]) =>
            v && typeof v === "object"
                ? keys(v as Record<string, unknown>, `${p}${k}.`)
                : [`${p}${k}`]
        );
    const today = (c: unknown) =>
        (c as { tasks: { dashboard: { today: Record<string, unknown>; tabToday: string } } }).tasks
            .dashboard;
    const enKeys = keys(today(en).today);
    for (const [name, catalog] of Object.entries({ ar, es, fr, hi, ja, zh })) {
        it(`has every Today key in ${name}`, () => {
            expect(keys(today(catalog).today).sort()).toEqual([...enKeys].sort());
            expect(today(catalog).tabToday).toBeTruthy();
        });
    }
});

describe("the briefing's own sentences are said in the viewer's language (MIP-1936)", () => {
    const item = (data: Record<string, string | number | null>, extra = {}) =>
        ({
            type: "task",
            latestAt: "2026-11-22T08:30:00Z",
            eventsTotal: 1,
            latest: { by: "ana", summary: "ENGLISH SENTENCE", data, ...extra },
        }) as never;
    const copyOf = (c: unknown) =>
        (c as { tasks: { dashboard: { today: TodayCopy } } }).tasks.dashboard.today;

    it("says a status change from field, old and new, in ja and en", () => {
        const c = item({ code: "field_changed", field: "status", old: "Open", new: "Review" });
        expect(changeLine(c, copyOf(en))).toBe("ana changed status: Open → Review");
        expect(changeLine(c, copyOf(ja))).toBe(
            "ana さんがステータスを変更しました: Open → Review"
        );
        expect(changeLine(c, copyOf(ja))).not.toContain("ENGLISH");
    });

    it("translates the server's English stand-ins for an unknown person and automation", () => {
        const data = { code: "created" };
        expect(changeLine(item(data, { by: "someone" }), copyOf(ja))).toBe(
            "誰か さんが作成しました"
        );
        expect(changeLine(item(data, { by: "system" }), copyOf(ja))).toContain("システム");
    });

    it("keeps a short quote after the sentence", () => {
        const c = item({ code: "comment" }, { text: "ok" });
        expect(changeLine(c, copyOf(ja))).toBe("ana さんがコメントしました: ok");
    });

    it("falls back to the English sentence for a code it does not know, or no data", () => {
        expect(changeLine(item({ code: "from_the_future" }), copyOf(ja))).toBe(
            "ana ENGLISH SENTENCE"
        );
        const old = { latest: { by: "ana", summary: "commented" } } as never;
        expect(changeLine(old, copyOf(ja))).toBe("ana commented");
    });

    it("says every reason code in the viewer's language", () => {
        const task: BriefingTask = {
            taskId: 1,
            displayId: "A-1",
            title: "t",
            reasons: ["overdue by 4 days", "x", "priority High"],
            reasonCodes: [
                { code: "overdue", days: 4 },
                { code: "activity", comments: 1, changes: 2, since: "2026-11-22T00:00:00Z" },
                { code: "priority", priority: "High" },
            ],
        };
        const ja_ = reasonLine(task, copyOf(ja), "ja");
        expect(ja_).toContain("4 日超過");
        expect(ja_).toContain("コメント 1 件");
        expect(ja_).toContain("変更 2 件");
        expect(ja_).toContain("優先度 High");
        expect(ja_).not.toMatch(/overdue|comment|change/);
        expect(reasonLine(task, copyOf(en), "en")).toContain(
            "1 comment and 2 changes from others"
        );
        // an older server without codes: the English sentences, as before
        expect(reasonLine({ ...task, reasonCodes: undefined }, copyOf(ja), "ja")).toBe(
            "overdue by 4 days · x · priority High"
        );
    });

    it("renders the page with no server English next to Japanese headings", () => {
        const v = view(
            answer({
                suggestedNext: [
                    {
                        taskId: 14,
                        projectId: 3,
                        displayId: "WEB-9",
                        title: "Fix",
                        reasons: ["overdue by 4 days"],
                        reasonCodes: [{ code: "overdue", days: 4 }],
                    },
                ],
                changed: {
                    items: [
                        {
                            type: "task",
                            taskId: 13,
                            projectId: 3,
                            displayId: "WEB-7",
                            title: "Pricing page",
                            latestAt: "2026-11-22T08:30:00Z",
                            eventsTotal: 1,
                            latest: {
                                by: "Ben",
                                summary: "commented",
                                data: { code: "comment" },
                            },
                        },
                    ],
                    total: 1,
                    truncated: false,
                },
            })
        );
        renderToday(v);
        // The test provider is English: the sentence is the en copy, not the server's "commented".
        expect(screen.getByText(/Ben commented/)).toBeTruthy();
        expect(screen.getByText(/4 days overdue/)).toBeTruthy();
    });
});
