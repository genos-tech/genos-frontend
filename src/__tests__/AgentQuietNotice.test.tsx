/**
 * The no-activity line (MIP-2022): one quiet sentence and a link, no alert role, the day count
 * pluralised, the link calls back.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentQuietNotice } from "../components/layout/AgentQuietNotice";

const draw = (days: number, onCheck = vi.fn()) => {
    render(
        <CssVarsProvider>
            <AgentQuietNotice days={days} onCheck={onCheck} />
        </CssVarsProvider>
    );
    return onCheck;
};

describe("AgentQuietNotice", () => {
    it("says how many days, and the link is a button that calls back", async () => {
        const onCheck = draw(3);
        const line = screen.getByTestId("agent-quiet-notice");
        expect(line.textContent).toContain("Your AI app hasn't recorded anything in 3 days.");
        await userEvent.setup().click(screen.getByRole("button", { name: "Check the setup" }));
        expect(onCheck).toHaveBeenCalledTimes(1);
    });

    it("pluralises one day", () => {
        draw(1);
        expect(screen.getByTestId("agent-quiet-notice").textContent).toContain("in 1 day.");
    });

    it("is a plain line: no alert or status role", () => {
        draw(3);
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
    });
});
