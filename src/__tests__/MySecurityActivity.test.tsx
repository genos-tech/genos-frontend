import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MySecurityActivity } from "../components/layout/MySecurityActivity";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listMySecurityEvents = vi.fn();

vi.mock("../services/developerApi", async () => {
    const actual = await vi.importActual<typeof import("../services/developerApi")>(
        "../services/developerApi"
    );
    return {
        ...actual,
        listMySecurityEvents: (...a: unknown[]) => listMySecurityEvents(...a),
    };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const event = (over: Record<string, unknown> = {}) => ({
    id: 9,
    createdAt: "2026-10-19T01:00:00Z",
    action: "signin.succeeded",
    actionLabel: "Signed in",
    actorId: "me",
    actorLabel: "m***@example.com",
    targetType: "",
    targetId: "",
    targetLabel: "",
    source: "app",
    apiKeyId: null,
    ip: "198.51.100.4",
    userAgent: "Mozilla/5.0",
    metadata: {},
    ...over,
});

describe("MySecurityActivity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows my own sign-ins with where they came from", async () => {
        listMySecurityEvents.mockResolvedValue({ events: [event()], nextBefore: null });
        render(<MySecurityActivity />);

        expect(await screen.findByText("Your security activity")).toBeInTheDocument();
        expect(await screen.findByText(/Signed in/)).toBeInTheDocument();
        expect(screen.getByText(/198\.51\.100\.4/)).toBeInTheDocument();
        expect(listMySecurityEvents).toHaveBeenCalledWith("tok", null);
        expect(screen.queryByRole("button", { name: /Show older/i })).not.toBeInTheDocument();
    });

    it("shows the address a failed attempt came from, and says it is not mine", async () => {
        listMySecurityEvents.mockResolvedValue({
            events: [
                event({
                    id: 5,
                    action: "signin.failed",
                    actionLabel: "Sign-in failed",
                    actorId: null,
                    actorLabel: "stranger@example.com",
                    source: "anonymous",
                    ip: "203.0.113.99",
                }),
            ],
            nextBefore: null,
        });
        render(<MySecurityActivity />);

        expect(await screen.findByText(/Sign-in failed/)).toBeInTheDocument();
        expect(screen.getByText(/203\.0\.113\.99/)).toBeInTheDocument();
        expect(
            screen.getByText(/the address shown is the one the attempt came from/i)
        ).toBeInTheDocument();
    });

    it("pages older events in, keeping the ones already shown", async () => {
        listMySecurityEvents
            .mockResolvedValueOnce({ events: [event({ id: 9 })], nextBefore: 9 })
            .mockResolvedValueOnce({
                events: [event({ id: 4, action: "data.exported", actionLabel: "Data exported" })],
                nextBefore: null,
            });
        render(<MySecurityActivity />);

        await userEvent.click(await screen.findByRole("button", { name: /Show older/i }));

        expect(await screen.findByText(/Data exported/)).toBeInTheDocument();
        expect(screen.getAllByTestId("security-event")).toHaveLength(2);
        expect(listMySecurityEvents).toHaveBeenLastCalledWith("tok", 9);
        expect(screen.queryByRole("button", { name: /Show older/i })).not.toBeInTheDocument();
    });

    it("says so when there is nothing recorded", async () => {
        listMySecurityEvents.mockResolvedValue({ events: [], nextBefore: null });
        render(<MySecurityActivity />);

        expect(await screen.findByText(/Nothing recorded yet/i)).toBeInTheDocument();
    });

    /**
     * Unlike the team log, which hides itself for a non-owner, a failure here
     * must NOT look like an empty list: "nothing recorded" would be a false
     * statement about someone's own account.
     */
    it("shows an error, not 'nothing recorded', when the first load fails", async () => {
        listMySecurityEvents.mockResolvedValue(null);
        render(<MySecurityActivity />);

        expect(
            await screen.findByText(/Couldn't load your security activity/i)
        ).toBeInTheDocument();
        expect(screen.queryByText(/Nothing recorded yet/i)).not.toBeInTheDocument();
        expect(screen.getByText("Your security activity")).toBeInTheDocument();
        // And the spinner is gone: a failure is not still "loading".
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows a spinner while the first page is loading", async () => {
        let resolve!: (v: unknown) => void;
        listMySecurityEvents.mockReturnValue(new Promise((r) => (resolve = r)));
        render(<MySecurityActivity />);

        expect(await screen.findByRole("progressbar")).toBeInTheDocument();

        resolve({ events: [event()], nextBefore: null });
        await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    });

    it("retries a failed first load, and shows the rows when it works", async () => {
        listMySecurityEvents
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ events: [event()], nextBefore: null });
        render(<MySecurityActivity />);

        await userEvent.click(await screen.findByRole("button", { name: /Try again/i }));

        expect(await screen.findByText(/Signed in/)).toBeInTheDocument();
        expect(screen.queryByText(/Couldn't load/i)).not.toBeInTheDocument();
        expect(listMySecurityEvents).toHaveBeenCalledTimes(2);
        // The retry asks for the FIRST page again, not a cursor.
        expect(listMySecurityEvents).toHaveBeenLastCalledWith("tok", null);
    });

    it("keeps the rows already shown when an older page fails, and offers a retry", async () => {
        listMySecurityEvents
            .mockResolvedValueOnce({ events: [event({ id: 9 })], nextBefore: 9 })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ events: [event({ id: 4 })], nextBefore: null });
        render(<MySecurityActivity />);

        await userEvent.click(await screen.findByRole("button", { name: /Show older/i }));
        expect(
            await screen.findByText(/Couldn't load your security activity/i)
        ).toBeInTheDocument();
        expect(screen.getAllByTestId("security-event")).toHaveLength(1);

        // The retry asks for the SAME older page, not the first one again.
        await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
        await waitFor(() => expect(screen.getAllByTestId("security-event")).toHaveLength(2));
        expect(listMySecurityEvents).toHaveBeenLastCalledWith("tok", 9);
    });

    it("is never hidden, whatever the answer", async () => {
        listMySecurityEvents.mockResolvedValue(null);
        const { container } = render(<MySecurityActivity />);

        await waitFor(() => expect(listMySecurityEvents).toHaveBeenCalled());
        expect(container.textContent).not.toBe("");
    });
});
