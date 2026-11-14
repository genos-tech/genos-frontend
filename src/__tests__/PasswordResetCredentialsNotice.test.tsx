/**
 * A password reset now ends every connected AI app and API key (api #823). The confirm response
 * is `{connections_ended, api_keys_revoked}` (it was empty), and the success state says so, but
 * only when something was ended and never when an older API answers with no body.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "../features/admin/components/ResetPasswordForm";
import {
    confirmPasswordReset,
    credentialsWereEnded,
} from "../features/admin/services/passwordReset";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { nonAuthApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn(), nonAuthApi: vi.fn() }));
const navigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
    useNavigate: () => navigate,
}));

const post = vi.fn();
beforeEach(() => {
    post.mockReset();
    navigate.mockReset();
    (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

const NOTICE =
    "Your connected AI apps and API keys were ended. Reconnect your apps and create new keys when you need them.";

describe("credentialsWereEnded", () => {
    it.each([
        [{ connections_ended: 1, api_keys_revoked: 0 }, true],
        [{ connections_ended: 0, api_keys_revoked: 3 }, true],
        [{ connections_ended: 2, api_keys_revoked: 5 }, true],
        [{ connections_ended: 0, api_keys_revoked: 0 }, false],
        // an older API: an empty body, or no body at all
        ["", false],
        [undefined, false],
        [null, false],
        [{}, false],
        // one count missing still counts the other
        [{ connections_ended: 1 }, true],
        // never trust a shape that is not a count
        [{ connections_ended: "2", api_keys_revoked: "1" }, false],
        [{ connections_ended: -1, api_keys_revoked: 0 }, false],
        [{ connections_ended: Number.NaN, api_keys_revoked: Number.POSITIVE_INFINITY }, false],
        [[1, 2], false],
    ])("%j -> %s", (body, expected) => {
        expect(credentialsWereEnded(body)).toBe(expected);
    });
});

describe("confirmPasswordReset", () => {
    it("reports whether anything was ended", async () => {
        post.mockResolvedValue({ data: { connections_ended: 2, api_keys_revoked: 1 } });
        expect(await confirmPasswordReset("tok", "Passw0rd!x")).toEqual({
            credentialsEnded: true,
        });
        expect(post).toHaveBeenCalledWith("/user/password-reset/confirm/", {
            token: "tok",
            new_password: "Passw0rd!x",
        });
    });

    it("an empty body from an older API is a success with nothing to report", async () => {
        post.mockResolvedValue({ data: "" });
        expect(await confirmPasswordReset("tok", "Passw0rd!x")).toEqual({
            credentialsEnded: false,
        });
        post.mockResolvedValue({});
        expect(await confirmPasswordReset("tok", "Passw0rd!x")).toEqual({
            credentialsEnded: false,
        });
    });

    it("is null on failure, with the server's reason surfaced", async () => {
        const err = Object.assign(new Error("400"), {
            isAxiosError: true,
            response: { status: 400, data: { detail: "Token expired." } },
        });
        post.mockRejectedValue(err);
        const setError = vi.fn();
        expect(await confirmPasswordReset("tok", "Passw0rd!x", setError)).toBeNull();
        expect(setError).toHaveBeenCalledWith("Token expired.");
    });
});

const renderForm = () =>
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/reset-password?token=abc"]}>
                <ResetPasswordForm />
            </MemoryRouter>
        </CssVarsProvider>
    );

const submit = async () => {
    const [pw, confirm] = Array.from(document.querySelectorAll("input"));
    fireEvent.change(pw, { target: { value: "Passw0rd!x" } });
    fireEvent.change(confirm, { target: { value: "Passw0rd!x" } });
    await act(async () => {
        fireEvent.submit(pw.closest("form")!);
    });
};

describe("ResetPasswordForm success state", () => {
    it("tells the member their apps and keys were ended, in a status region", async () => {
        post.mockResolvedValue({ data: { connections_ended: 1, api_keys_revoked: 2 } });
        renderForm();
        await submit();
        expect(await screen.findByText(NOTICE)).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(NOTICE);
        expect(screen.getByText("Password updated")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Sign in now" }));
        expect(navigate).toHaveBeenCalledWith("/signin");
    });

    it("says nothing when the counts are both zero", async () => {
        post.mockResolvedValue({ data: { connections_ended: 0, api_keys_revoked: 0 } });
        renderForm();
        await submit();
        expect(await screen.findByText("Password updated")).toBeInTheDocument();
        expect(screen.queryByText(NOTICE)).toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
    });

    it.each([
        ["empty string", ""],
        ["undefined", undefined],
        ["null", null],
        ["{}", {}],
    ])(
        "an older API with %s as the body shows no notice and does not crash",
        async (_name, data) => {
            post.mockResolvedValue({ data });
            renderForm();
            await submit();
            expect(await screen.findByText("Password updated")).toBeInTheDocument();
            expect(screen.queryByText(NOTICE)).toBeNull();
        }
    );

    it("never shows it on a failed reset", async () => {
        post.mockRejectedValue(
            Object.assign(new Error("400"), {
                isAxiosError: true,
                response: { status: 400, data: { detail: "Token expired." } },
            })
        );
        renderForm();
        await submit();
        expect(await screen.findByText("Token expired.")).toBeInTheDocument();
        expect(screen.queryByText(NOTICE)).toBeNull();
        expect(screen.queryByText("Password updated")).toBeNull();
    });

    it("waits long enough to read the notice before leaving, and keeps the quick bounce without it", async () => {
        vi.useFakeTimers();
        post.mockResolvedValue({ data: { connections_ended: 1, api_keys_revoked: 0 } });
        renderForm();
        await submit();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });
        expect(navigate).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(9000);
        });
        expect(navigate).toHaveBeenCalledWith("/signin");

        cleanup();
        navigate.mockReset();
        post.mockResolvedValue({ data: "" });
        renderForm();
        await submit();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });
        expect(navigate).toHaveBeenCalledWith("/signin");
    });
});

describe("the notice in every locale", () => {
    const OTHERS = { ja, es, fr, zh, ar, hi } as const;
    const get = (cat: unknown, key: string) =>
        (cat as { admin: { auth: { passwordReset: Record<string, string> } } }).admin.auth
            .passwordReset[key];

    it("English carries the agreed sentence", () => {
        expect(get(en, "credentialsEnded")).toBe(NOTICE);
    });

    it.each(Object.entries(OTHERS))(
        "%s ships its own credentialsEnded and signInNow (no English fallback)",
        (_name, cat) => {
            for (const key of ["credentialsEnded", "signInNow"]) {
                const v = get(cat, key);
                expect(typeof v).toBe("string");
                expect(v.length).toBeGreaterThan(3);
                expect(v).not.toBe(get(en, key));
            }
        }
    );

    it("Japanese reads naturally and Arabic is Arabic", () => {
        expect(get(ja, "credentialsEnded")).toMatch(/AI アプリ.*API キー/);
        expect(get(ar, "credentialsEnded")).toMatch(/[؀-ۿ]/);
    });
});
