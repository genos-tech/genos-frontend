/**
 * Private and Hidden are two separate switches (MIP-1699). Hidden needs Private; turning Private
 * off clears Hidden; a person who may not edit only sees the state.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrivacySwitches } from "../components/ui/PrivacySwitches";

const setup = (props: Partial<Parameters<typeof PrivacySwitches>[0]> = {}) => {
    const onChange = vi.fn();
    render(
        <CssVarsProvider>
            <PrivacySwitches
                canEdit
                isHidden={false}
                isPrivate={false}
                onChange={onChange}
                {...props}
            />
        </CssVarsProvider>
    );
    return onChange;
};

describe("PrivacySwitches", () => {
    it("keeps Hidden off and disabled while Private is off", () => {
        const onChange = setup();
        const hidden = screen.getByRole("switch", { name: "Hidden" });
        expect(hidden).toBeDisabled();
        expect(screen.getByText("Turn on Private to hide it.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: "Private" }));
        expect(onChange).toHaveBeenCalledWith({ isPrivate: true, isHidden: false });
    });

    it("turns Hidden on and off while Private is on", () => {
        const onChange = setup({ isPrivate: true });
        fireEvent.click(screen.getByRole("switch", { name: "Hidden" }));
        expect(onChange).toHaveBeenCalledWith({ isPrivate: true, isHidden: true });
    });

    it("clears Hidden when Private is turned off", () => {
        const onChange = setup({ isPrivate: true, isHidden: true });
        fireEvent.click(screen.getByRole("switch", { name: "Private" }));
        expect(onChange).toHaveBeenCalledWith({ isPrivate: false, isHidden: false });
    });

    it("is read-only for someone who may not edit", () => {
        setup({ canEdit: false, isPrivate: true, isHidden: true });
        expect(screen.getByRole("switch", { name: "Private" })).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Hidden" })).toBeDisabled();
    });

    it("locks Private on for a cross-team group but leaves Hidden switchable (MIP-1949)", () => {
        const onChange = setup({ privateLocked: true, isPrivate: true });
        const priv = screen.getByRole("switch", { name: "Private" });
        expect(priv).toBeChecked();
        expect(priv).toBeDisabled();
        expect(
            screen.getByText("A group shared with another team always stays private.")
        ).toBeInTheDocument();
        const hidden = screen.getByRole("switch", { name: "Hidden" });
        expect(hidden).not.toBeDisabled();
        fireEvent.click(hidden);
        expect(onChange).toHaveBeenCalledWith({ isPrivate: true, isHidden: true });
    });
});
