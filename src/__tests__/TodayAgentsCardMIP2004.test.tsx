/**
 * MIP-2004: the "Your agents today" card on the Today tab. The summary of the `sessions` block, the
 * one request, the card hidden without activity (and on every failure), the click, and the copy in
 * all seven locales. Layout at 390 and 1440 px is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAgentsToday, summariseSessions } from "../features/today/agentsToday";
import { TodayAgentsCard } from "../features/today/TodayAgentsCard";
import { useAgentsToday } from "../features/today/useAgentsToday";
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

const session = (over: Record<string, unknown> = {}) => ({
    run_id: "r1",
    agent: "claude",
    changed: 3,
    decided: 1,
    refused: 0,
    items_changed: 2,
    items: [
        { type: "task", id: 1, changed: true },
        { type: "task", id: 2, changed: true },
        { type: "note", id: "task:9", changed: false },
    ],
    ...over,
});

const answer = (items: unknown[]) => ({ sessions: { items, total: items.length } });

const mockGet = (impl: () => Promise<unknown>) => {
    const get = vi.fn(impl);
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return get;
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("summariseSessions", () => {
    it("is null with no sessions, no block or junk", () => {
        expect(summariseSessions(answer([]))).toBeNull();
        expect(summariseSessions({})).toBeNull();
        expect(summariseSessions(null)).toBeNull();
        expect(summariseSessions({ sessions: { items: "x" } })).toBeNull();
    });

    it("sums sessions, changes, decisions and refusals, and counts distinct changed items", () => {
        const sum = summariseSessions(
            answer([
                session(),
                session({
                    run_id: "r2",
                    agent: "chatgpt",
                    changed: 5,
                    decided: 1,
                    refused: 1,
                    items_changed: 1,
                    items: [{ type: "task", id: 2, changed: true }],
                }),
            ])
        );
        expect(sum).toEqual({
            agents: ["claude", "chatgpt"],
            sessions: 2,
            changes: 8,
            itemsChanged: 2,
            decisions: 2,
            refused: 1,
        });
    });

    it("drops the item count when a long session listed fewer items than it changed", () => {
        const sum = summariseSessions(answer([session({ items_changed: 40 })]));
        expect(sum?.itemsChanged).toBeNull();
        expect(sum?.changes).toBe(3);
    });
});

describe("loadAgentsToday", () => {
    it("asks once, for one day and one row", async () => {
        const get = mockGet(async () => ({ data: answer([session()]) }));
        const result = await loadAgentsToday("tok", "team-1");
        expect(result.status).toBe("ok");
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith(
            "/agent/work/",
            expect.objectContaining({ params: { team_id: "team-1", days: 1, limit: 1 } })
        );
    });

    it("maps a 404 to unavailable and anything else to error", async () => {
        const notFound = Object.assign(new Error("x"), {
            isAxiosError: true,
            response: { status: 404 },
        });
        mockGet(async () => {
            throw notFound;
        });
        expect((await loadAgentsToday("tok", "t")).status).toBe("unavailable");
        mockGet(async () => {
            throw new Error("boom");
        });
        expect((await loadAgentsToday("tok", "t")).status).toBe("error");
    });
});

describe("useAgentsToday", () => {
    it("gives the summary, and null on failure", async () => {
        mockGet(async () => ({ data: answer([session()]) }));
        const ok = renderHook(() => useAgentsToday("tok", "team-1"));
        await waitFor(() => expect(ok.result.current?.sessions).toBe(1));

        mockGet(async () => {
            throw new Error("boom");
        });
        const bad = renderHook(() => useAgentsToday("tok", "team-1"));
        await new Promise((r) => setTimeout(r, 10));
        expect(bad.result.current).toBeNull();
    });

    it("does not ask without a team", () => {
        const get = mockGet(async () => ({ data: {} }));
        renderHook(() => useAgentsToday("tok", null));
        expect(get).not.toHaveBeenCalled();
    });
});

describe("TodayAgentsCard", () => {
    const renderCard = (data: Parameters<typeof TodayAgentsCard>[0]["data"]) =>
        render(
            <CssVarsProvider>
                <TodayAgentsCard data={data} />
            </CssVarsProvider>
        );

    it("renders nothing without activity", () => {
        renderCard(null);
        expect(screen.queryByTestId("today-agents")).toBeNull();
        renderCard({
            agents: [],
            sessions: 0,
            changes: 0,
            itemsChanged: null,
            decisions: 0,
            refused: 0,
        });
        expect(screen.queryByTestId("today-agents")).toBeNull();
    });

    it("shows the counts, hides zero ones, and opens the Agent Activity tab", () => {
        renderCard({
            agents: ["claude"],
            sessions: 3,
            changes: 24,
            itemsChanged: 4,
            decisions: 2,
            refused: 0,
        });
        expect(screen.getByText("Your agents today")).toBeTruthy();
        expect(screen.getByText("Claude")).toBeTruthy();
        expect(screen.getByTestId("today-agents-sessions").textContent).toContain("3");
        expect(screen.getByTestId("today-agents-changes").textContent).toContain("24");
        expect(screen.getByTestId("today-agents-decisions").textContent).toContain("2");
        expect(screen.queryByTestId("today-agents-refused")).toBeNull();
        fireEvent.click(screen.getByTestId("today-agents-open"));
        expect(navigate).toHaveBeenCalledWith("/workspace/tasks?view=agent");
    });
});

describe("copy", () => {
    it.each([
        ["en", en],
        ["ja", ja],
        ["zh", zh],
        ["es", es],
        ["fr", fr],
        ["hi", hi],
        ["ar", ar],
    ])("has the card strings in %s", (_name, locale) => {
        const a = locale.tasks?.dashboard?.today?.agents as Record<string, string>;
        for (const key of [
            "title",
            "sessions",
            "changes",
            "decisions",
            "refused",
            "open",
        ] as const) {
            expect(a[key]?.length).toBeGreaterThan(0);
        }
    });
});
