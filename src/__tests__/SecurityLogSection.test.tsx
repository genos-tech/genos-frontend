import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SecurityLogSection } from "../components/layout/SecurityLogSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listTeamSecurityEvents = vi.fn();

vi.mock("../services/developerApi", async () => {
    const actual = await vi.importActual<typeof import("../services/developerApi")>(
        "../services/developerApi"
    );
    return {
        ...actual,
        listTeamSecurityEvents: (...a: unknown[]) => listTeamSecurityEvents(...a),
    };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const EVENT = {
    id: 9,
    createdAt: "2026-10-19T01:00:00Z",
    action: "member.added",
    actionLabel: "Member added",
    actorId: "u1",
    actorLabel: "owner@example.com",
    targetType: "user",
    targetId: "u2",
    targetLabel: "new@example.com",
    source: "app",
    apiKeyId: null,
    ip: "203.0.113.7",
    userAgent: "Mozilla/5.0",
    metadata: { via: "direct" },
};

describe("SecurityLogSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the owner the team's trail: what, to whom, by whom, from where", async () => {
        listTeamSecurityEvents.mockResolvedValue({ events: [EVENT], nextBefore: null });
        render(<SecurityLogSection teamId="t1" />);

        expect(await screen.findByText("Security log")).toBeInTheDocument();
        expect(listTeamSecurityEvents).toHaveBeenCalledWith("tok", "t1");
        expect(screen.getByText(/Member added/)).toBeInTheDocument();
        expect(screen.getByText(/new@example\.com/)).toBeInTheDocument();
        expect(screen.getByText(/owner@example\.com/)).toBeInTheDocument();
        expect(screen.getByText(/203\.0\.113\.7/)).toBeInTheDocument();
        expect(screen.getByText("App")).toBeInTheDocument();
        // One page only: nothing older to ask for.
        expect(screen.queryByRole("button", { name: /Show older/i })).not.toBeInTheDocument();
    });

    /**
     * Editors and members get the server's 404 (`null`), and the section
     * is ABSENT, not empty: "nothing recorded" would be a false statement
     * about the team.
     */
    it("is absent for anyone but the owner", async () => {
        listTeamSecurityEvents.mockResolvedValue(null);
        const { container } = render(<SecurityLogSection teamId="t1" />);
        await waitFor(() => expect(listTeamSecurityEvents).toHaveBeenCalled());
        expect(screen.queryByText("Security log")).not.toBeInTheDocument();
        expect(screen.queryByText(/Nothing recorded yet/i)).not.toBeInTheDocument();
        expect(container.textContent).toBe("");
    });

    it("says so when the owner's team has no events yet", async () => {
        listTeamSecurityEvents.mockResolvedValue({ events: [], nextBefore: null });
        render(<SecurityLogSection teamId="t1" />);
        expect(await screen.findByText(/Nothing recorded yet/i)).toBeInTheDocument();
    });

    it("pages back through older events with the cursor the server gave", async () => {
        const user = userEvent.setup();
        listTeamSecurityEvents
            .mockResolvedValueOnce({ events: [EVENT], nextBefore: 9 })
            .mockResolvedValueOnce({
                events: [{ ...EVENT, id: 4, targetLabel: "older@example.com" }],
                nextBefore: null,
            });
        render(<SecurityLogSection teamId="t1" />);

        await user.click(await screen.findByRole("button", { name: /Show older/i }));

        expect(await screen.findByText(/older@example\.com/)).toBeInTheDocument();
        expect(listTeamSecurityEvents).toHaveBeenLastCalledWith("tok", "t1", 9);
        // Appended, not replaced.
        expect(screen.getByText(/new@example\.com/)).toBeInTheDocument();
        expect(screen.getAllByTestId("security-event")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: /Show older/i })).not.toBeInTheDocument();
    });

    it("keeps what it has and offers a retry when an older page fails", async () => {
        const user = userEvent.setup();
        listTeamSecurityEvents
            .mockResolvedValueOnce({ events: [EVENT], nextBefore: 9 })
            .mockResolvedValueOnce(null);
        render(<SecurityLogSection teamId="t1" />);

        await user.click(await screen.findByRole("button", { name: /Show older/i }));

        expect(await screen.findByText(/Couldn't load the security log/i)).toBeInTheDocument();
        expect(screen.getByText(/new@example\.com/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    });

    it("labels sources, and falls back to the server's label for an unknown action", async () => {
        listTeamSecurityEvents.mockResolvedValue({
            events: [
                { ...EVENT, id: 3, source: "mcp" },
                {
                    ...EVENT,
                    id: 2,
                    action: "something.new",
                    actionLabel: "Something new",
                    source: "api_key",
                },
            ],
            nextBefore: null,
        });
        render(<SecurityLogSection teamId="t1" />);

        expect(await screen.findByText("MCP")).toBeInTheDocument();
        expect(screen.getByText("API key")).toBeInTheDocument();
        expect(screen.getByText(/Something new/)).toBeInTheDocument();
    });

    it("an event with no actor says someone did it", async () => {
        listTeamSecurityEvents.mockResolvedValue({
            events: [{ ...EVENT, actorId: null, actorLabel: "" }],
            nextBefore: null,
        });
        render(<SecurityLogSection teamId="t1" />);
        expect(await screen.findByText(/^Someone ·/)).toBeInTheDocument();
    });
});
