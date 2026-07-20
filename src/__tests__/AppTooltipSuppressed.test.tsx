/**
 * `AppTooltip`'s `suppressed` prop.
 *
 * Call sites used to write `open={cond ? false : undefined}` to hide a
 * tooltip while a menu was open. That flips the tooltip between
 * controlled and uncontrolled as `cond` changes, which MUI rejects at
 * runtime with "A component is changing the uncontrolled open state of
 * Tooltip to be controlled". These tests pin the replacement: `open`
 * must be a stable boolean across the toggle, and the tooltip must
 * actually stay hidden while suppressed.
 */

import { Button, CssVarsProvider } from "@mui/joy";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppTooltip } from "../components/ui/AppTooltip";

// AppTooltip reads `useColorScheme`, which needs Joy's provider.
const render = (ui: React.ReactElement) =>
    rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>, {
        wrapper: ({ children }) => <>{children}</>,
    });

describe("AppTooltip suppressed", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const Harness = ({ suppressed }: { suppressed: boolean }) => (
        <AppTooltip enterDelay={0} suppressed={suppressed} title="Tip text">
            <Button>trigger</Button>
        </AppTooltip>
    );

    it("does not warn about switching controlled state when toggled", async () => {
        const { rerender } = rtlRender(
            <CssVarsProvider>
                <Harness suppressed={false} />
            </CssVarsProvider>
        );
        rerender(
            <CssVarsProvider>
                <Harness suppressed={true} />
            </CssVarsProvider>
        );
        rerender(
            <CssVarsProvider>
                <Harness suppressed={false} />
            </CssVarsProvider>
        );

        const warnings = errorSpy.mock.calls
            .map((c) => String(c[0]))
            .filter((m) => m.includes("uncontrolled") || m.includes("controlled"));
        expect(warnings).toEqual([]);
    });

    it("shows the tooltip on hover when not suppressed", async () => {
        const user = userEvent.setup();
        render(<Harness suppressed={false} />);
        await user.hover(screen.getByRole("button"));
        expect(await screen.findByText("Tip text")).toBeTruthy();
    });

    it("stays hidden on hover while suppressed", async () => {
        const user = userEvent.setup();
        render(<Harness suppressed={true} />);
        await user.hover(screen.getByRole("button"));
        expect(screen.queryByText("Tip text")).toBeNull();
    });

    it("leaves tooltips that pass neither prop uncontrolled", async () => {
        const user = userEvent.setup();
        render(
            <AppTooltip enterDelay={0} title="Plain tip">
                <Button>plain</Button>
            </AppTooltip>
        );
        await user.hover(screen.getByRole("button"));
        expect(await screen.findByText("Plain tip")).toBeTruthy();
    });
});
