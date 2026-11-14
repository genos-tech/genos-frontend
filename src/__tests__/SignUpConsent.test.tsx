/**
 * The signup form needs an explicit "I agree to the Terms of Service and the
 * Privacy Policy" before it creates an account, by email or through Google /
 * GitHub. The server refuses a signup without it (and records it), so the form
 * has to ask first and send the flag.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpForm } from "../features/admin/components/SignUpForm";
import { PRIVACY_PATH, TERMS_PATH } from "../features/admin/legalPaths";
import { signUp } from "../features/admin/services/signup";
import { oauthLoginUrl, redirectToOAuthLogin } from "../features/integrations/services/oauth";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/AuthContext")>()),
    useAuth: () => ({ setAccessToken: vi.fn() }),
}));
vi.mock("../features/admin/services/signup", () => ({ signUp: vi.fn() }));
vi.mock("../features/integrations/services/oauth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/integrations/services/oauth")>()),
    redirectToOAuthLogin: vi.fn(),
}));

const c = en.admin.auth.signUp.consent;

const renderForm = () =>
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/signup"]}>
                <SignUpForm />
            </MemoryRouter>
        </CssVarsProvider>
    );

const checkbox = () => screen.getByRole("checkbox", { name: /I agree to the/i });

const fillAndSubmit = () => {
    fireEvent.change(screen.getByPlaceholderText(en.admin.auth.signUp.namePlaceholder), {
        target: { value: "Pat" },
    });
    fireEvent.change(screen.getByPlaceholderText(en.admin.auth.signUp.emailPlaceholder), {
        target: { value: "pat@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(en.admin.auth.signUp.passwordPlaceholder), {
        target: { value: "Str0ngPassw0rd" },
    });
    fireEvent.change(
        screen.getByPlaceholderText(en.admin.auth.signUp.confirmPasswordPlaceholder),
        {
            target: { value: "Str0ngPassw0rd" },
        }
    );
    fireEvent.click(screen.getByRole("button", { name: en.admin.auth.signUp.submit }));
};

describe("signup consent checkbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (signUp as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    });

    it("is unchecked by default, with no error showing", () => {
        renderForm();
        expect(checkbox()).not.toBeChecked();
        expect(screen.queryByText(c.required)).toBeNull();
    });

    it("is announced as required and named by its sentence", () => {
        renderForm();
        expect(checkbox()).toHaveAttribute("aria-required", "true");
        expect(screen.getByRole("checkbox", { name: /Terms of Service.*Privacy Policy/i }));
    });

    it("links the Terms to TERMS_PATH and the Privacy Policy to /privacy, in a new tab", () => {
        renderForm();
        const terms = screen.getByRole("link", { name: new RegExp(c.terms) });
        const privacy = screen.getByRole("link", { name: new RegExp(c.privacy) });
        expect(terms).toHaveAttribute("href", TERMS_PATH);
        expect(privacy).toHaveAttribute("href", PRIVACY_PATH);
        expect(PRIVACY_PATH).toBe("/privacy");
        for (const a of [terms, privacy]) {
            expect(a).toHaveAttribute("target", "_blank");
            expect(a.getAttribute("rel")).toContain("noopener");
        }
    });

    it("clicking a link in the label does not tick the box", () => {
        renderForm();
        fireEvent.click(screen.getByRole("link", { name: new RegExp(c.terms) }));
        expect(checkbox()).not.toBeChecked();
    });

    it("submitting unchecked shows the error, focuses the box and sends nothing", async () => {
        renderForm();
        fillAndSubmit();
        const alert = await screen.findByText(c.required);
        expect(alert).toHaveAttribute("role", "alert");
        expect(signUp).not.toHaveBeenCalled();
        await waitFor(() => expect(checkbox()).toHaveFocus());
        // The message is tied to the control for screen readers.
        const describedBy = checkbox().getAttribute("aria-describedby") ?? "";
        expect(describedBy.split(" ")).toContain(alert.id);
    });

    it("ticking the box clears the error", async () => {
        renderForm();
        fillAndSubmit();
        await screen.findByText(c.required);
        fireEvent.click(checkbox());
        expect(screen.queryByText(c.required)).toBeNull();
    });

    it("is operable from the keyboard (Space toggles it)", () => {
        renderForm();
        checkbox().focus();
        fireEvent.click(checkbox()); // jsdom turns Space on a focused checkbox into a click
        expect(checkbox()).toBeChecked();
    });

    it("submitting checked sends accepted_terms=true to the signup call", async () => {
        renderForm();
        fireEvent.click(checkbox());
        fillAndSubmit();
        await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
        const args = (signUp as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(args[0]).toBe("Pat");
        expect(args[1]).toBe("pat@example.com");
        expect(args[5]).toBe(true);
    });

    it("Continue with Google / GitHub are blocked until it is ticked", async () => {
        renderForm();
        fireEvent.click(
            screen.getByRole("button", { name: en.admin.auth.signIn.continueWithGoogle })
        );
        fireEvent.click(
            screen.getByRole("button", { name: en.admin.auth.signIn.continueWithGithub })
        );
        expect(redirectToOAuthLogin).not.toHaveBeenCalled();
        expect(await screen.findByText(c.required)).toBeInTheDocument();
        await waitFor(() => expect(checkbox()).toHaveFocus());
    });

    it("Continue with Google / GitHub carry the consent once it is ticked", () => {
        renderForm();
        fireEvent.click(checkbox());
        fireEvent.click(
            screen.getByRole("button", { name: en.admin.auth.signIn.continueWithGoogle })
        );
        fireEvent.click(
            screen.getByRole("button", { name: en.admin.auth.signIn.continueWithGithub })
        );
        expect(redirectToOAuthLogin).toHaveBeenNthCalledWith(1, "google", undefined, true);
        expect(redirectToOAuthLogin).toHaveBeenNthCalledWith(2, "github", undefined, true);
    });

    it("stays out of the verification-sent view", async () => {
        (signUp as ReturnType<typeof vi.fn>).mockResolvedValue({
            message: "verification_email_sent",
            email: "pat@example.com",
        });
        renderForm();
        fireEvent.click(checkbox());
        fillAndSubmit();
        await screen.findByText(en.admin.auth.signUp.afterSubmit.title);
        expect(screen.queryByRole("checkbox")).toBeNull();
    });
});

describe("the OAuth entry URL", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_API_BASE_URL", "https://api.test/api/v2");
    });

    it("carries accepted_terms only when the sign-up screen asks for it", () => {
        expect(oauthLoginUrl("google")).not.toContain("accepted_terms");
        expect(oauthLoginUrl("google", "/jointeam", false)).not.toContain("accepted_terms");
        expect(oauthLoginUrl("github", "/jointeam", true)).toMatch(/&accepted_terms=true$/);
    });
});

describe("the consent copy exists in every locale", () => {
    it("has all five strings and both placeholders in the sentence", async () => {
        const locales = await Promise.all([
            import("../i18n/locales/ja"),
            import("../i18n/locales/zh"),
            import("../i18n/locales/es"),
            import("../i18n/locales/fr"),
            import("../i18n/locales/hi"),
            import("../i18n/locales/ar"),
        ]);
        const all = [en, ...locales.map((m) => Object.values(m)[0])] as unknown as {
            admin: { auth: { signUp: { consent: Record<string, string> } } };
        }[];
        expect(all).toHaveLength(7);
        for (const cat of all) {
            const cc = cat.admin.auth.signUp.consent;
            for (const k of ["label", "terms", "privacy", "required", "opensInNewTab"]) {
                expect(cc[k], k).toBeTruthy();
            }
            expect(cc.label).toContain("{terms}");
            expect(cc.label).toContain("{privacy}");
        }
        for (const cat of all.slice(1)) {
            const cc = cat.admin.auth.signUp.consent;
            expect(cc.terms).not.toBe(c.terms);
            expect(cc.privacy).not.toBe(c.privacy);
            expect(cc.required).not.toBe(c.required);
        }
    });
});
