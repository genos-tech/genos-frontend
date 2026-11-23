/**
 * The first-run card (MIP-2192): what the person reads before an outside author's skill, or a copy of
 * a skill an operator took down as harmful, runs for the first time. Every network edge is mocked;
 * pinned here is what the card shows (the text as PLAIN text, the author's handle only, what the skill
 * may propose, the fixed warning) and what its buttons do.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillRunCardDialog } from "../features/genos/skills/SkillRunCardDialog";
import * as api from "../features/genos/skills/skillsApi";
import type { RunCard } from "../features/genos/skills/skillsApi";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return { ...actual, fetchRunCard: vi.fn(), confirmSkillRun: vi.fn() };
});

const REQUEST = { teamId: "team-1", skillId: "s1", versionNo: 3 };

const card = (over: Partial<RunCard> = {}): RunCard => ({
    skillId: "s1",
    versionNo: 3,
    slug: "weekly",
    title: "Weekly update",
    bodyMarkdown: "Summarise my week.",
    toolLevel: "read",
    mayPropose: [],
    author: { handle: "ayumi", displayName: "Ayumi Tanaka" },
    outside: true,
    harmful: false,
    confirmed: false,
    ...over,
});

const renderCard = (onResolve = vi.fn()) => {
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SkillRunCardDialog request={REQUEST} onResolve={onResolve} />
            </I18nProvider>
        </CssVarsProvider>
    );
    return onResolve;
};

const load = (c: RunCard) => vi.mocked(api.fetchRunCard).mockResolvedValue({ ok: true, data: c });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.confirmSkillRun).mockResolvedValue({
        ok: true,
        data: { versionNo: 3, outside: true, harmful: false },
    });
});

describe("SkillRunCardDialog", () => {
    it("asks for the card of this team and version", async () => {
        load(card());
        renderCard();
        await screen.findByText("Summarise my week.");
        expect(api.fetchRunCard).toHaveBeenCalledWith("tok", "s1", "team-1", 3);
    });

    it("starts focus on Cancel, so a reflex Enter runs nothing", async () => {
        load(card());
        renderCard();
        await screen.findByText("Summarise my week.");
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows the author's handle and nothing else about them", async () => {
        load(card());
        renderCard();
        await screen.findByText("@ayumi");
        expect(screen.queryByText(/Ayumi Tanaka/)).toBeNull();
    });

    it("draws the skill text as plain text, never as markup", async () => {
        const body =
            '# Title\n![pixel](https://evil.example/p.png)\n[link](https://evil.example)\n<img src="x" onerror="alert(1)"><b>bold</b>';
        load(card({ bodyMarkdown: body }));
        renderCard();
        const block = await screen.findByRole("region", { name: "What this skill says" });
        expect(block.tagName).toBe("PRE");
        expect(block.textContent).toBe(body);
        expect(block.querySelector("img, a, b, h1")).toBeNull();
        expect(document.querySelector('img[src*="evil.example"]')).toBeNull();
        // Reachable by keyboard so a long text can be scrolled without a mouse.
        expect(block).toHaveAttribute("tabindex", "0");
    });

    it("says what the skill may propose, and that each needs approval", async () => {
        load(
            card({
                toolLevel: "act",
                mayPropose: ["create_task", "create_note", "create_todo_item"],
            })
        );
        renderCard();
        await screen.findByText("Propose creating a task");
        expect(screen.getByText("Propose creating a note")).toBeInTheDocument();
        expect(screen.getByText("Propose adding a to-do item")).toBeInTheDocument();
        expect(
            screen.getByText("Each one happens only after you approve it.")
        ).toBeInTheDocument();
        expect(screen.queryByText(/can only read/i)).toBeNull();
    });

    it("says it can only read when nothing may be proposed", async () => {
        load(card({ mayPropose: [] }));
        renderCard();
        await screen.findByText(/It can only read/);
        expect(screen.queryByText("Propose creating a task")).toBeNull();
    });

    it("warns, in fixed words, about a copy of a skill removed as harmful", async () => {
        load(card({ harmful: true, outside: false, author: null }));
        renderCard();
        const warning = await screen.findByText(
            "The skill this was copied from was removed by Genos as harmful."
        );
        expect(warning).toBeInTheDocument();
        expect(screen.getByText(/No author named/)).toBeInTheDocument();
    });

    it("has no warning for a skill that was not removed", async () => {
        load(card({ harmful: false }));
        renderCard();
        await screen.findByText("Summarise my week.");
        expect(screen.queryByText(/removed by Genos/)).toBeNull();
    });

    it("confirms the version and then resolves true", async () => {
        load(card());
        const onResolve = renderCard();
        const run = await screen.findByRole("button", { name: "Run this skill" });
        await waitFor(() => expect(run).toBeEnabled());
        await userEvent.click(run);
        await waitFor(() => expect(onResolve).toHaveBeenCalledWith(true));
        expect(api.confirmSkillRun).toHaveBeenCalledWith("tok", "s1", "team-1", 3);
        expect(onResolve).toHaveBeenCalledTimes(1);
    });

    it("cannot be run before the card has loaded", async () => {
        vi.mocked(api.fetchRunCard).mockReturnValue(new Promise(() => {}));
        renderCard();
        expect(await screen.findByRole("button", { name: "Run this skill" })).toBeDisabled();
        expect(screen.getByText("Loading the skill…")).toBeInTheDocument();
    });

    it("Cancel resolves false and confirms nothing", async () => {
        load(card());
        const onResolve = renderCard();
        await screen.findByText("Summarise my week.");
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onResolve).toHaveBeenCalledWith(false);
        expect(api.confirmSkillRun).not.toHaveBeenCalled();
    });

    it("Escape cancels", async () => {
        load(card());
        const onResolve = renderCard();
        await screen.findByText("Summarise my week.");
        await userEvent.keyboard("{Escape}");
        expect(onResolve).toHaveBeenCalledWith(false);
        expect(api.confirmSkillRun).not.toHaveBeenCalled();
    });

    it("keeps the card open with a sentence when the confirmation fails", async () => {
        load(card());
        vi.mocked(api.confirmSkillRun).mockResolvedValue({
            ok: false,
            reason: "error",
            message: "",
        });
        const onResolve = renderCard();
        const run = await screen.findByRole("button", { name: "Run this skill" });
        await waitFor(() => expect(run).toBeEnabled());
        await userEvent.click(run);
        await screen.findByText("Couldn't save your answer. Please try again.");
        expect(onResolve).not.toHaveBeenCalled();
    });

    it("shows the server's sentence when the skill is not installed", async () => {
        vi.mocked(api.fetchRunCard).mockResolvedValue({
            ok: false,
            reason: "bad_input",
            message: "Install this skill before you run it.",
        });
        renderCard();
        await screen.findByText("Install this skill before you run it.");
        expect(screen.getByRole("button", { name: "Run this skill" })).toBeDisabled();
    });
});
