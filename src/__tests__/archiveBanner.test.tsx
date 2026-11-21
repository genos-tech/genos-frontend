/**
 * The read-only banner an archived project or chat shows (MIP-1693).
 *
 * It names the state and the reason, and offers Unarchive only to the owner. A
 * non-owner reads the same reason with no button, so nothing promises an action they cannot take.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchivedBanner } from "../features/archive/ArchivedBanner";
import { I18nProvider } from "../i18n";

const renderBanner = (props: Partial<React.ComponentProps<typeof ArchivedBanner>> = {}) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <ArchivedBanner kind="project" {...props} />
            </I18nProvider>
        </CssVarsProvider>
    );

describe("ArchivedBanner", () => {
    it("says the project is archived and read-only, announced politely", () => {
        renderBanner({ kind: "project" });
        const banner = screen.getByRole("status");
        expect(banner.textContent).toMatch(/archived/i);
        expect(banner.textContent).toMatch(/read-only/i);
    });

    it("says the group is archived when it is a group chat", () => {
        renderBanner({ kind: "chat" });
        expect(screen.getByRole("status").textContent).toMatch(/group is archived/i);
    });

    it("offers Unarchive to the owner and runs the action", () => {
        const onRestore = vi.fn();
        renderBanner({ kind: "project", onRestore });
        fireEvent.click(screen.getByRole("button", { name: /unarchive/i }));
        expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it("shows no action to a member who is not the owner", () => {
        renderBanner({ kind: "chat" });
        expect(screen.queryByRole("button")).toBeNull();
    });
});
