/**
 * MIP-1088: the member's memory controls (what Genos has stored / noticed / how it weighs things /
 * delete), built against genos-api #671.
 *
 * Every network edge is mocked, so these pin the CLIENT's side of that contract: which request each
 * control sends (and that nothing is sent before it is pressed), what the page does with each answer
 * the server can give (200, 404, 409, 400, other), the request budget (one request when the section
 * opens, the ranking only when it is expanded, never one per row), and that nothing on screen claims
 * a state the server did not confirm.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosMemoryPage } from "../features/genos/memory/GenosMemoryPage";
import { parseOverview, parseTop } from "../features/genos/memory/memoryApi";
import { MemoryControlSections } from "../features/genos/memory/MemoryControlSections";
import { suggestionText, whyPhrases } from "../features/genos/memory/memoryWords";
import { I18nProvider, loadLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";

const api = {
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
};

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../services/api", () => ({ authApi: () => api }));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        fetchAgentSessions: vi.fn(async () => []),
        fetchSharedAnswers: vi.fn(async () => ({
            share_answers_with_team: true,
            answers: [],
            has_more: false,
        })),
    };
});

const c = en.settings.genosMemory.control;

const SIGNALS = ["others", "mine", "chat", "notes", "prs", "spread", "trend", "hints"];

const STORED = {
    ledger: {
        entries: 2,
        aiApp: 1,
        ownChanges: 1,
        from: "2026-11-04T16:00:00+00:00",
        to: "2026-11-04T16:01:00+00:00",
        keptDays: 180,
    },
    summaries: { rows: 3, items: 2, from: "2026-11-05", to: "2026-11-06", keptDays: 365 },
    importance: { marks: 1, tunedSignals: 1 },
};
const EMPTY_STORED = {
    ledger: { entries: 0, aiApp: 0, ownChanges: 0, from: null, to: null, keptDays: 180 },
    summaries: { rows: 0, items: 0, from: null, to: null, keptDays: 365 },
    importance: { marks: 0, tunedSignals: 0 },
};

const tuningRows = (over: Record<string, string> = {}) =>
    SIGNALS.map((signal) => ({
        signal,
        level: over[signal] ?? "normal",
        name: `API ${signal}`,
        means: `api means ${signal}`,
    }));

const OVERVIEW = (over: Record<string, unknown> = {}) => ({
    language: "en",
    recording: { enabled: true },
    stored: STORED,
    tuning: tuningRows({ chat: "off" }),
    marks: [{ taskId: 8097, displayId: "WRD-9", title: "Old marked task", mark: "not_important" }],
    marksLimit: 500,
    catalog: {
        levels: [
            { key: "off", name: "API off", means: "api off means" },
            { key: "low", name: "API low", means: "api low means" },
            { key: "normal", name: "API normal", means: "api normal means" },
            { key: "high", name: "API high", means: "api high means" },
        ],
        marks: [{ key: "not_important", name: "API not important", means: "x" }],
    },
    ...over,
});

const TOP = (over: Record<string, unknown> = {}) => ({
    enabled: true,
    history: "full",
    top: [
        {
            taskId: 8100,
            displayId: "WRD-101",
            title: "Fix the login redirect",
            status: "Open",
            priority: "Low",
            project: "Website Redesign",
            score: 30,
            reasons: ["18 from others, on 6 of the last 7 days", "1 other person involved"],
            why: {
                others: 18,
                chat: 0,
                notes: 0,
                prs: 0,
                mine: 0,
                days: 6,
                trend: "rising",
                people: 1,
            },
        },
        {
            taskId: 8101,
            displayId: "WRD-102",
            title: "Ship the deck",
            status: "WIP",
            priority: "High",
            project: "Kids",
            score: 20,
            reasons: ["4 of your own"],
            why: {
                others: 0,
                chat: 2,
                notes: 0,
                prs: 0,
                mine: 4,
                days: 3,
                trend: "steady",
                people: 0,
            },
        },
    ],
    suggestions: [
        {
            kind: "raise_priority",
            taskId: 8100,
            displayId: "WRD-101",
            title: "Fix the login redirect",
            priority: "Low",
            suggestion: "busy all week (18 from others) but marked Low: raise it?",
        },
    ],
    ...over,
});

type Answer = { data?: unknown; status?: number; code?: string };
const reject = (status: number, code?: string) =>
    Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { code } } });

let overview: Answer;
let top: Answer;

const answer = (a: Answer) => {
    if (a.status && a.status >= 400) throw reject(a.status, a.code);
    return { data: a.data };
};

beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    overview = { data: OVERVIEW() };
    top = { data: TOP() };
    api.get.mockImplementation(async (url: string) => {
        if (url === "/user/memory/") return answer(overview);
        if (url === "/user/memory/top/") return answer(top);
        if (url.includes("member-events")) return { data: { member_events_enabled: true } };
        if (url.includes("share-answers")) return { data: { share_answers_with_team: true } };
        if (url.includes("timezone")) return { data: { timezone: "Asia/Tokyo" } };
        throw new Error(`unexpected GET ${url}`);
    });
    api.put.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
    api.patch.mockResolvedValue({ data: {} });
});

const sections = () => (
    <CssVarsProvider>
        <MemoryControlSections accessToken="tok" refreshKey={0} teamId="team-1" />
    </CssVarsProvider>
);

const renderSections = () => render(sections());

const ready = async () => {
    await screen.findByText(c.stored.heading);
};

const memoryCalls = () =>
    api.get.mock.calls.filter(([url]) => String(url).startsWith("/user/memory"));

describe("the request budget", () => {
    it("opens with exactly ONE request, for this team, and does not rank until asked", async () => {
        renderSections();
        await ready();
        expect(memoryCalls()).toEqual([
            ["/user/memory/", { suppressErrorToast: true, params: { team_id: "team-1" } }],
        ]);
    });

    it("expanding makes ONE ranking request for the whole list, never one per row", async () => {
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        await screen.findByText("Ship the deck");
        await screen.findByText("Ship the deck");
        const topCalls = memoryCalls().filter(([url]) => url === "/user/memory/top/");
        expect(topCalls).toHaveLength(1);
        expect(topCalls[0][1]).toMatchObject({ params: { team_id: "team-1", limit: 8 } });
        // Collapsing and opening again does not rank again.
        await user.click(screen.getByRole("button", { name: c.noticed.hide }));
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        expect(memoryCalls().filter(([url]) => url === "/user/memory/top/")).toHaveLength(1);
    });

    it("sends no write until a control is pressed", async () => {
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        await screen.findByText("Ship the deck");
        for (const fn of [api.put, api.patch, api.delete]) expect(fn).not.toHaveBeenCalled();
    });
});

describe("what Genos has stored", () => {
    it("says it in plain words: counts, since-when, how long it is kept; no ids", async () => {
        renderSections();
        await ready();
        const activity = document.querySelector("[data-memory-stored-row=activity]")!;
        expect(activity.textContent).toContain("Entries: 2");
        expect(activity.textContent).toContain("from your AI apps: 1");
        expect(activity.textContent).toContain("your own changes: 1");
        expect(activity.textContent).toContain("Kept 180 days");
        expect(activity.textContent).toMatch(/Since .*2026/);
        const summaries = document.querySelector("[data-memory-stored-row=summaries]")!;
        expect(summaries.textContent).toContain("Saved: 3");
        expect(summaries.textContent).toContain("Tasks covered: 2");
        expect(summaries.textContent).toMatch(/Since Nov 5, 2026/);
        const importance = document.querySelector("[data-memory-stored-row=importance]")!;
        expect(importance.textContent).toContain("Tasks you marked: 1");
        expect(importance.textContent).toContain("Signals you changed: 1");
        // No raw ids anywhere in the stored block.
        expect(document.querySelector("[data-memory-stored]")!.textContent).not.toMatch(
            /8097|team-1/
        );
    });

    it("a calendar day is not shifted by the time zone (summaries `from` is a date, not a time)", async () => {
        const zone = process.env.TZ;
        process.env.TZ = "America/Los_Angeles";
        try {
            renderSections();
            await ready();
            // 2026-11-05 is the 5th everywhere; read as local midnight UTC it would be the 4th here.
            expect(
                document.querySelector("[data-memory-stored-row=summaries]")!.textContent
            ).toContain("Since Nov 5, 2026");
        } finally {
            if (zone === undefined) delete process.env.TZ;
            else process.env.TZ = zone;
        }
    });

    it("an empty store says nothing is stored, in each row", async () => {
        overview = { data: OVERVIEW({ stored: EMPTY_STORED, marks: [], tuning: tuningRows() }) };
        renderSections();
        await ready();
        for (const row of ["activity", "summaries", "importance"]) {
            expect(document.querySelector(`[data-memory-stored-row=${row}]`)!.textContent).toBe(
                c.stored.empty
            );
        }
    });

    it("says whether recording is on or off, and is the switch above, not a second one", async () => {
        renderSections();
        await ready();
        expect(document.querySelector("[data-memory-recording=on]")!.textContent).toBe(
            c.stored.recordingOn
        );
        expect(screen.queryByRole("switch")).toBeNull();
        expect(document.querySelectorAll("input[type=checkbox]").length).toBe(0);
    });

    it("says recording is off, and disables every write control with the reason", async () => {
        overview = { data: OVERVIEW({ recording: { enabled: false } }) };
        renderSections();
        await ready();
        expect(document.querySelector("[data-memory-recording=off]")!.textContent).toBe(
            c.stored.recordingOff
        );
        expect(screen.getByText(c.noticed.recordingOff)).toBeTruthy();
        expect(screen.queryByRole("button", { name: c.noticed.show })).toBeNull();
        expect(screen.getByText(c.tuning.recordingOff)).toBeTruthy();
        for (const select of within(
            document.querySelector("[data-memory-tuning]") as HTMLElement
        ).getAllByRole("combobox")) {
            expect(select.closest(".Mui-disabled")).not.toBeNull();
        }
        expect(
            (screen.getByRole("button", { name: c.tuning.reset }) as HTMLButtonElement).disabled
        ).toBe(true);
        // Deleting is still allowed.
        expect(
            (document.querySelector("[data-memory-delete-button=everything]") as HTMLButtonElement)
                .disabled
        ).toBe(false);
        expect(memoryCalls().filter(([url]) => url === "/user/memory/top/")).toHaveLength(0);
    });

    it("an overview that fails says so and offers a retry, and does not claim 'nothing is stored'", async () => {
        overview = { status: 500 };
        const user = userEvent.setup();
        renderSections();
        expect(await screen.findByText(c.stored.loadFailed)).toBeTruthy();
        expect(screen.queryByText(c.stored.empty)).toBeNull();
        overview = { data: OVERVIEW() };
        await user.click(screen.getByRole("button", { name: en.common.actions.retry }));
        await ready();
    });
});

describe("what Genos noticed", () => {
    const open = async () => {
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        await screen.findByText("Ship the deck");
        return user;
    };

    it("says why from the structured fields, not the server's English sentences", async () => {
        await open();
        const why = [...document.querySelectorAll("[data-memory-why]")].map((n) => n.textContent);
        expect(why[0]).toBe(
            "From others: 18 · Active on 6 of the last 7 days · Heating up · People involved: 1"
        );
        expect(why[1]).toBe("Your own: 4 · Chat: 2 · Active on 3 of the last 7 days");
        expect(document.body.textContent).not.toContain("18 from others, on 6 of the last 7 days");
    });

    it("falls back to the English reasons only when the structured fields are missing", async () => {
        top = {
            data: TOP({
                top: [
                    {
                        taskId: 1,
                        displayId: "A-1",
                        title: "No why",
                        project: "P",
                        score: 3,
                        reasons: ["English only sentence"],
                    },
                ],
            }),
        };
        await open().catch(() => undefined);
        expect(await screen.findByText("English only sentence")).toBeTruthy();
    });

    it("draws a title as plain text, never as markup", async () => {
        top = {
            data: TOP({
                top: [
                    {
                        taskId: 1,
                        displayId: "A-1",
                        title: '<img src=x onerror="alert(1)"><b>bold</b>',
                        project: "P",
                        score: 3,
                        reasons: [],
                        why: null,
                    },
                ],
            }),
        };
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        const item = await screen.findByText(/onerror/);
        expect(item.textContent).toBe('<img src=x onerror="alert(1)"><b>bold</b>');
        expect(document.querySelector("[data-memory-top] img, [data-memory-top] b")).toBeNull();
    });

    it("marks a task not important with one PUT, keeps the row with Undo, and Undo clears it", async () => {
        const user = await open();
        const row = document.querySelector("[data-memory-item='8100']") as HTMLElement;
        await user.click(
            within(row).getByRole("button", {
                name: /Mark as not important: WRD-101 Fix the login/,
            })
        );
        expect(api.put).toHaveBeenCalledTimes(1);
        expect(api.put).toHaveBeenCalledWith(
            "/user/memory/marks/8100/",
            { mark: "not_important" },
            { suppressErrorToast: true, params: { team_id: "team-1" } }
        );
        expect(await within(row).findByText(c.noticed.markedNote)).toBeTruthy();
        // The stored count moved by the one mark, without another request.
        expect(
            document.querySelector("[data-memory-stored-row=importance]")!.textContent
        ).toContain("Tasks you marked: 2");
        expect(memoryCalls().filter(([url]) => url === "/user/memory/")).toHaveLength(1);

        await user.click(within(row).getByRole("button", { name: /Undo: WRD-101/ }));
        expect(api.delete).toHaveBeenCalledWith("/user/memory/marks/8100/", {
            suppressErrorToast: true,
            params: { team_id: "team-1" },
        });
        expect(
            await within(row).findByRole("button", { name: /Mark as not important/ })
        ).toBeTruthy();
        expect(within(row).queryByText(c.noticed.markedNote)).toBeNull();
        expect(
            document.querySelector("[data-memory-stored-row=importance]")!.textContent
        ).toContain("Tasks you marked: 1");
    });

    it("409 recording_off: the list stays, the row says so, nothing is claimed saved, the page flips to off", async () => {
        api.put.mockRejectedValue(reject(409, "recording_off"));
        const user = await open();
        const row = document.querySelector("[data-memory-item='8100']") as HTMLElement;
        await user.click(within(row).getByRole("button", { name: /Mark as not important/ }));
        expect(await within(row).findByRole("alert")).toHaveProperty(
            "textContent",
            c.noticed.markRecordingOff
        );
        expect(within(row).queryByText(c.noticed.markedNote)).toBeNull();
        await waitFor(() =>
            expect(document.querySelector("[data-memory-recording=off]")).not.toBeNull()
        );
        // The list is still there (not pulled away), says recording is off, and its buttons rest.
        expect(document.querySelector("[data-memory-item='8101']")).not.toBeNull();
        expect(
            within(document.querySelector("[data-memory-noticed]") as HTMLElement).getAllByText(
                c.noticed.recordingOff
            ).length
        ).toBeGreaterThan(0);
        for (const button of within(
            document.querySelector("[data-memory-top]") as HTMLElement
        ).getAllByRole("button")) {
            expect((button as HTMLButtonElement).disabled).toBe(true);
        }
    });

    it("404: the task can no longer be opened, so it says it can't be marked", async () => {
        api.put.mockRejectedValue(reject(404));
        const user = await open();
        const row = document.querySelector("[data-memory-item='8101']") as HTMLElement;
        await user.click(within(row).getByRole("button", { name: /Mark as not important/ }));
        expect(await within(row).findByRole("alert")).toHaveProperty(
            "textContent",
            c.noticed.markGone
        );
        expect(within(row).queryByText(c.noticed.markedNote)).toBeNull();
    });

    it("any other failure says it did not save and keeps the button", async () => {
        api.put.mockRejectedValue(reject(500));
        const user = await open();
        const row = document.querySelector("[data-memory-item='8101']") as HTMLElement;
        await user.click(within(row).getByRole("button", { name: /Mark as not important/ }));
        expect(await within(row).findByRole("alert")).toHaveProperty(
            "textContent",
            c.noticed.markFailed
        );
        expect(within(row).getByRole("button", { name: /Mark as not important/ })).toBeTruthy();
    });

    it("shows at most two suggestions, in the member's words, as suggestions only", async () => {
        const many = Array.from({ length: 4 }, (_, i) => ({
            kind: i % 2 ? "review_priority" : "raise_priority",
            taskId: 9000 + i,
            displayId: `S-${i}`,
            title: `Suggested ${i}`,
            priority: i % 2 ? "High" : "Low",
            suggestion: "english sentence",
        }));
        top = { data: TOP({ suggestions: many }) };
        await open();
        const list = document.querySelector("[data-memory-suggestions]") as HTMLElement;
        expect(list.querySelectorAll("li")).toHaveLength(2);
        expect(list.textContent).toContain("Busy this week, but its priority is Low. Raise it?");
        expect(list.textContent).toContain("Its priority is High, but nothing has happened");
        expect(list.textContent).not.toContain("english sentence");
        // Never applied and nothing to press: no button inside, no write sent.
        expect(within(list).queryAllByRole("button")).toHaveLength(0);
        for (const fn of [api.put, api.patch, api.delete]) expect(fn).not.toHaveBeenCalled();
    });

    it("lists the tasks already marked, each clearable, and says the list is stale afterwards", async () => {
        const user = await open();
        const marks = document.querySelector("[data-memory-marks]") as HTMLElement;
        expect(marks.textContent).toContain("WRD-9 Old marked task");
        await user.click(within(marks).getByRole("button", { name: /Clear the mark on WRD-9/ }));
        expect(api.delete).toHaveBeenCalledWith("/user/memory/marks/8097/", {
            suppressErrorToast: true,
            params: { team_id: "team-1" },
        });
        await waitFor(() => expect(document.querySelector("[data-memory-marks]")).toBeNull());
        expect(await screen.findByText(c.noticed.stale)).toBeTruthy();
        // The refresh is the only thing that ranks again.
        await user.click(screen.getByRole("button", { name: c.noticed.refresh }));
        await waitFor(() =>
            expect(memoryCalls().filter(([url]) => url === "/user/memory/top/")).toHaveLength(2)
        );
    });

    it("says it plainly when little history exists and when nothing stands out", async () => {
        top = { data: TOP({ history: "none", top: [], suggestions: [] }) };
        await open().catch(() => undefined);
        expect(await screen.findByText(c.noticed.empty)).toBeTruthy();
        expect(screen.getByText(c.noticed.thin)).toBeTruthy();
    });

    it("a failed ranking says so with a retry; it is not shown as 'nothing stands out'", async () => {
        top = { status: 500 };
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        expect(await screen.findByText(c.noticed.loadFailed)).toBeTruthy();
        expect(screen.queryByText(c.noticed.empty)).toBeNull();
    });
});

describe("how Genos weighs things", () => {
    const pick = async (
        user: ReturnType<typeof userEvent.setup>,
        signal: string,
        level: RegExp
    ) => {
        const row = document.querySelector(`[data-memory-signal=${signal}]`) as HTMLElement;
        await user.click(within(row).getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: level }));
    };

    it("shows all eight signals with the app's own words, and the current level", async () => {
        renderSections();
        await ready();
        const rows = [...document.querySelectorAll("[data-memory-signal]")];
        expect(rows.map((r) => r.getAttribute("data-memory-signal"))).toEqual(SIGNALS);
        const chat = document.querySelector("[data-memory-signal=chat]") as HTMLElement;
        expect(chat.textContent).toContain(c.signals.chat.name);
        expect(chat.textContent).toContain(c.signals.chat.means);
        expect(chat.textContent).not.toContain("API chat");
        expect(within(chat).getByRole("combobox").textContent).toBe(c.levels.off.name);
    });

    it("one PATCH per change with the signal and level, and the control shows what the server answered", async () => {
        api.patch.mockResolvedValue({
            data: { tuning: tuningRows({ chat: "off", notes: "high" }) },
        });
        const user = userEvent.setup();
        renderSections();
        await ready();
        await pick(user, "notes", /Count more/);
        expect(api.patch).toHaveBeenCalledTimes(1);
        expect(api.patch).toHaveBeenCalledWith(
            "/user/memory/tuning/",
            { weights: { notes: "high" } },
            { suppressErrorToast: true, params: { team_id: "team-1" } }
        );
        await waitFor(() =>
            expect(
                within(
                    document.querySelector("[data-memory-signal=notes]") as HTMLElement
                ).getByRole("combobox").textContent
            ).toBe(c.levels.high.name)
        );
    });

    it("a refused change keeps the old level and says why (409 recording_off)", async () => {
        api.patch.mockRejectedValue(reject(409, "recording_off"));
        const user = userEvent.setup();
        renderSections();
        await ready();
        await pick(user, "notes", /Count more/);
        expect(await screen.findAllByText(c.tuning.recordingOff)).not.toHaveLength(0);
        expect(
            within(document.querySelector("[data-memory-signal=notes]") as HTMLElement).getByRole(
                "combobox"
            ).textContent
        ).toBe(c.levels.normal.name);
    });

    it("Reset to default sends one DELETE and every row goes back to Normal", async () => {
        api.delete.mockResolvedValue({ data: { tuning: tuningRows() } });
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.tuning.reset }));
        expect(api.delete).toHaveBeenCalledWith("/user/memory/tuning/", {
            suppressErrorToast: true,
            params: { team_id: "team-1" },
        });
        await waitFor(() =>
            expect(
                within(
                    document.querySelector("[data-memory-signal=chat]") as HTMLElement
                ).getByRole("combobox").textContent
            ).toBe(c.levels.normal.name)
        );
        expect(
            (screen.getByRole("button", { name: c.tuning.reset }) as HTMLButtonElement).disabled
        ).toBe(true);
    });

    it("Reset is disabled while everything is already normal", async () => {
        overview = { data: OVERVIEW({ tuning: tuningRows(), marks: [] }) };
        renderSections();
        await ready();
        expect(
            (screen.getByRole("button", { name: c.tuning.reset }) as HTMLButtonElement).disabled
        ).toBe(true);
    });
});

describe("delete", () => {
    const FORGET = (what: string, deleted: Record<string, number>) => ({
        data: { what, deleted, stored: EMPTY_STORED },
    });
    const press = async (user: ReturnType<typeof userEvent.setup>, what: string) => {
        await user.click(
            document.querySelector(`[data-memory-delete-button=${what}]`) as HTMLButtonElement
        );
        return screen.findByRole("alertdialog");
    };

    it.each([
        ["importance", c.remove.importance, { marks: 1, tunedSignals: 1 }, "Deleted 2."],
        ["summaries", c.remove.summaries, { summaries: 3 }, "Deleted 3."],
        ["events", c.remove.events, { events: 2 }, "Deleted 2."],
    ] as const)(
        "%s: confirms in words first, sends nothing until confirmed, then says what went",
        async (what, words, deleted, result) => {
            api.delete.mockResolvedValue(FORGET(what, deleted));
            const user = userEvent.setup();
            renderSections();
            await ready();
            const dialog = await press(user, what);
            expect(within(dialog).getByText(words.title)).toBeTruthy();
            expect(within(dialog).getByText(words.body)).toBeTruthy();
            expect(api.delete).not.toHaveBeenCalled();
            await user.click(within(dialog).getByRole("button", { name: words.confirm }));
            expect(api.delete).toHaveBeenCalledTimes(1);
            expect(api.delete).toHaveBeenCalledWith(`/user/memory/${what}/`, {
                suppressErrorToast: true,
            });
            expect(await screen.findByText(result)).toBeTruthy();
            // The stored words follow what the server says is left.
            await waitFor(() =>
                expect(
                    document.querySelector("[data-memory-stored-row=activity]")!.textContent
                ).toBe(c.stored.empty)
            );
        }
    );

    it("each confirmation says what stays: the others kinds, or tasks/notes/chat", () => {
        // The words are the contract with the member: pin the sentences that say what stays.
        expect(c.remove.importance.body).toMatch(/daily summaries and activity record stay/);
        expect(c.remove.summaries.body).toMatch(/marks, levels and activity record stay/);
        expect(c.remove.summaries.body).toMatch(/records again from tomorrow/);
        expect(c.remove.events.body).toMatch(/daily summaries, marks and levels stay/);
        expect(c.remove.everything.body).toMatch(/Recording stays as it is/);
        expect(c.remove.stays).toMatch(/tasks, notes, chat/);
        expect(c.remove.stays).toMatch(/recording switch/);
    });

    it("cancelling deletes nothing", async () => {
        const user = userEvent.setup();
        renderSections();
        await ready();
        const dialog = await press(user, "events");
        await user.click(within(dialog).getByRole("button", { name: en.common.actions.cancel }));
        expect(api.delete).not.toHaveBeenCalled();
    });

    it("everything needs the acknowledgement, deletes all three kinds, and clears marks and levels on screen", async () => {
        api.delete.mockResolvedValue(
            FORGET("everything", { events: 2, summaries: 3, marks: 1, tunedSignals: 1 })
        );
        const user = userEvent.setup();
        renderSections();
        await ready();
        const dialog = await press(user, "everything");
        const confirm = within(dialog).getByRole("button", { name: c.remove.everything.confirm });
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
        await user.click(within(dialog).getByRole("checkbox", { name: c.remove.ack }));
        await user.click(confirm);
        expect(api.delete).toHaveBeenCalledWith("/user/memory/everything/", {
            suppressErrorToast: true,
        });
        expect(await screen.findByText("Deleted 7.")).toBeTruthy();
        await waitFor(() =>
            expect(
                within(
                    document.querySelector("[data-memory-signal=chat]") as HTMLElement
                ).getByRole("combobox").textContent
            ).toBe(c.levels.normal.name)
        );
    });

    it("a delete that took nothing says nothing was stored, not 'Deleted 0'", async () => {
        api.delete.mockResolvedValue(FORGET("events", { events: 0 }));
        const user = userEvent.setup();
        renderSections();
        await ready();
        const dialog = await press(user, "events");
        await user.click(within(dialog).getByRole("button", { name: c.remove.events.confirm }));
        expect(await screen.findByText(c.remove.nothing)).toBeTruthy();
        expect(screen.queryByText(/Deleted 0/)).toBeNull();
    });

    it("a failed delete says so in the dialog, keeps it open, and claims nothing was deleted", async () => {
        api.delete.mockRejectedValue(reject(500));
        const user = userEvent.setup();
        renderSections();
        await ready();
        const dialog = await press(user, "summaries");
        await user.click(within(dialog).getByRole("button", { name: c.remove.summaries.confirm }));
        expect(await within(dialog).findByText(c.remove.failed)).toBeTruthy();
        expect(screen.queryByText(/^Deleted/)).toBeNull();
        expect(
            document.querySelector("[data-memory-stored-row=summaries]")!.textContent
        ).toContain("Saved: 3");
    });
});

describe("the page", () => {
    const page = () => (
        <I18nProvider>
            <CssVarsProvider>
                <GenosMemoryPage teamId="team-1" />
            </CssVarsProvider>
        </I18nProvider>
    );

    it("puts the controls under the existing recording switch, and reads again when it moves", async () => {
        api.patch.mockResolvedValue({ data: { member_events_enabled: false } });
        const user = userEvent.setup();
        render(page());
        await ready();
        expect(screen.getAllByRole("switch").length).toBeGreaterThan(0);
        const before = memoryCalls().filter(([url]) => url === "/user/memory/").length;
        // Turning the switch off deletes what was stored, so the numbers are read again.
        overview = {
            data: OVERVIEW({ recording: { enabled: false }, stored: EMPTY_STORED, marks: [] }),
        };
        const noteSwitch = screen.getByRole("switch", {
            name: en.settings.genosMemory.mcpUse.switchLabel,
        });
        await waitFor(() => expect((noteSwitch as HTMLInputElement).disabled).toBe(false));
        await user.click(noteSwitch);
        await user.click(
            await screen.findByRole("button", { name: en.settings.genosMemory.mcpUse.offConfirm })
        );
        await waitFor(() =>
            expect(memoryCalls().filter(([url]) => url === "/user/memory/").length).toBe(
                before + 1
            )
        );
        await waitFor(() =>
            expect(document.querySelector("[data-memory-recording=off]")).not.toBeNull()
        );
        expect(document.querySelector("[data-memory-stored-row=activity]")!.textContent).toBe(
            c.stored.empty
        );
    });

    it("a failed switch does not re-read (nothing changed)", async () => {
        api.patch.mockRejectedValue(reject(500));
        const user = userEvent.setup();
        render(page());
        await ready();
        const before = memoryCalls().length;
        const noteSwitch = screen.getByRole("switch", {
            name: en.settings.genosMemory.mcpUse.switchLabel,
        });
        await waitFor(() => expect((noteSwitch as HTMLInputElement).disabled).toBe(false));
        await user.click(noteSwitch);
        await user.click(
            await screen.findByRole("button", { name: en.settings.genosMemory.mcpUse.offConfirm })
        );
        await screen.findAllByText(en.settings.genosMemory.mcpUse.toggleFailed);
        expect(memoryCalls()).toHaveLength(before);
    });
});

describe("in Japanese", () => {
    it("says the labels, reasons and the delete confirmation in the member's language", async () => {
        await loadLocale("ja");
        localStorage.setItem("genos-locale", "ja");
        const user = userEvent.setup();
        render(
            <I18nProvider>
                <CssVarsProvider>
                    <MemoryControlSections accessToken="tok" refreshKey={0} teamId="team-1" />
                </CssVarsProvider>
            </I18nProvider>
        );
        const m = ja.settings!.genosMemory!.control!;
        await screen.findByText(m.stored!.heading!);
        await user.click(screen.getByRole("button", { name: m.noticed!.show! }));
        await screen.findByText("Ship the deck");
        const why = document.querySelector("[data-memory-why]")!.textContent!;
        expect(why).toContain("他の人: 18");
        expect(why).toContain("直近 7 日のうち 6 日で動きあり");
        expect(why).not.toMatch(/From others|Heating up/);
        expect(document.querySelector("[data-memory-signal=chat]")!.textContent).toContain(
            m.signals!.chat!.name!
        );
        await user.click(
            document.querySelector("[data-memory-delete-button=events]") as HTMLButtonElement
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(m.remove!.events!.body!)).toBeTruthy();
        localStorage.removeItem("genos-locale");
        await loadLocale("en");
    });
});

const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    let rejectIt!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        rejectIt = rej;
    });
    return { promise, resolve, reject: rejectIt };
};

describe("answers that arrive late or out of order", () => {
    it("a re-read for the same team updates in place: an open confirmation and the sections stay mounted", async () => {
        const user = userEvent.setup();
        const view = render(sections());
        await ready();
        await user.click(
            document.querySelector("[data-memory-delete-button=events]") as HTMLElement
        );
        await screen.findByRole("alertdialog");
        // The recording switch above moved: the page asks for the overview again, and the
        // answer is slow.
        const slow = deferred<{ data: unknown }>();
        api.get.mockImplementation(async (url: string) => {
            if (url === "/user/memory/") return slow.promise;
            throw new Error(`unexpected GET ${url}`);
        });
        view.rerender(
            <CssVarsProvider>
                <MemoryControlSections accessToken="tok" refreshKey={1} teamId="team-1" />
            </CssVarsProvider>
        );
        await waitFor(() => expect(memoryCalls().length).toBeGreaterThan(1));
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        expect(document.querySelector("[data-memory-stored]")).not.toBeNull();
        slow.resolve({
            data: OVERVIEW({ recording: { enabled: false }, stored: EMPTY_STORED, marks: [] }),
        });
        await waitFor(() =>
            expect(document.querySelector("[data-memory-recording=off]")).not.toBeNull()
        );
        expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    it("a level saved after the member switched team is not merged into the other team's page", async () => {
        const slowPatch = deferred<{ data: unknown }>();
        api.patch.mockReturnValue(slowPatch.promise);
        const user = userEvent.setup();
        const view = render(sections());
        await ready();
        const row = document.querySelector("[data-memory-signal=notes]") as HTMLElement;
        await user.click(within(row).getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /Count more/ }));
        // Team B has its own levels.
        overview = { data: OVERVIEW({ tuning: tuningRows({ prs: "low" }), marks: [] }) };
        view.rerender(
            <CssVarsProvider>
                <MemoryControlSections accessToken="tok" refreshKey={0} teamId="team-2" />
            </CssVarsProvider>
        );
        await waitFor(() =>
            expect(
                within(
                    document.querySelector("[data-memory-signal=prs]") as HTMLElement
                ).getByRole("combobox").textContent
            ).toBe(c.levels.low.name)
        );
        slowPatch.resolve({ data: { tuning: tuningRows({ chat: "off", notes: "high" }) } });
        await new Promise((r) => setTimeout(r, 50));
        const levels = Object.fromEntries(
            [...document.querySelectorAll("[data-memory-signal]")].map((n) => [
                n.getAttribute("data-memory-signal"),
                within(n as HTMLElement).getByRole("combobox").textContent,
            ])
        );
        expect(levels.notes).toBe(c.levels.normal.name);
        expect(levels.chat).toBe(c.levels.normal.name);
        expect(levels.prs).toBe(c.levels.low.name);
    });

    it("a ranking that was on its way when a level changed does not clear the out-of-date note", async () => {
        const slowTop = deferred<{ data: unknown }>();
        api.get.mockImplementation(async (url: string) => {
            if (url === "/user/memory/") return answer(overview);
            if (url === "/user/memory/top/") return slowTop.promise;
            throw new Error(`unexpected GET ${url}`);
        });
        api.patch.mockResolvedValue({
            data: { tuning: tuningRows({ chat: "off", notes: "high" }) },
        });
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        const row = document.querySelector("[data-memory-signal=notes]") as HTMLElement;
        await user.click(within(row).getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /Count more/ }));
        await waitFor(() => expect(api.patch).toHaveBeenCalled());
        slowTop.resolve({ data: TOP() });
        await screen.findByText("Ship the deck");
        expect(await screen.findByText(c.noticed.stale)).toBeTruthy();
    });

    it("Undo puts back the mark the task had before, instead of clearing it", async () => {
        overview = {
            data: OVERVIEW({
                marks: [
                    {
                        taskId: 8100,
                        displayId: "WRD-101",
                        title: "Fix",
                        mark: "priority_is_right",
                    },
                ],
            }),
        };
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(screen.getByRole("button", { name: c.noticed.show }));
        await screen.findByText("Ship the deck");
        const row = document.querySelector("[data-memory-item='8100']") as HTMLElement;
        await user.click(within(row).getByRole("button", { name: /Mark as not important/ }));
        await within(row).findByText(c.noticed.markedNote);
        await user.click(within(row).getByRole("button", { name: /Undo/ }));
        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
        expect(api.put).toHaveBeenLastCalledWith(
            "/user/memory/marks/8100/",
            { mark: "priority_is_right" },
            { suppressErrorToast: true, params: { team_id: "team-1" } }
        );
        expect(api.delete).not.toHaveBeenCalled();
    });

    it("a delete whose answer does not say what is left is a failure, not 'nothing is stored'", async () => {
        api.delete.mockResolvedValue({ data: { what: "events", deleted: { events: 2 } } });
        const user = userEvent.setup();
        renderSections();
        await ready();
        await user.click(
            document.querySelector("[data-memory-delete-button=events]") as HTMLElement
        );
        const dialog = await screen.findByRole("alertdialog");
        await user.click(within(dialog).getByRole("button", { name: c.remove.events.confirm }));
        expect(await within(dialog).findByText(c.remove.failed)).toBeTruthy();
        expect(document.querySelector("[data-memory-stored-row=activity]")!.textContent).toContain(
            "Entries: 2"
        );
    });
});

describe("the contract readers", () => {
    it("refuse what is not the shape the server sends rather than drawing it", () => {
        expect(parseOverview(null)).toBeNull();
        expect(parseOverview({ recording: { enabled: "yes" }, stored: {} })).toBeNull();
        expect(parseTop({ enabled: "yes" })).toBeNull();
        const o = parseOverview(OVERVIEW({ marks: [{ taskId: "x", title: 5 }, null] }))!;
        expect(o.marks).toEqual([]);
        // A forged count is a plain 0, never a string or a negative.
        const stored = parseOverview(
            OVERVIEW({
                stored: { ...STORED, ledger: { ...STORED.ledger, entries: "999", aiApp: -3 } },
            })
        )!.stored;
        expect(stored.ledger.entries).toBe(0);
        expect(stored.ledger.aiApp).toBe(0);
    });

    it("recording off is a state of the ranking, with nothing in it", () => {
        expect(
            parseTop({ enabled: false, note: "x", top: [{ taskId: 1 }], suggestions: [] })
        ).toEqual({
            enabled: false,
        });
    });

    it("builds a reason only from what is non-zero, with no plural forms", () => {
        const why = {
            counts: { others: 0, mine: 0, chat: 0, notes: 0, prs: 3 },
            days: 0,
            trend: "quiet",
            people: 0,
        };
        expect(whyPhrases(why, c.why)).toEqual(["Pull requests: 3"]);
        expect(whyPhrases({ ...why, counts: {} }, c.why)).toEqual([]);
        expect(
            suggestionText(
                {
                    kind: "future_kind",
                    taskId: 1,
                    displayId: "A",
                    title: "t",
                    priority: "Low",
                    text: "fallback text",
                },
                "Low",
                c.noticed
            )
        ).toBe("fallback text");
    });
});
