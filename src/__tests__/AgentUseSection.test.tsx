import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentUseSection } from "../components/layout/AgentUseSection";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listTeamAgentUse = vi.fn();

vi.mock("../services/developerApi", async () => {
    const actual = await vi.importActual<typeof import("../services/developerApi")>(
        "../services/developerApi"
    );
    return {
        ...actual,
        listTeamAgentUse: (...a: unknown[]) => listTeamAgentUse(...a),
    };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const ROW = {
    weekStart: "2026-11-16",
    userId: "u2",
    username: "Alex",
    app: "claude",
    credentialKind: "oauth",
    keyName: null,
    calls: 120,
    changes: 30,
    refused: 0,
};

describe("AgentUseSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the owner counts per member per app", async () => {
        listTeamAgentUse.mockResolvedValue([ROW]);
        render(<AgentUseSection teamId="t1" />);

        expect(await screen.findByText("AI app use")).toBeInTheDocument();
        expect(listTeamAgentUse).toHaveBeenCalledWith("tok", "t1");
        expect(screen.getByText("Alex")).toBeInTheDocument();
        expect(screen.getByText("Claude")).toBeInTheDocument();
        expect(screen.getByText("Calls: 120")).toBeInTheDocument();
        expect(screen.getByText("Changes: 30")).toBeInTheDocument();
        expect(screen.queryByText(/Refused/)).not.toBeInTheDocument();
    });

    it("names the API key an app used and flags refused calls", async () => {
        listTeamAgentUse.mockResolvedValue([
            {
                ...ROW,
                app: "other",
                credentialKind: "api_key",
                keyName: "Claude Code",
                refused: 2,
            },
        ]);
        render(<AgentUseSection teamId="t1" />);

        expect(await screen.findByText("Other app (Claude Code)")).toBeInTheDocument();
        expect(screen.getByText("Refused: 2")).toBeInTheDocument();
    });

    it("groups rows by week", async () => {
        listTeamAgentUse.mockResolvedValue([
            ROW,
            { ...ROW, userId: "u3", username: "Sam" },
            { ...ROW, weekStart: "2026-11-09" },
        ]);
        render(<AgentUseSection teamId="t1" />);

        expect(await screen.findAllByTestId("agent-use-week")).toHaveLength(2);
        expect(screen.getAllByTestId("agent-use-row")).toHaveLength(3);
    });

    it("says so when nothing is recorded", async () => {
        listTeamAgentUse.mockResolvedValue([]);
        render(<AgentUseSection teamId="t1" />);
        expect(await screen.findByText("No AI app use recorded yet.")).toBeInTheDocument();
    });

    it("renders nothing for a non-owner (the server's 404 is null)", async () => {
        listTeamAgentUse.mockResolvedValue(null);
        const { container } = render(<AgentUseSection teamId="t1" />);
        await vi.waitFor(() => expect(listTeamAgentUse).toHaveBeenCalled());
        expect(screen.queryByText("AI app use")).not.toBeInTheDocument();
        expect(container.textContent).toBe("");
    });
});
