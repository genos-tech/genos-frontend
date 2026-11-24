/**
 * "Update available" (MIP-2192): what an installed skill's new version changes, before it replaces
 * the one the person runs. Every network edge is mocked.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { diffLineKind } from "../features/genos/skills/skillDiffLines";
import * as api from "../features/genos/skills/skillsApi";
import type { UpdateDiff } from "../features/genos/skills/skillsApi";
import { SkillUpdateDiffDialog } from "../features/genos/skills/SkillUpdateDiffDialog";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return { ...actual, fetchUpdateDiff: vi.fn(), acceptSkillUpdate: vi.fn() };
});

const SKILL = { id: "s1", title: "Weekly update" };

const diff = (over: Partial<UpdateDiff> = {}): UpdateDiff => ({
    fromVersionNo: 1,
    toVersionNo: 3,
    upToDate: false,
    changes: [{ field: "title", from: "Weekly", to: "Weekly update" }],
    toolLevelRaised: false,
    changelogs: [{ versionNo: 3, changelog: "Shorter summary" }],
    diff: "--- v1\n+++ v3\n@@ -1,2 +1,2 @@\n context line\n-old line\n+new line\n",
    truncated: false,
    needsConfirmation: false,
    ...over,
});

const renderDialog = (props: Partial<React.ComponentProps<typeof SkillUpdateDiffDialog>> = {}) => {
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SkillUpdateDiffDialog
                    skill={SKILL}
                    onClose={onClose}
                    onUpdated={onUpdated}
                    {...props}
                />
            </I18nProvider>
        </CssVarsProvider>
    );
    return { onClose, onUpdated };
};

const load = (d: UpdateDiff) =>
    vi.mocked(api.fetchUpdateDiff).mockResolvedValue({ ok: true, data: d });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.acceptSkillUpdate).mockResolvedValue({
        ok: true,
        data: { installedVersionNo: 3 },
    });
});

describe("diffLineKind", () => {
    it("tells added, removed, header and context lines apart", () => {
        expect(diffLineKind("+new")).toBe("add");
        expect(diffLineKind("-old")).toBe("del");
        expect(diffLineKind("+++ v3")).toBe("meta");
        expect(diffLineKind("--- v1")).toBe("meta");
        expect(diffLineKind("@@ -1 +1 @@")).toBe("meta");
        expect(diffLineKind(" same")).toBe("ctx");
        expect(diffLineKind("")).toBe("ctx");
    });
});

describe("SkillUpdateDiffDialog", () => {
    it("shows the changelogs, the changed details and the diff with +/- markers", async () => {
        load(diff());
        renderDialog();
        await screen.findByText("Shorter summary");
        expect(screen.getByRole("heading", { name: "Update available" })).toBeInTheDocument();
        expect(screen.getByText("From version 1 to version 3")).toBeInTheDocument();
        expect(screen.getByText("What the author says changed")).toBeInTheDocument();
        expect(screen.getByText("Weekly")).toBeInTheDocument();
        const block = screen.getByRole("region", { name: "Changes to the text" });
        // The markers are part of the text, so a change is never colour alone.
        expect(within(block).getByText("+new line")).toHaveAttribute("data-diff", "add");
        expect(within(block).getByText("-old line")).toHaveAttribute("data-diff", "del");
        expect(within(block).getByText("@@ -1,2 +1,2 @@")).toHaveAttribute("data-diff", "meta");
        expect(block).toHaveAttribute("tabindex", "0");
    });

    it("draws the diff as plain text", async () => {
        load(
            diff({ diff: '+<img src="https://evil.example/x.png">\n+[a](https://evil.example)\n' })
        );
        renderDialog();
        const block = await screen.findByRole("region", { name: "Changes to the text" });
        expect(block.querySelector("img, a")).toBeNull();
        expect(block.textContent).toContain('<img src="https://evil.example/x.png">');
    });

    it("flags a raised tool level prominently, and only then", async () => {
        load(
            diff({
                toolLevelRaised: true,
                changes: [{ field: "toolLevel", from: "read", to: "act" }],
            })
        );
        renderDialog();
        const alert = await screen.findByRole("alert");
        // A heading, and a body that adds what it may do and that approval is still needed.
        expect(alert).toHaveTextContent("This version can now propose changes");
        expect(alert).toHaveTextContent(
            "This one may suggest creating tasks, notes or to-do items for you. Each suggestion still needs your approval."
        );
        expect(screen.getByText("Read only")).toBeInTheDocument();
        expect(screen.getByText("Read and propose changes")).toBeInTheDocument();
    });

    it("has no such warning when the tool level is not raised", async () => {
        load(diff());
        renderDialog();
        await screen.findByText("Shorter summary");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByText(/may now propose changes/)).toBeNull();
    });

    it("notes a truncated diff", async () => {
        load(diff({ truncated: true }));
        renderDialog();
        await screen.findByText(/too long to show in full/);
    });

    it("names the versions on its buttons", async () => {
        load(diff());
        renderDialog();
        expect(await screen.findByRole("button", { name: "Update to version 3" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Keep version 1" })).toBeInTheDocument();
    });

    it("installs exactly the version the diff ended at, then reports and closes", async () => {
        load(diff());
        const { onClose, onUpdated } = renderDialog();
        const update = await screen.findByRole("button", { name: "Update to version 3" });
        await userEvent.click(update);
        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(3));
        expect(api.acceptSkillUpdate).toHaveBeenCalledWith("tok", "s1", 3);
        expect(onClose).toHaveBeenCalled();
    });

    it("Keep leaves the installed version alone", async () => {
        load(diff());
        const { onClose, onUpdated } = renderDialog();
        await userEvent.click(await screen.findByRole("button", { name: "Keep version 1" }));
        expect(onClose).toHaveBeenCalled();
        expect(onUpdated).not.toHaveBeenCalled();
        expect(api.acceptSkillUpdate).not.toHaveBeenCalled();
    });

    it("reloads the diff when the author published another version meanwhile", async () => {
        vi.mocked(api.fetchUpdateDiff)
            .mockResolvedValueOnce({ ok: true, data: diff() })
            .mockResolvedValueOnce({
                ok: true,
                data: diff({
                    toVersionNo: 4,
                    changelogs: [{ versionNo: 4, changelog: "Newest" }],
                }),
            });
        vi.mocked(api.acceptSkillUpdate).mockResolvedValueOnce({
            ok: false,
            reason: "conflict",
            message: "",
            code: "update_moved",
        });
        const { onClose, onUpdated } = renderDialog();
        await userEvent.click(await screen.findByRole("button", { name: "Update to version 3" }));
        await screen.findByRole("button", { name: "Update to version 4" });
        expect(screen.getByText("Newest")).toBeInTheDocument();
        expect(
            screen.getByText(/published another version while you were reading/)
        ).toBeInTheDocument();
        expect(api.fetchUpdateDiff).toHaveBeenCalledTimes(2);
        expect(onClose).not.toHaveBeenCalled();
        expect(onUpdated).not.toHaveBeenCalled();
        // Accepting again installs the NEW version.
        await userEvent.click(screen.getByRole("button", { name: "Update to version 4" }));
        await waitFor(() =>
            expect(api.acceptSkillUpdate).toHaveBeenLastCalledWith("tok", "s1", 4)
        );
    });

    it("says so, and offers no update, when there is nothing newer", async () => {
        load(diff({ upToDate: true, changes: [], changelogs: [], diff: "" }));
        renderDialog();
        await screen.findByText("You already have the latest version.");
        expect(screen.getByRole("button", { name: "Update to version 3" })).toBeDisabled();
    });

    it("says it could not load the changes", async () => {
        vi.mocked(api.fetchUpdateDiff).mockResolvedValue({
            ok: false,
            reason: "error",
            message: "",
        });
        renderDialog();
        await screen.findByText("Couldn't load the changes. Please try again.");
        expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    });

    it("Escape closes it without updating", async () => {
        load(diff());
        const { onClose } = renderDialog();
        await screen.findByText("Shorter summary");
        await userEvent.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalled();
        expect(api.acceptSkillUpdate).not.toHaveBeenCalled();
    });
});
