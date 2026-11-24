import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecentAuthPrompt } from "../components/ui/modal/RecentAuthDialog";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { createApiKey, createWebhook } from "../services/developerApi";
import {
    needsRecentAuth,
    submitConsentDecision,
    updateMcpConnection,
} from "../services/mcpConnections";
import {
    confirmPassword,
    forgetRecentAuth,
    getRecentAuthToken,
    isRecentAuthRefusal,
} from "../services/recentAuth";

const post = vi.fn();
const patch = vi.fn();

vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { post, patch } : null),
}));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "jwt" }) }));

const REFUSAL = { response: { status: 403, data: { code: "recent_auth_required" } } };

beforeEach(() => {
    post.mockReset();
    patch.mockReset();
    forgetRecentAuth();
});

describe("confirmPassword", () => {
    it("keeps the token in memory for the window, less a margin", async () => {
        post.mockResolvedValue({
            data: { required: true, recent_auth_token: "t1", expires_in: 600 },
        });
        expect(await confirmPassword("jwt", "pw")).toEqual({ status: "ok", token: "t1" });
        expect(post).toHaveBeenCalledWith(
            "/user/confirm-password/",
            { password: "pw" },
            { suppressErrorToast: true }
        );
        const now = Date.now();
        expect(getRecentAuthToken(now + 500_000)).toBe("t1");
        expect(getRecentAuthToken(now + 590_000)).toBeNull();
        expect(getRecentAuthToken(now)).toBeNull(); // dropped once expired
    });

    it("never writes the token to browser storage", async () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        post.mockResolvedValue({
            data: { required: true, recent_auth_token: "t2", expires_in: 600 },
        });
        await confirmPassword("jwt", "pw");
        expect(setItem).not.toHaveBeenCalled();
        setItem.mockRestore();
    });

    it("tells wrong, throttled and failed apart", async () => {
        post.mockRejectedValueOnce({ response: { status: 403 } });
        expect(await confirmPassword("jwt", "x")).toEqual({ status: "wrong" });
        post.mockRejectedValueOnce({ response: { status: 429 } });
        expect(await confirmPassword("jwt", "x")).toEqual({ status: "throttled" });
        post.mockRejectedValueOnce(new Error("offline"));
        expect(await confirmPassword("jwt", "x")).toEqual({ status: "error" });
        expect(getRecentAuthToken()).toBeNull();
    });

    it("an account with no password is told nothing is needed", async () => {
        post.mockResolvedValue({ data: { required: false } });
        expect(await confirmPassword("jwt", "x")).toEqual({ status: "not_required" });
    });
});

describe("the refusal on each creating call", () => {
    it("reads only the server's code as a request for the password", () => {
        expect(isRecentAuthRefusal(REFUSAL)).toBe(true);
        expect(isRecentAuthRefusal({ response: { status: 403, data: { error: "x" } } })).toBe(
            false
        );
        expect(isRecentAuthRefusal(new Error("x"))).toBe(false);
    });

    it("an API key says recent_auth, and sends the token when it has one", async () => {
        post.mockRejectedValueOnce(REFUSAL);
        expect(await createApiKey("jwt", { name: "k", scope: "read" })).toEqual({
            status: "recent_auth",
        });
        post.mockResolvedValueOnce({ data: { key: "gnos_x", id: "1" } });
        await createApiKey("jwt", { name: "k", scope: "read", recentAuthToken: "tok" });
        expect(post.mock.calls[1][1]).toMatchObject({ recent_auth_token: "tok" });
    });

    it("a webhook says recent_auth, not 'only a manager' (also a 403)", async () => {
        post.mockRejectedValueOnce(REFUSAL);
        expect(
            await createWebhook("jwt", { teamId: "t", url: "https://a.test", events: ["x"] })
        ).toEqual({ status: "recent_auth" });
        post.mockRejectedValueOnce({ response: { status: 403, data: { error: "managers" } } });
        expect(
            await createWebhook("jwt", { teamId: "t", url: "https://a.test", events: ["x"] })
        ).toEqual({ status: "forbidden" });
    });

    it("an app's consent says so, and carries the token", async () => {
        post.mockRejectedValueOnce({
            response: {
                status: 403,
                data: { error: "Enter your password", code: "recent_auth_required" },
            },
        });
        const res = await submitConsentDecision("jwt", { client_id: "a" }, { allow: false });
        expect(needsRecentAuth(res)).toBe(true);
        post.mockResolvedValueOnce({ data: { redirect_to: "https://a.test/cb" } });
        await submitConsentDecision(
            "jwt",
            { client_id: "a" },
            { allow: true, scopes: ["mcp:read"], teamIds: ["t"], defaultTeamId: "t" },
            "tok"
        );
        expect(post.mock.calls[1][1]).toMatchObject({ recent_auth_token: "tok" });
        // A refusal for another reason is not a request for the password.
        post.mockRejectedValueOnce({
            response: { status: 403, data: { error: "plan_required" } },
        });
        expect(
            needsRecentAuth(
                await submitConsentDecision("jwt", { client_id: "a" }, { allow: false })
            )
        ).toBe(false);
    });
});

describe("widening a connected app", () => {
    it("reads the refusal, and sends the token on the retry", async () => {
        patch.mockRejectedValueOnce({
            response: { status: 403, data: { error: "Enter", code: "recent_auth_required" } },
        });
        const refused = await updateMcpConnection("jwt", "c1", { scopes: ["mcp:write"] });
        expect(refused).toMatchObject({ ok: false, recentAuth: true });
        patch.mockResolvedValueOnce({ data: { id: "c1" } });
        await updateMcpConnection("jwt", "c1", { scopes: ["mcp:write"], recentAuthToken: "tok" });
        expect(patch.mock.calls[1][1]).toMatchObject({ recent_auth_token: "tok" });
        // Any other 403 is not a request for the password.
        patch.mockRejectedValueOnce({ response: { status: 403, data: { error: "x" } } });
        expect(
            (await updateMcpConnection("jwt", "c1", { scopes: ["mcp:write"] })) as {
                recentAuth?: boolean;
            }
        ).not.toHaveProperty("recentAuth");
    });
});

describe("the password prompt", () => {
    const Harness = ({
        run,
        onDone,
    }: {
        run: (token: string | undefined) => Promise<{ status: string }>;
        onDone: (r: { status: string }) => void;
    }) => {
        const { guard, dialog } = useRecentAuthPrompt();
        return (
            <>
                <button
                    type="button"
                    onClick={async () =>
                        onDone(await guard(run, (r) => r.status === "recent_auth"))
                    }
                >
                    go
                </button>
                {dialog}
            </>
        );
    };

    it("does not ask when the call goes through", async () => {
        const run = vi.fn().mockResolvedValue({ status: "created" });
        const onDone = vi.fn();
        render(<Harness run={run} onDone={onDone} />);
        fireEvent.click(screen.getByText("go"));
        await waitFor(() => expect(onDone).toHaveBeenCalledWith({ status: "created" }));
        expect(screen.queryByLabelText(en.common.recentAuth.passwordLabel)).toBeNull();
    });

    it("asks, checks the password, then runs the call again with the token", async () => {
        const run = vi
            .fn()
            .mockResolvedValueOnce({ status: "recent_auth" })
            .mockResolvedValueOnce({ status: "created" });
        const onDone = vi.fn();
        post.mockResolvedValue({
            data: { required: true, recent_auth_token: "fresh", expires_in: 600 },
        });
        render(<Harness run={run} onDone={onDone} />);
        fireEvent.click(screen.getByText("go"));
        const field = await screen.findByLabelText(en.common.recentAuth.passwordLabel);
        fireEvent.change(field, { target: { value: "hunter2" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: en.common.recentAuth.confirm }));
        });
        await waitFor(() => expect(onDone).toHaveBeenCalledWith({ status: "created" }));
        expect(run).toHaveBeenNthCalledWith(1, undefined);
        expect(run).toHaveBeenNthCalledWith(2, "fresh");
    });

    it("says the password is wrong and keeps the dialog open", async () => {
        const run = vi.fn().mockResolvedValue({ status: "recent_auth" });
        post.mockRejectedValue({ response: { status: 403 } });
        render(<Harness run={run} onDone={vi.fn()} />);
        fireEvent.click(screen.getByText("go"));
        const field = await screen.findByLabelText(en.common.recentAuth.passwordLabel);
        fireEvent.change(field, { target: { value: "nope" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: en.common.recentAuth.confirm }));
        });
        expect(await screen.findByText(en.common.recentAuth.wrong)).toBeTruthy();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("cancelling returns the refusal and runs nothing more", async () => {
        const run = vi.fn().mockResolvedValue({ status: "recent_auth" });
        const onDone = vi.fn();
        render(<Harness run={run} onDone={onDone} />);
        fireEvent.click(screen.getByText("go"));
        await screen.findByLabelText(en.common.recentAuth.passwordLabel);
        fireEvent.click(screen.getByRole("button", { name: en.common.recentAuth.cancel }));
        await waitFor(() => expect(onDone).toHaveBeenCalledWith({ status: "recent_auth" }));
        expect(run).toHaveBeenCalledTimes(1);
        expect(post).not.toHaveBeenCalled();
    });
});

describe("the words", () => {
    it("every language has every line, and none is left as the English", () => {
        const keys = Object.keys(en.common.recentAuth);
        for (const [name, locale] of Object.entries({ ja, ar, es, fr, hi, zh })) {
            const block = (locale as unknown as { common: { recentAuth: Record<string, string> } })
                .common.recentAuth;
            expect(Object.keys(block).sort(), name).toEqual([...keys].sort());
            for (const key of keys) {
                expect(block[key].trim().length, `${name}.${key}`).toBeGreaterThan(0);
                if (key !== "passwordLabel") {
                    expect(block[key], `${name}.${key}`).not.toBe(
                        (en.common.recentAuth as Record<string, string>)[key]
                    );
                }
            }
        }
    });
});
