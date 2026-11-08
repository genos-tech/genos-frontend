/**
 * MIP-1227: render budget of the AI footer on a long Inbox.
 *
 * The footer sits BESIDE the memoized report card, so switching a source never draws a card's
 * body again; a switch commits only the footers of that source; and an Inbox re-render that hands
 * the same item costs the footer nothing. Counted with a Profiler per footer and a spy on the
 * report parser (one parse per body object).
 */

import { Profiler } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { resetInboxAiStore } from "../features/inbox/inboxAiStore";
import { parseGenosReportV2 } from "../features/inbox/utils/genosReportV2";
import type { InboxItemProps } from "../types/common";

const calls = vi.hoisted(() => ({ switch: vi.fn() }));

vi.mock("../features/inbox/utils/genosReportV2", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/inbox/utils/genosReportV2")>();
    return { ...actual, parseGenosReportV2: vi.fn(actual.parseGenosReportV2) };
});
vi.mock("../features/inbox/services/inboxAi", () => ({
    switchInboxAi: (...args: unknown[]) => calls.switch(...args),
}));
vi.mock("../features/inbox/services/patchInboxAiSource", () => ({
    patchInboxAiSource: () => Promise.resolve(),
}));
vi.mock("../components/editors/bnChatPreview", () => ({ BnChatPreview: () => <div /> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const AI = {
    request_id: "",
    credits_milli: 1830,
    deducted_credits_milli: 0,
    calls: 1,
    lower_bound: false,
    metered: true,
};
const SID = (n: number) => `11111111-1111-4111-8111-11111111111${n}`;

const item = (id: number, schedule: number | null): InboxItemProps =>
    ({
        itemId: id,
        itemType: 10,
        itemBody: { version: 2, title: `r${id}`, text: "s", sections: [] },
        isRead: false,
        requestStatus: "",
        tsSent: "2026-11-09T00:00:00Z",
        itemOptionals: {
            ai: { ...AI, producer: "schedule" },
            schedule_id: SID(schedule ?? 0),
        },
        aiSource: {
            kind: "schedule",
            enabled: true,
            label: `Plan ${schedule}`,
            schedule_id: SID(schedule ?? 0),
        },
    }) as never;

const commits: Record<string, number> = {};
const Counted = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <Profiler
        id={id}
        onRender={() => {
            commits[id] = (commits[id] ?? 0) + 1;
        }}
    >
        {children}
    </Profiler>
);

const list = (items: InboxItemProps[]) => (
    <CssVarsProvider>
        <MemoryRouter>
            {items.map((it) => (
                <div key={it.itemId} data-testid={`row-${it.itemId}`}>
                    <Counted id={`bubble-${it.itemId}`}>
                        <InboxBubble
                            inboxItem={it}
                            myself={{ userId: "u1", teamId: "t1" } as never}
                            setMyself={vi.fn()}
                            socket={null}
                            useCM={{ allChats: [] } as never}
                            useTEM={{ teamMemberProfiles: {} } as never}
                            useUISM={{} as never}
                        />
                    </Counted>
                </div>
            ))}
        </MemoryRouter>
    </CssVarsProvider>
);

describe("AI footer render budget", () => {
    beforeEach(() => {
        resetInboxAiStore();
        calls.switch.mockReset();
        vi.mocked(parseGenosReportV2).mockClear();
        for (const k of Object.keys(commits)) delete commits[k];
    });

    it("a switch re-draws no report body, and only the cards of that source commit", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const items = [item(1, 1), item(2, 1), item(3, 2)];
        render(list(items));
        expect(parseGenosReportV2).toHaveBeenCalledTimes(3);
        for (const k of Object.keys(commits)) delete commits[k];

        fireEvent.click(
            within(screen.getByTestId("row-1")).getByRole("button", { name: /turn this off/i })
        );
        await waitFor(() =>
            expect(
                within(screen.getByTestId("row-2")).getByRole("button", { name: /turn back on/i })
            ).toBeTruthy()
        );
        // The bodies were not parsed or drawn again.
        expect(parseGenosReportV2).toHaveBeenCalledTimes(3);
        // Cards of the other schedule never committed again (the Profiler wraps the whole
        // bubble, so any re-render of it, footer or body, would count).
        expect(commits["bubble-3"] ?? 0).toBe(0);
        // The two of the switched source did, to show the new state, and not in a storm.
        expect(commits["bubble-2"]).toBeGreaterThan(0);
        expect(commits["bubble-2"]).toBeLessThanOrEqual(3);
    });

    it("an Inbox re-render that hands the same items costs nothing", () => {
        const items = [item(1, 1), item(2, 2)];
        const view = render(list(items));
        expect(parseGenosReportV2).toHaveBeenCalledTimes(2);
        view.rerender(list(items));
        expect(parseGenosReportV2).toHaveBeenCalledTimes(2);
    });
});
