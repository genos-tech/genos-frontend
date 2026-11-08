/**
 * `AppTooltip`'s chip surface (border, background, radius) belongs to the
 * tooltip popup only. Joy's Tooltip spreads its own `sx` onto the child it
 * wraps, so putting the surface there boxed every sx-less child (the chat
 * pin, MIP-1127; the comments toggle's Badge, MIP-1128).
 */

import { CssVarsProvider } from "@mui/joy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppTooltip } from "../components/ui/AppTooltip";

afterEach(cleanup);

describe("AppTooltip does not restyle the element it wraps", () => {
    it("its surface style reaches the tooltip only, never the child", () => {
        render(
            <CssVarsProvider>
                <AppTooltip title="Tip">
                    <button data-testid="child" type="button">
                        x
                    </button>
                </AppTooltip>
            </CssVarsProvider>
        );
        // Joy spreads a Tooltip-level `sx` onto the child too, which on a DOM node
        // shows up as this attribute.
        expect(screen.getByTestId("child").getAttribute("sx")).toBeNull();
    });
});
