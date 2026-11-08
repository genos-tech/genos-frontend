/**
 * MIP-1227: the AI usage line and "Turn this off" on an AI-made Inbox card (the card half of
 * genos-api MIP-1209).
 *
 * The gate is the security-relevant part: `itemOptionals` is a free-form blob a teammate can
 * write on an ordinary item filed to the member, so nothing is drawn unless the item type, the
 * `ai.producer` and the `aiSource.kind` all agree. Each leg of that gate has its own test, and
 * each was mutation-checked (revert the check, see the test fail).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiUsageFooter, costText } from "../features/inbox/components/AiUsageFooter";
import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { resetInboxAiStore } from "../features/inbox/inboxAiStore";
import { readAiUsage } from "../features/inbox/utils/inboxAi";
import { en } from "../i18n/locales/en";
import type { InboxItemProps } from "../types/common";

const calls = vi.hoisted(() => ({
    switch: vi.fn(),
    patch: vi.fn(),
}));

vi.mock("../features/inbox/services/inboxAi", () => ({
    switchInboxAi: (...args: unknown[]) => calls.switch(...args),
}));
vi.mock("../features/inbox/services/patchInboxAiSource", () => ({
    patchInboxAiSource: (...args: unknown[]) => calls.patch(...args),
}));
vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const AI = {
    producer: "digest",
    request_id: "5d0a4c0e-3c64-4e4e-9a53-2b8c0d6d2f11",
    credits_milli: 1830,
    deducted_credits_milli: 0,
    calls: 7,
    lower_bound: false,
    metered: true,
};

const digest = (over: Partial<InboxItemProps> = {}, ai: Record<string, unknown> = {}) => ({
    itemId: 812,
    itemType: 6,
    itemOptionals: { cadence: "weekly", ai: { ...AI, ...ai } },
    aiSource: { kind: "digest", enabled: true, label: "Genos digest", used_ai: true },
    ...over,
});

const report = (over: Partial<InboxItemProps> = {}, ai: Record<string, unknown> = {}) => ({
    itemId: 90,
    itemType: 10,
    itemOptionals: {
        schedule_id: "11111111-1111-4111-8111-111111111111",
        ai: { ...AI, producer: "schedule", ...ai },
    },
    aiSource: {
        kind: "schedule",
        enabled: true,
        label: "Morning plan",
        schedule_id: "11111111-1111-4111-8111-111111111111",
        used_ai: true,
    },
    ...over,
});

const SID = "11111111-1111-4111-8111-111111111111";

/** A built-in job's report (Morning plan): no cost block, and the server says `used_ai: false`. */
const plainReport = (over: Partial<InboxItemProps> = {}) => ({
    itemId: 91,
    itemType: 10,
    itemOptionals: { kind: "schedule_report", schedule_id: SID, job: "what_to_do_today" },
    aiSource: {
        kind: "schedule",
        enabled: true,
        label: "Morning plan",
        schedule_id: SID,
        used_ai: false,
    },
    ...over,
});

describe("readAiUsage: the gate", () => {
    it("reads a digest and a report", () => {
        expect(readAiUsage(digest() as never)?.source?.key).toBe("digest");
        expect(readAiUsage(report() as never)?.source?.key).toBe(
            "schedule:11111111-1111-4111-8111-111111111111"
        );
    });

    it("draws nothing for an ordinary item carrying a forged ai blob (type 0)", () => {
        expect(readAiUsage(digest({ itemType: 0 }) as never)).toBeNull();
        expect(readAiUsage(report({ itemType: 0 }) as never)).toBeNull();
        // Every other non-AI type too: join requests, reminders, claims.
        for (const itemType of [1, 2, 3, 4, 5, 7, 8, 9]) {
            expect(readAiUsage(digest({ itemType }) as never)).toBeNull();
        }
    });

    it("draws nothing when the producer in the blob is not the one the item type allows", () => {
        expect(readAiUsage(digest({}, { producer: "schedule" }) as never)).toBeNull();
        expect(readAiUsage(report({}, { producer: "digest" }) as never)).toBeNull();
        expect(readAiUsage(digest({}, { producer: "anything" }) as never)).toBeNull();
    });

    it("gives no switch when the source disagrees with the item or is missing", () => {
        const noSource = readAiUsage(digest({ aiSource: undefined }) as never);
        expect(noSource?.source).toBeNull();
        expect(noSource?.cost?.metered).toBe(true); // the cost is still the server's
        expect(
            readAiUsage(
                digest({
                    aiSource: { kind: "schedule", enabled: true, label: "x" } as never,
                }) as never
            )?.source
        ).toBeNull();
        expect(
            readAiUsage(
                report({
                    aiSource: { kind: "digest", enabled: true, label: "x" } as never,
                }) as never
            )?.source
        ).toBeNull();
        // A schedule with no id cannot be keyed, so it has no switch.
        expect(
            readAiUsage(
                report({
                    aiSource: { kind: "schedule", enabled: true, label: "x" } as never,
                }) as never
            )?.source
        ).toBeNull();
    });

    it("refuses numbers and flags that are not plain", () => {
        for (const bad of [-1, 1.5, "1830", NaN, Infinity, 5_000_000_000, null]) {
            expect(readAiUsage(digest({}, { credits_milli: bad }) as never)).toBeNull();
        }
        expect(readAiUsage(digest({}, { deducted_credits_milli: "0" }) as never)).toBeNull();
        expect(readAiUsage(digest({}, { metered: "yes" }) as never)).toBeNull();
        expect(readAiUsage(digest({ itemOptionals: { ai: "oops" } }) as never)).toBeNull();
        expect(
            readAiUsage(digest({ itemOptionals: null, aiSource: undefined }) as never)
        ).toBeNull();
        expect(readAiUsage({ itemType: 6 } as never)).toBeNull();
    });

    it("an item with no ai key and no source draws nothing", () => {
        expect(
            readAiUsage(
                digest({ itemOptionals: { cadence: "weekly" }, aiSource: undefined }) as never
            )
        ).toBeNull();
        expect(readAiUsage(plainReport({ aiSource: undefined }) as never)).toBeNull();
        expect(readAiUsage(plainReport({ aiSource: null }) as never)).toBeNull();
    });
});

describe("readAiUsage: a report that used no AI (MIP-1234)", () => {
    it("reads a block-less report whose source says used_ai false: no cost, and the switch", () => {
        const usage = readAiUsage(plainReport() as never);
        expect(usage?.cost).toBeNull();
        expect(usage?.source?.key).toBe(`schedule:${SID}`);
        expect(usage?.source?.enabled).toBe(true);
    });

    it("a block-less digest or report the server says used AI has no number, only the switch", () => {
        const d = readAiUsage(digest({ itemOptionals: { cadence: "weekly" } }) as never);
        expect(d?.cost).toEqual({ metered: false });
        expect(d?.source?.key).toBe("digest");
        const r = readAiUsage(
            plainReport({
                aiSource: {
                    kind: "schedule",
                    enabled: true,
                    label: "x",
                    schedule_id: SID,
                    used_ai: true,
                },
            } as never) as never
        );
        expect(r?.cost).toEqual({ metered: false });
    });

    it("used_ai false wins over a cost block: a charge the server does not stand behind is not shown", () => {
        const usage = readAiUsage(report({ aiSource: plainReport().aiSource as never }) as never);
        expect(usage?.cost).toBeNull();
        expect(usage?.source?.key).toBe(`schedule:${SID}`);
    });

    it("a row stored before used_ai existed keeps the old rule", () => {
        const { used_ai: _gone, ...old } = report().aiSource as Record<string, unknown>;
        void _gone;
        // With a valid block: AI, as it always was.
        expect(readAiUsage(report({ aiSource: old as never }) as never)?.cost?.metered).toBe(true);
        // Without one it says nothing: there is no flag to say "No AI used" on.
        expect(readAiUsage(plainReport({ aiSource: old as never } as never) as never)).toBeNull();
    });

    it("draws nothing when the source is not the item's own kind, or used_ai is not a boolean", () => {
        for (const bad of ["false", 0, 1, null, "no", []]) {
            const aiSource = { ...(plainReport().aiSource as object), used_ai: bad } as never;
            expect(readAiUsage(plainReport({ aiSource }) as never)).toBeNull();
            // A malformed flag spoils the source, but a valid block still draws its cost, no switch.
            const withBlock = readAiUsage(report({ aiSource }) as never);
            expect(withBlock?.source).toBeNull();
        }
        // A digest source on a report, or a report source on a digest.
        expect(
            readAiUsage(
                plainReport({
                    aiSource: { kind: "digest", enabled: true, label: "x", used_ai: false },
                } as never) as never
            )
        ).toBeNull();
        expect(
            readAiUsage(
                digest({
                    itemOptionals: {},
                    aiSource: {
                        kind: "schedule",
                        enabled: true,
                        label: "x",
                        schedule_id: SID,
                        used_ai: true,
                    },
                } as never) as never
            )
        ).toBeNull();
        // A schedule source with no id cannot be keyed.
        expect(
            readAiUsage(
                plainReport({
                    aiSource: { kind: "schedule", enabled: true, label: "x", used_ai: false },
                } as never) as never
            )
        ).toBeNull();
    });

    it("an ordinary item with a forged source and no block draws nothing", () => {
        for (const itemType of [0, 1, 2, 3, 4, 5, 7, 8, 9]) {
            expect(readAiUsage(plainReport({ itemType }) as never)).toBeNull();
            expect(
                readAiUsage(
                    digest({
                        itemType,
                        itemOptionals: {},
                        aiSource: { kind: "digest", enabled: true, label: "x", used_ai: false },
                    } as never) as never
                )
            ).toBeNull();
        }
    });

    it("a malformed block is untrusted even beside a source that says used_ai false", () => {
        expect(
            readAiUsage(
                plainReport({
                    itemOptionals: {
                        schedule_id: SID,
                        ai: { producer: "schedule", metered: "yes" },
                    },
                } as never) as never
            )
        ).toBeNull();
    });
});

describe("costText", () => {
    const c = en.inbox.aiUsage;
    const metered = (creditsMilli: number, over = {}) =>
        ({ metered: true, creditsMilli, lowerBound: false, deductedMilli: 0, ...over }) as never;

    it("uses the Plan & usage figure and says none was deducted for the digest", () => {
        expect(costText(metered(1830), c)).toBe(
            "AI credits used: 1.83 · None deducted from your balance"
        );
        expect(costText(metered(2000), c)).toBe(
            "AI credits used: 2 · None deducted from your balance"
        );
        expect(costText(metered(2500), c)).toBe(
            "AI credits used: 2.5 · None deducted from your balance"
        );
    });

    it("states a charge only when one happened", () => {
        expect(costText(metered(1830, { deductedMilli: 1830 }), c)).toBe(
            "AI credits used: 1.83 · 1.83 deducted from your balance"
        );
    });

    it("says at least when some calls were unpriced", () => {
        expect(costText(metered(1830, { lowerBound: true }), c)).toContain("at least 1.83");
    });

    it("never prints 0 for a real cost", () => {
        expect(costText(metered(3), c)).toContain("less than 0.01");
        expect(costText(metered(3, { lowerBound: true }), c)).toBe(c.unmeasured);
        // A rounding that lands on a whole number is not "1.0".
        expect(costText(metered(1004), c)).toContain("AI credits used: 1 ·");
    });

    it("an item that used no AI says so, with no figure and no balance line", () => {
        const text = costText(null, c);
        expect(text).toBe("No AI used");
        expect(text).not.toMatch(/\d|deduct|credit/i);
    });

    it("an unmetered item names no number and claims no deduction", () => {
        const text = costText({ metered: false }, c);
        expect(text).toBe(c.unmeasured);
        expect(text).not.toMatch(/\d|deduct/i);
    });
});

const tree = (ui: React.ReactNode) => (
    <CssVarsProvider>
        <MemoryRouter>{ui}</MemoryRouter>
    </CssVarsProvider>
);

const footer = (item: ReturnType<typeof digest> | ReturnType<typeof report>, userId = "u1") => (
    <AiUsageFooter
        aiSource={item.aiSource as never}
        itemId={item.itemId}
        itemOptionals={item.itemOptionals as never}
        itemType={item.itemType}
        userId={userId}
    />
);

describe("AiUsageFooter", () => {
    beforeEach(() => {
        calls.switch.mockReset();
        calls.patch.mockReset().mockResolvedValue(undefined);
        resetInboxAiStore();
    });
    afterEach(() => resetInboxAiStore());

    it("shows the cost and a Turn this off button", () => {
        const { container } = render(tree(footer(digest())));
        expect(container.querySelector("[data-ai-usage-cost]")?.textContent).toContain(
            "AI credits used: 1.83"
        );
        expect(screen.getByRole("button", { name: /turn this off/i })).toBeTruthy();
    });

    it("a report that used no AI says so and still has Turn this off", () => {
        const { container } = render(tree(footer(plainReport())));
        expect(container.querySelector("[data-ai-usage-cost]")?.textContent).toBe("No AI used");
        expect(container.textContent).not.toMatch(/credits|deduct/i);
        expect(screen.getByRole("button", { name: /turn this off: morning plan/i })).toBeTruthy();
    });

    it("turning off a report that used no AI undoes cleanly and never talks about AI credits", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const { container } = render(tree(footer(plainReport())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toBe(
                "Morning plan is off. It won't run until you turn it back on."
            )
        );
        expect(calls.switch).toHaveBeenCalledWith("tok", 91, false);
        expect(calls.patch).toHaveBeenCalledWith({
            kind: "schedule",
            scheduleId: SID,
            enabled: false,
        });
        // The cost line still says nothing was used.
        expect(container.querySelector("[data-ai-usage-cost]")?.textContent).toBe("No AI used");
        const undo = screen.getByRole("button", { name: /undo/i });
        calls.switch.mockResolvedValue({ ok: true, enabled: true, wasEnabled: false });
        fireEvent.click(undo);
        await waitFor(() => expect(screen.getByRole("status").textContent).toContain("on again"));
        expect(calls.switch).toHaveBeenLastCalledWith("tok", 91, true);
    });

    it("a report that used AI still says so in its off sentence", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        render(tree(footer(report())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toContain("or use AI credits")
        );
    });

    it("a digest the server says used AI but kept no cost says so, with no number", () => {
        const { container } = render(
            tree(footer(digest({ itemOptionals: { cadence: "weekly" } })))
        );
        const line = container.querySelector("[data-ai-usage-cost]")?.textContent ?? "";
        expect(line).toBe(en.inbox.aiUsage.unmeasured);
        expect(line).not.toMatch(/\d|No AI used/);
    });

    it("renders nothing for an item with no usable ai", () => {
        const { container } = render(tree(footer(digest({ itemType: 0 }))));
        expect(container.querySelector("[data-ai-usage]")).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("turning off says what was turned off and offers Undo; Undo turns it back on", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        render(tree(footer(report())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toContain("Morning plan is off")
        );
        expect(calls.switch).toHaveBeenCalledWith("tok", 90, false);
        expect(calls.patch).toHaveBeenCalledWith({
            kind: "schedule",
            scheduleId: "11111111-1111-4111-8111-111111111111",
            enabled: false,
        });
        const undo = screen.getByRole("button", { name: /undo/i });
        await waitFor(() => expect(document.activeElement).toBe(undo));

        calls.switch.mockResolvedValue({ ok: true, enabled: true, wasEnabled: false });
        fireEvent.click(undo);
        await waitFor(() => expect(screen.getByRole("status").textContent).toContain("on again"));
        expect(calls.switch).toHaveBeenLastCalledWith("tok", 90, true);
        expect(screen.getByRole("button", { name: /turn this off/i })).toBeTruthy();
    });

    it("the digest confirmation names the digest, in the app's words", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        render(tree(footer(digest())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toContain("Genos digest is off")
        );
    });

    it("offers NO Undo when it was already off (Undo would turn it on)", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: false });
        render(tree(footer(digest())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toContain("already off")
        );
        expect(screen.queryByRole("button", { name: /^undo/i })).toBeNull();
        expect(screen.getByRole("button", { name: /turn back on/i })).toBeTruthy();
    });

    it("an item whose source is already off draws 'turned off' and Turn back on, not the button", () => {
        render(
            tree(
                footer(
                    digest({ aiSource: { kind: "digest", enabled: false, label: "x" } as never })
                )
            )
        );
        expect(screen.getByRole("status").textContent).toContain("Genos digest is turned off");
        expect(screen.queryByRole("button", { name: /turn this off/i })).toBeNull();
        expect(screen.getByRole("button", { name: /turn back on/i })).toBeTruthy();
    });

    it("a deleted schedule draws no button", () => {
        render(
            tree(
                footer(
                    report({
                        aiSource: {
                            kind: "schedule",
                            enabled: false,
                            label: "",
                            schedule_id: "11111111-1111-4111-8111-111111111111",
                            gone: true,
                        } as never,
                    })
                )
            )
        );
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.getByRole("status").textContent).toContain("no longer exists");
    });

    it("a 404 'gone' on press removes the button and says so", async () => {
        calls.switch.mockResolvedValue({
            ok: false,
            reason: "gone",
            error: "The schedule that made this report no longer exists.",
        });
        render(tree(footer(report())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
        expect(screen.getAllByText(/no longer exists/i).length).toBeGreaterThan(0);
    });

    it("a plan_required refusal shows the upgrade note and a link to the plans, not a failure", async () => {
        calls.switch.mockResolvedValue({
            ok: false,
            reason: "plan",
            error: "Scheduled reports are...",
        });
        render(
            tree(
                footer(
                    report({
                        aiSource: {
                            kind: "schedule",
                            enabled: false,
                            label: "Morning plan",
                            schedule_id: "11111111-1111-4111-8111-111111111111",
                        } as never,
                    })
                )
            )
        );
        fireEvent.click(screen.getByRole("button", { name: /turn back on/i }));
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("Core plan or higher");
        expect(within(alert).getByRole("button", { name: /see plans/i })).toBeTruthy();
    });

    it("any other failure shows the server's sentence, or a plain one, and keeps the button", async () => {
        calls.switch.mockResolvedValueOnce({
            ok: false,
            reason: "error",
            error: "Too many tries.",
        });
        render(tree(footer(digest())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        expect((await screen.findByRole("alert")).textContent).toContain("Too many tries.");
        calls.switch.mockResolvedValueOnce({ ok: false, reason: "error", error: null });
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toContain("Try again in a moment")
        );
        expect(calls.patch).not.toHaveBeenCalled();
    });

    it("disables the button while the request is in flight (no double press)", async () => {
        let finish: (v: unknown) => void = () => undefined;
        calls.switch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        render(tree(footer(digest())));
        const button = screen.getByRole("button", { name: /turn this off/i });
        fireEvent.click(button);
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
        fireEvent.click(button);
        expect(calls.switch).toHaveBeenCalledTimes(1);
        await act(async () => finish({ ok: true, enabled: false, wasEnabled: true }));
    });

    it("pressing the button does not open the item (the row's click handler)", () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const onRow = vi.fn();
        render(tree(<div onClick={onRow}>{footer(digest())}</div>));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        expect(onRow).not.toHaveBeenCalled();
    });

    it("a click anywhere in the footer, not only on a button, does not open the item", () => {
        // The footer is an event boundary, not a control (the clickable-element guard, MIP-1129,
        // accepts it because its whole handler is `stopPropagation()`): the cost line and the
        // empty space beside the button must not open the row either.
        const onRow = vi.fn();
        const { container } = render(tree(<div onClick={onRow}>{footer(digest())}</div>));
        fireEvent.click(container.querySelector("[data-ai-usage-cost]") as HTMLElement);
        expect(onRow).not.toHaveBeenCalled();
        fireEvent.click(container.querySelector("[data-ai-usage]") as HTMLElement);
        expect(onRow).not.toHaveBeenCalled();
        // And the row itself still opens, so the test can fail: only the footer is a boundary.
        fireEvent.click(container.firstElementChild as HTMLElement);
        expect(onRow).toHaveBeenCalledTimes(1);
    });

    it("every card of the same source agrees, and another source is untouched", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const other = digest({ itemId: 813 });
        const schedule = report();
        render(
            tree(
                <>
                    <div data-testid="a">{footer(digest())}</div>
                    <div data-testid="b">{footer(other)}</div>
                    <div data-testid="c">{footer(schedule)}</div>
                </>
            )
        );
        fireEvent.click(
            within(screen.getByTestId("a")).getByRole("button", { name: /turn this off/i })
        );
        await waitFor(() =>
            expect(
                within(screen.getByTestId("b")).getByRole("button", { name: /turn back on/i })
            ).toBeTruthy()
        );
        expect(
            within(screen.getByTestId("c")).getByRole("button", { name: /turn this off/i })
        ).toBeTruthy();
    });

    it("a remounted card (Virtuoso recycles rows) keeps its Undo", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const first = render(tree(footer(digest())));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await screen.findByRole("button", { name: /undo/i });
        first.unmount();
        render(tree(footer(digest())));
        expect(screen.getByRole("button", { name: /undo/i })).toBeTruthy();
    });

    it("a different member's session shares nothing", async () => {
        calls.switch.mockResolvedValue({ ok: true, enabled: false, wasEnabled: true });
        const first = render(tree(footer(digest(), "u1")));
        fireEvent.click(screen.getByRole("button", { name: /turn this off/i }));
        await screen.findByRole("button", { name: /undo/i });
        first.unmount();
        render(tree(footer(digest(), "u2")));
        expect(screen.getByRole("button", { name: /turn this off/i })).toBeTruthy();
    });
});

const bubble = (item: Partial<InboxItemProps> & { itemId: number; itemType: number }) =>
    tree(
        <InboxBubble
            inboxItem={
                {
                    itemBody: { title: "t", text: "body text" },
                    isRead: false,
                    requestStatus: "" as never,
                    tsSent: "2026-11-09T00:00:00Z",
                    ...item,
                } as InboxItemProps
            }
            myself={{ userId: "u1", teamId: "t1" } as never}
            setMyself={vi.fn()}
            socket={null}
            useCM={{ allChats: [] } as never}
            useTEM={{ teamMemberProfiles: {} } as never}
            useUISM={{} as never}
        />
    );

describe("InboxBubble: where the footer appears", () => {
    beforeEach(() => resetInboxAiStore());

    it("a digest with an ai block draws the cost and the switch", async () => {
        const { container } = render(bubble(digest() as never));
        await waitFor(() => expect(container.querySelector("[data-ai-usage]")).not.toBeNull());
        expect(screen.getByRole("button", { name: /turn this off/i })).toBeTruthy();
    });

    it("a report (typed or plain) with an ai block draws it", () => {
        const typed = { version: 2, title: "T", text: "s", sections: [] };
        const a = render(bubble({ ...report(), itemBody: typed } as never));
        expect(a.container.querySelector("[data-ai-usage]")).not.toBeNull();
        a.unmount();
        const b = render(
            bubble({ ...report(), itemBody: { title: "T", text: "s", sections: [] } } as never)
        );
        expect(b.container.querySelector("[data-ai-usage]")).not.toBeNull();
    });

    it("a report that used no AI draws its footer: No AI used and Turn this off", () => {
        const typed = { version: 2, title: "T", text: "s", sections: [] };
        const a = render(bubble({ ...plainReport(), itemBody: typed } as never));
        expect(a.container.querySelector("[data-ai-usage-cost]")?.textContent).toBe("No AI used");
        expect(screen.getByRole("button", { name: /turn this off/i })).toBeTruthy();
        a.unmount();
        // The plain (untyped) body of an older report too.
        const b = render(
            bubble({
                ...plainReport(),
                itemBody: { title: "T", text: "s", sections: [] },
            } as never)
        );
        expect(b.container.querySelector("[data-ai-usage]")).not.toBeNull();
    });

    it("an ordinary item with a forged source that says used_ai false draws NOTHING", () => {
        const forged = {
            itemId: 6,
            itemType: 0,
            itemBody: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
            itemOptionals: { schedule_id: SID },
            aiSource: plainReport().aiSource,
        };
        const { container } = render(bubble(forged as never));
        expect(container.querySelector("[data-ai-usage]")).toBeNull();
        expect(container.textContent).not.toMatch(/No AI used/);
        expect(screen.queryByRole("button", { name: /turn this off/i })).toBeNull();
    });

    it("an ordinary item with a forged ai blob and aiSource draws NOTHING", () => {
        const forged = {
            itemId: 5,
            itemType: 0,
            itemBody: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
            itemOptionals: { ai: { ...AI, credits_milli: 1 }, schedule_id: "x" },
            aiSource: { kind: "digest", enabled: true, label: "Genos digest" },
        };
        const { container } = render(bubble(forged as never));
        expect(container.querySelector("[data-ai-usage]")).toBeNull();
        expect(screen.queryByRole("button", { name: /turn this off/i })).toBeNull();
        expect(container.textContent).not.toMatch(/AI credits used/);
    });

    it("a digest or report with no ai key says nothing about cost", () => {
        const a = render(
            bubble({
                ...digest(),
                itemOptionals: { cadence: "weekly" },
                aiSource: undefined,
            } as never)
        );
        expect(a.container.textContent).not.toMatch(/credits/i);
        a.unmount();
        const typed = { version: 2, title: "T", text: "s", sections: [] };
        const b = render(
            bubble({
                ...report(),
                itemBody: typed,
                itemOptionals: { schedule_id: "x" },
                aiSource: undefined,
            } as never)
        );
        expect(b.container.textContent).not.toMatch(/credits/i);
    });
});
