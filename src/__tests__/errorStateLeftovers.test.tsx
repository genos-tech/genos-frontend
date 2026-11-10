/**
 * MIP-1306: the three failure UIs that were still hand-built (the create-task
 * bootstrap pane, the linked-PR card, the security activity list) are the shared
 * ErrorState. Like `loadStates.test.tsx`, the cases fail at the REQUEST (axios
 * `get` rejects) and check that Retry lands the second one.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorState } from "../components/ui/feedback/ErrorState";
import { LinkedPrCard } from "../features/integrations/components/LinkedPrCard";
import { clearPrStatusCache } from "../features/integrations/services/prStatusCache";
import { TaskPaneError } from "../features/tasks/components/contents/base/TaskPaneError";
import { en } from "../i18n/locales/en";

const answers = vi.hoisted(() => ({ queue: [] as Array<{ match: string; out: unknown }> }));
const calls = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("../services/api", async (orig) => ({
    ...(await orig<typeof import("../services/api")>()),
    authApi: () => ({
        get: vi.fn(async (url: string) => {
            calls.urls.push(url);
            const i = answers.queue.findIndex((a) => url.includes(a.match));
            const hit = i >= 0 ? answers.queue.splice(i, 1)[0] : undefined;
            if (!hit) throw new Error(`unexpected request ${url}`);
            if (hit.out instanceof Error) throw hit.out;
            return { data: hit.out };
        }),
    }),
}));

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });

const PR_URL = "https://github.com/acme/rocket/pull/7";
const prPayload = {
    pull: {
        title: "Fix the launch pad",
        number: 7,
        html_url: PR_URL,
        state: "open",
        draft: false,
        merged: false,
        base: { repo: { full_name: "acme/rocket" } },
    },
    combined_status: null,
    check_runs: null,
};

beforeEach(() => {
    answers.queue.length = 0;
    calls.urls.length = 0;
    clearPrStatusCache();
});
afterEach(() => vi.restoreAllMocks());

describe("ErrorState secondary action", () => {
    it("draws the secondary before Retry, and runs it without retrying", () => {
        const onRetry = vi.fn();
        const onClick = vi.fn();
        render(
            wrap(
                <ErrorState
                    secondary={{ label: "Cancel", onClick }}
                    title="Couldn't load it"
                    onRetry={onRetry}
                />
            )
        );
        const buttons = screen.getAllByRole("button");
        expect(buttons.map((b) => b.textContent)).toEqual(["Cancel", "Retry"]);
        fireEvent.click(buttons[0]);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onRetry).not.toHaveBeenCalled();
    });

    it("an href makes it a link that opens in a new tab (xs too)", () => {
        render(
            wrap(
                <ErrorState
                    secondary={{ label: "Open on GitHub", href: PR_URL }}
                    size="xs"
                    title="Couldn't load it"
                    onRetry={() => {}}
                />
            )
        );
        const link = screen.getByRole("link", { name: "Open on GitHub" });
        expect(link.getAttribute("href")).toBe(PR_URL);
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noreferrer");
        expect(retry()).toBeTruthy();
    });
});

describe("TaskPaneError (create-task bootstrap)", () => {
    it("says what failed, the connection hint, and Cancel / Retry both work", () => {
        const onRetry = vi.fn();
        const onCancel = vi.fn();
        render(
            wrap(
                <TaskPaneError
                    cancelLabel="Cancel"
                    title={en.tasks.createForm.bootstrapFailed}
                    onCancel={onCancel}
                    onRetry={onRetry}
                />
            )
        );
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.getByText(en.tasks.createForm.bootstrapFailed)).toBeTruthy();
        expect(screen.getByText(en.common.feedback.loadFailedBody)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(retry());
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("a plan-limit reason replaces the connection hint", () => {
        render(
            wrap(
                <TaskPaneError
                    body="Your plan allows 50 tasks."
                    cancelLabel="Cancel"
                    title="Couldn't prepare a new task"
                    onCancel={() => {}}
                    onRetry={() => {}}
                />
            )
        );
        expect(screen.getByText("Your plan allows 50 tasks.")).toBeTruthy();
        expect(screen.queryByText(en.common.feedback.loadFailedBody)).toBeNull();
    });
});

describe("LinkedPrCard", () => {
    it("a failed lookup says so, keeps the GitHub link, and Retry sends the request again", async () => {
        answers.queue.push({ match: "/github/pulls/", out: new Error("Network Error") });
        answers.queue.push({ match: "/github/pulls/", out: prPayload });
        render(wrap(<LinkedPrCard accessToken="tok" url={PR_URL} />));

        expect(
            await screen.findByText(en.integrations.pullRequest.linkedCard.loadFailed)
        ).toBeTruthy();
        expect(
            screen
                .getByRole("link", { name: en.integrations.github.openOnGithub })
                .getAttribute("href")
        ).toBe(PR_URL);

        fireEvent.click(retry());

        expect(await screen.findByText("Fix the launch pad")).toBeTruthy();
        expect(screen.queryByText(en.integrations.pullRequest.linkedCard.loadFailed)).toBeNull();
        await waitFor(() =>
            expect(calls.urls.filter((u) => u.includes("/github/pulls/"))).toHaveLength(2)
        );
    });
});
