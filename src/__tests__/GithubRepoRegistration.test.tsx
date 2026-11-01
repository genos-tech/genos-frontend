/**
 * "Register a repository" on the integrations page (MIP-755).
 *
 * A hook added by hand in GitHub's settings answers 200 and links nothing
 * until the repo is registered. This panel registers (or takes over) a repo
 * with the user's own GitHub connection, says why when it can't, and lists the
 * repos that are sending events Genos can't use yet.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GithubRepoRegistration } from "../features/integrations/components/GithubRepoRegistration";
import { parseRepoInput } from "../features/integrations/services/github";
import { I18nProvider } from "../i18n";

const svc = vi.hoisted(() => ({
    listUnregisteredRepos: vi.fn(),
    registerGithubRepo: vi.fn(),
}));
vi.mock("../features/integrations/services/github", async (orig) => ({
    ...(await orig<typeof import("../features/integrations/services/github")>()),
    listUnregisteredRepos: svc.listUnregisteredRepos,
    registerGithubRepo: svc.registerGithubRepo,
}));

const repo = (over = {}) => ({
    owner: "acme",
    repo: "rocket",
    event_count: 3,
    last_event: "pull_request",
    last_seen_at: "2026-11-01T00:00:00Z",
    can_admin: true,
    ...over,
});

const renderPanel = () =>
    render(
        <I18nProvider>
            <CssVarsProvider>
                <GithubRepoRegistration accessToken="tok" />
            </CssVarsProvider>
        </I18nProvider>
    );

beforeEach(() => {
    svc.listUnregisteredRepos.mockReset();
    svc.registerGithubRepo.mockReset();
    svc.listUnregisteredRepos.mockResolvedValue({ repos: [], connected: true });
});

const type = (value: string) =>
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo/), { target: { value } });

describe("parseRepoInput", () => {
    it("takes owner/repo and GitHub URLs", () => {
        expect(parseRepoInput("acme/rocket")).toEqual(["acme", "rocket"]);
        expect(parseRepoInput("  acme/rocket  ")).toEqual(["acme", "rocket"]);
        expect(parseRepoInput("https://github.com/acme/rocket")).toEqual(["acme", "rocket"]);
        expect(parseRepoInput("https://github.com/acme/rocket/pull/12")).toEqual([
            "acme",
            "rocket",
        ]);
        expect(parseRepoInput("https://github.com/acme/rocket.git")).toEqual(["acme", "rocket"]);
        expect(parseRepoInput("acme/.github")).toEqual(["acme", ".github"]);
    });

    it("refuses what the server would refuse", () => {
        for (const bad of [
            "",
            "acme",
            "acme/",
            "/rocket",
            "a b/c",
            "my.org/x",
            "acme/..",
            "acme/.",
        ]) {
            expect(parseRepoInput(bad), bad).toBeNull();
        }
    });
});

describe("GithubRepoRegistration", () => {
    it("registers the repo typed as a URL, says so, and clears the box", async () => {
        svc.registerGithubRepo.mockResolvedValue({ ok: true, reason: "created" });
        renderPanel();
        type("https://github.com/acme/rocket/pull/12");
        fireEvent.click(screen.getByRole("button", { name: "Register" }));

        await screen.findByText(/Registered acme\/rocket/);
        expect(svc.registerGithubRepo).toHaveBeenCalledWith("tok", "acme", "rocket");
        expect(screen.getByPlaceholderText(/owner\/repo/)).toHaveValue("");
        // The list is refreshed: the repo may have just left it.
        await waitFor(() => expect(svc.listUnregisteredRepos).toHaveBeenCalledTimes(2));
    });

    it("says it took over an existing hook", async () => {
        svc.registerGithubRepo.mockResolvedValue({ ok: true, reason: "adopted" });
        renderPanel();
        type("acme/rocket");
        fireEvent.click(screen.getByRole("button", { name: "Register" }));
        await screen.findByText(/Took over the existing webhook on acme\/rocket/);
    });

    it("explains each failure instead of a generic error", async () => {
        const cases: [string, RegExp][] = [
            ["no_admin", /isn't an admin of that repo/],
            ["repo_not_found", /can't see that repo/],
            ["adopt_failed", /already has a webhook/],
            ["github_error", /GitHub refused/],
            ["something_new", /Something went wrong/],
        ];
        for (const [reason, text] of cases) {
            svc.registerGithubRepo.mockResolvedValue({ ok: false, reason });
            const { unmount } = renderPanel();
            type("acme/rocket");
            fireEvent.click(screen.getByRole("button", { name: "Register" }));
            await screen.findByText(text);
            unmount();
        }
    });

    it("refuses an unusable name without calling the server", () => {
        renderPanel();
        type("not a repo");
        fireEvent.click(screen.getByRole("button", { name: "Register" }));
        expect(screen.getByText(/Enter a repo as owner\/repo/)).toBeInTheDocument();
        expect(svc.registerGithubRepo).not.toHaveBeenCalled();
    });

    it("keeps the button off until something is typed", () => {
        renderPanel();
        expect(screen.getByRole("button", { name: "Register" })).toBeDisabled();
    });

    it("lists repos that send events and registers one from the list", async () => {
        svc.listUnregisteredRepos.mockResolvedValue({
            repos: [
                repo(),
                repo({ owner: "acme", repo: "locked", can_admin: false, event_count: 1 }),
            ],
            connected: true,
        });
        svc.registerGithubRepo.mockResolvedValue({ ok: true, reason: "adopted" });
        renderPanel();

        await screen.findByText("Repos sending events Genos can't use yet");
        expect(screen.getByText("acme/rocket")).toBeInTheDocument();
        expect(screen.getByText(/3 events · last: pull_request/)).toBeInTheDocument();
        expect(screen.getByText(/1 event · last: pull_request/)).toBeInTheDocument();

        const buttons = screen.getAllByRole("button", { name: "Register" });
        // [0] is the form's (disabled, nothing typed); the rows follow.
        expect(buttons[1]).toBeEnabled();
        expect(buttons[2]).toBeDisabled(); // the repo the user doesn't administer
        fireEvent.click(buttons[1]);
        await waitFor(() =>
            expect(svc.registerGithubRepo).toHaveBeenCalledWith("tok", "acme", "rocket")
        );
    });

    it("shows no list when nothing is sending events", async () => {
        renderPanel();
        await waitFor(() => expect(svc.listUnregisteredRepos).toHaveBeenCalled());
        expect(screen.queryByText("Repos sending events Genos can't use yet")).toBeNull();
    });

    it("survives a failed list lookup", async () => {
        svc.listUnregisteredRepos.mockResolvedValue(null);
        renderPanel();
        await waitFor(() => expect(svc.listUnregisteredRepos).toHaveBeenCalled());
        expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    });
});

describe("manual webhook steps", () => {
    const localesDir = join(__dirname, "..", "i18n", "locales");

    it("no locale still tells people to tick only Pull requests", () => {
        const dirs = readdirSync(localesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
        expect(dirs.length).toBeGreaterThan(3);
        for (const dir of dirs) {
            for (const file of readdirSync(join(localesDir, dir))) {
                const text = readFileSync(join(localesDir, dir, file), "utf8");
                expect(text, `${dir}/${file}`).not.toMatch(/stepEventsSuffix|pullRequestsLabel/);
            }
        }
    });

    it("the English steps name all three events and end with registering", () => {
        const en = readFileSync(join(localesDir, "en", "integrations.ts"), "utf8");
        expect(en).toMatch(/Pull requests, Issue comments and Pull request review comments/);
        expect(en).toMatch(/stepRegister/);
    });
});
