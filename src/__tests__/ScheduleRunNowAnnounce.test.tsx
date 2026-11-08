// "Run now" must finish at the APP level (MIP-1233).
//
// Ken pressed Run now on his Morning plan and closed Settings straight away.
// The run is one request the API completes whether or not anyone is looking,
// but the Inbox never heard about it (a report filed that way has no acting
// browser, so no socket event announces it) and the dialog's inline notice
// died with the dialog. These tests unmount the dialog BEFORE the request
// answers, which is the whole case: the resync, the toast and its "Open inbox"
// button must all still happen.

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import {
    INBOX_RESYNC_EVENT,
    InboxResyncDetail,
    InboxResyncResult,
} from "../features/inbox/inboxResyncEvent";
import { APP_NAVIGATE_EVENT } from "../services/appNavigate";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const runScheduleNow = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: (...a: unknown[]) => runScheduleNow(...a),
}));

const SCHEDULE = {
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: { changed_hours: 24 },
    when: "every day at 09:00",
    frequency: "daily" as const,
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: false,
    nextRun: "2026-11-09T09:00:00+09:00",
    lastRun: null,
    lastStatus: null,
};

const LIST = {
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [
        {
            job: "what_to_do_today",
            title: "What to do today",
            description: "Your plan.",
            params: {},
        },
    ],
    schedules: [SCHEDULE],
};

type Pending = { detail: InboxResyncDetail; finish: (r?: Partial<InboxResyncResult>) => void };

/** Stands in for `useInboxResync`: takes each request and finishes it on demand. */
const listenForResync = () => {
    const asked: Pending[] = [];
    const onEvent = (event: Event) => {
        const detail = (event as CustomEvent<InboxResyncDetail>).detail;
        detail.accepted = true;
        asked.push({
            detail,
            finish: (r) => detail.done?.({ ok: true, added: 1, ...r }),
        });
    };
    window.addEventListener(INBOX_RESYNC_EVENT, onEvent);
    return { asked, stop: () => window.removeEventListener(INBOX_RESYNC_EVENT, onEvent) };
};

const listenForNavigate = () => {
    const paths: string[] = [];
    const onEvent = (event: Event) => paths.push((event as CustomEvent<string>).detail);
    window.addEventListener(APP_NAVIGATE_EVENT, onEvent);
    return { paths, stop: () => window.removeEventListener(APP_NAVIGATE_EVENT, onEvent) };
};

/** A dialog that can be closed, next to a toast host that cannot (it is in `App`). */
const mount = () => {
    const host = rtlRender(<ToastHost />);
    const dialog = rtlRender(
        <CssVarsProvider>
            <SchedulesSection teamId="t1" />
        </CssVarsProvider>
    );
    return { dialog, host };
};

/** Press Run now, then close the dialog while the request is still in flight. */
const pressRunNowAndClose = async (dialog: ReturnType<typeof mount>["dialog"]) => {
    let answer!: (value: unknown) => void;
    runScheduleNow.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await screen.findByTestId("schedule-row");
    await userEvent.setup().click(screen.getByRole("button", { name: "Run now" }));
    await waitFor(() => expect(runScheduleNow).toHaveBeenCalledWith("tok", "t1", "s1"));
    dialog.unmount();
    return answer;
};

const OK = {
    ok: true,
    outcome: { status: "ok", error: "", title: "Morning plan", items: 4 },
};

let resync: ReturnType<typeof listenForResync>;
let nav: ReturnType<typeof listenForNavigate>;

beforeEach(() => {
    __resetToasts();
    listSchedules.mockReset();
    runScheduleNow.mockReset();
    listSchedules.mockResolvedValue(LIST);
    resync = listenForResync();
    nav = listenForNavigate();
});

afterEach(() => {
    resync.stop();
    nav.stop();
});

describe("Run now after the dialog was closed", () => {
    it("still resyncs the Inbox, then says the report is ready and opens the Inbox", async () => {
        const { dialog } = mount();
        const answer = await pressRunNowAndClose(dialog);
        expect(resync.asked).toHaveLength(0);

        // The server finished the run; nobody is looking at the dialog any more.
        await act(async () => answer(OK));
        await waitFor(() => expect(resync.asked).toHaveLength(1));
        expect(resync.asked[0].detail.reason).toBe("schedule-run");

        // The toast waits for the sync, so its button never lands on a list that
        // does not have the report yet.
        expect(screen.queryByText(/Report ready/)).toBeNull();
        await act(async () => resync.asked[0].finish());
        expect(await screen.findByText("Report ready: Morning plan")).toBeTruthy();

        await userEvent.setup().click(screen.getByRole("button", { name: "Open inbox" }));
        expect(nav.paths).toEqual(["/workspace/inbox"]);
        // One sync request per run, not one per row.
        expect(resync.asked).toHaveLength(1);
    });

    it("says the report is ready even if the sync itself failed", async () => {
        // The report is on the server; a failed sync costs the live appearance only.
        const { dialog } = mount();
        const answer = await pressRunNowAndClose(dialog);
        await act(async () => answer(OK));
        await waitFor(() => expect(resync.asked).toHaveLength(1));
        await act(async () => resync.asked[0].finish({ ok: false, added: 0 }));
        expect(await screen.findByText("Report ready: Morning plan")).toBeTruthy();
    });

    it("tells a failed run in a toast", async () => {
        const { dialog } = mount();
        const answer = await pressRunNowAndClose(dialog);
        await act(async () =>
            answer({
                ok: true,
                outcome: { status: "failed", error: "The job failed.", title: "", items: 0 },
            })
        );
        expect(await screen.findByText("The run failed: The job failed.")).toBeTruthy();
        // A failed run filed no report: no Inbox resync, no "Open inbox".
        expect(resync.asked).toHaveLength(0);
        expect(screen.queryByRole("button", { name: "Open inbox" })).toBeNull();
    });

    it("tells a refusal (the one-a-minute sentence) as it came", async () => {
        const { dialog } = mount();
        const answer = await pressRunNowAndClose(dialog);
        await act(async () =>
            answer({ ok: false, gone: false, planRequired: false, error: "Try again in 42 s." })
        );
        expect(await screen.findByText("Try again in 42 s.")).toBeTruthy();
    });

    it("tells a lost plan, with a way to the plans page", async () => {
        const { dialog } = mount();
        const answer = await pressRunNowAndClose(dialog);
        await act(async () =>
            answer({ ok: false, gone: false, planRequired: true, error: "Core and up." })
        );
        expect(
            await screen.findByText("Your plan doesn't include scheduled reports.")
        ).toBeTruthy();
        await userEvent.setup().click(screen.getByRole("button", { name: "See plans" }));
        expect(nav.paths).toEqual(["/workspace/plans"]);
        expect(resync.asked).toHaveLength(0);
    });
});

describe("Run now with the dialog still open", () => {
    const press = async () => {
        await screen.findByTestId("schedule-row");
        await userEvent.setup().click(screen.getByRole("button", { name: "Run now" }));
    };

    it("keeps its inline notice and still offers the Inbox", async () => {
        runScheduleNow.mockResolvedValue(OK);
        mount();
        await press();
        await waitFor(() => expect(resync.asked).toHaveLength(1));
        await act(async () => resync.asked[0].finish());
        expect((await screen.findByTestId("run-notice")).textContent).toContain("Morning plan");
        expect(screen.getByRole("button", { name: "Open inbox" })).toBeTruthy();
    });

    it("does not say a failure twice: the panel's own notice is enough", async () => {
        runScheduleNow.mockResolvedValue({
            ok: true,
            outcome: { status: "failed", error: "The job failed.", title: "", items: 0 },
        });
        mount();
        await press();
        const notice = await screen.findByTestId("run-notice");
        expect(notice.textContent).toBe("The run failed: The job failed.");
        // Exactly one place says it: the notice, not a toast as well.
        expect(screen.getAllByText("The run failed: The job failed.")).toHaveLength(1);
    });
});
