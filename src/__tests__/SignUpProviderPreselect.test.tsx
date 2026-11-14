/**
 * A brand-new person who used the sign-in page's Google / GitHub button is
 * bounced to sign-up to agree to the Terms first. The bounce remembers which
 * provider they pressed so sign-up can highlight the same button.
 *
 * This is a hint only: the consent box stays unticked and nothing is sent
 * until the person ticks it and presses the button.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { OAuthSuccessHandler } from "../features/admin/components/OAuthSuccessHandler";
import { SignInForm } from "../features/admin/components/SignInForm";
import { SignUpForm } from "../features/admin/components/SignUpForm";
import {
    parseOAuthProvider,
    peekRememberedOAuthProvider,
    rememberOAuthProvider,
    signUpPathFor,
} from "../features/integrations/oauthProvider";
import { redirectToOAuthLogin } from "../features/integrations/services/oauth";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/AuthContext")>()),
    useAuth: vi.fn(),
}));
vi.mock("../features/admin/services/signup", () => ({ signUp: vi.fn() }));
vi.mock("../features/integrations/services/oauth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/integrations/services/oauth")>()),
    redirectToOAuthLogin: vi.fn(),
}));

const signUpText = en.admin.auth.signUp;
const google = en.admin.auth.signIn.continueWithGoogle;
const github = en.admin.auth.signIn.continueWithGithub;
const hintFor = (name: string) => `Tick the box, then continue with ${name}.`;

const SignUpAt = () => {
    const location = useLocation();
    return (
        <>
            <div data-testid="signup-search">{location.search}</div>
            <SignUpForm />
        </>
    );
};

const renderSignUp = (search = "") =>
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={[`/signup${search}`]}>
                <SignUpAt />
            </MemoryRouter>
        </CssVarsProvider>
    );

const checkbox = () => screen.getByRole("checkbox", { name: /I agree to the/i });
// Joy marks the primary action `solid`; the quiet one is `outlined`.
const isPrimary = (name: string) =>
    screen.getByRole("button", { name }).className.includes("variantSolid");
const anyHint = () => screen.queryByText(/Tick the box, then continue with/);

describe("sign-up page with ?provider=", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ setAccessToken: vi.fn() });
    });

    it.each([
        ["google", "Google", google, github],
        ["github", "GitHub", github, google],
    ])(
        "?provider=%s focuses the box, highlights that button and says so",
        async (value, display, mine, other) => {
            renderSignUp(`?provider=${value}`);
            expect(screen.getByText(hintFor(display))).toBeInTheDocument();
            expect(isPrimary(mine)).toBe(true);
            expect(isPrimary(other)).toBe(false);
            await waitFor(() => expect(checkbox()).toHaveFocus());
            // The highlighted button is described by the hint line.
            const hint = screen.getByText(hintFor(display));
            expect(screen.getByRole("button", { name: mine })).toHaveAttribute(
                "aria-describedby",
                hint.id
            );
        }
    );

    it("never ticks the box, sends nothing, and blocks a click until it is ticked", async () => {
        renderSignUp("?provider=google");
        expect(checkbox()).not.toBeChecked();
        expect(redirectToOAuthLogin).not.toHaveBeenCalled();

        // Pressing the highlighted button first is refused (the box is still
        // unticked), and says why.
        fireEvent.click(screen.getByRole("button", { name: google }));
        expect(redirectToOAuthLogin).not.toHaveBeenCalled();
        expect(await screen.findByText(signUpText.consent.required)).toBeInTheDocument();
        expect(checkbox()).not.toBeChecked();

        // Ticked: one press goes through, with the consent.
        fireEvent.click(checkbox());
        fireEvent.click(screen.getByRole("button", { name: google }));
        expect(redirectToOAuthLogin).toHaveBeenCalledTimes(1);
        expect(redirectToOAuthLogin).toHaveBeenCalledWith("google", undefined, true);
    });

    it.each([
        [""],
        ["?provider="],
        ["?provider=Google"],
        ["?provider=GITHUB"],
        ["?provider=google%20"],
        ["?provider=gitlab"],
        ["?provider=constructor"],
        ["?provider=__proto__"],
        ["?provider=toString"],
        ["?provider=google&provider=github"],
    ])("ignores %s: no hint, no highlight, no focus move", (search) => {
        renderSignUp(search);
        // The duplicate-key case reads the first value, which is valid.
        if (search.includes("provider=google&")) {
            expect(isPrimary(google)).toBe(true);
            return;
        }
        expect(anyHint()).toBeNull();
        expect(isPrimary(google)).toBe(false);
        expect(isPrimary(github)).toBe(false);
        expect(checkbox()).not.toHaveFocus();
        expect(checkbox()).not.toBeChecked();
    });
});

describe("the provider parser", () => {
    it("accepts exactly the two providers", () => {
        expect(parseOAuthProvider("google")).toBe("google");
        expect(parseOAuthProvider("github")).toBe("github");
        for (const bad of [
            "Google",
            " google",
            "constructor",
            "__proto__",
            "",
            null,
            1,
            ["google"],
        ]) {
            expect(parseOAuthProvider(bad)).toBeNull();
        }
    });

    it("builds the sign-up path only for a known provider", () => {
        expect(signUpPathFor("google")).toBe("/signup?provider=google");
        expect(signUpPathFor("github")).toBe("/signup?provider=github");
        expect(signUpPathFor("evil&x=1")).toBe("/signup");
        expect(signUpPathFor(null)).toBe("/signup");
        expect(signUpPathFor(undefined)).toBe("/signup");
    });
});

const renderBounce = (search: string) => {
    window.history.replaceState({}, "", `/oauth/success${search}`);
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/oauth/success"]}>
                <Routes>
                    <Route path="/oauth/success" element={<OAuthSuccessHandler />} />
                    <Route path="/signup" element={<SignUpAt />} />
                    <Route path="/signin" element={<div>signin page</div>} />
                </Routes>
            </MemoryRouter>
        </CssVarsProvider>
    );
};

const goToSignUp = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Go to sign up" }));
    return (await screen.findByTestId("signup-search")).textContent;
};

describe("the terms_required bounce page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ setAccessToken: vi.fn() });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(["google", "github"] as const)(
        "sends someone who pressed %s on sign-in to sign-up with that provider",
        async (provider) => {
            rememberOAuthProvider(provider);
            renderBounce("?error=terms_required");
            expect(await goToSignUp()).toBe(`?provider=${provider}`);
            // Used once, then forgotten.
            expect(peekRememberedOAuthProvider()).toBeNull();
        }
    );

    it("goes to plain sign-up when nothing was remembered", async () => {
        renderBounce("?error=terms_required");
        expect(await goToSignUp()).toBe("");
    });

    it("goes to plain sign-up when the stored value is not a known provider", async () => {
        sessionStorage.setItem("genosOAuthSignInProvider", "constructor");
        renderBounce("?error=terms_required");
        expect(await goToSignUp()).toBe("");
    });

    it("goes to plain sign-up, without crashing, when storage throws", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        renderBounce("?error=terms_required");
        expect(await goToSignUp()).toBe("");
    });

    it("forgets the hint on any other refusal, so it cannot leak into a later bounce", async () => {
        rememberOAuthProvider("github");
        renderBounce("?error=consent_denied");
        await screen.findByRole("button", { name: "Back to sign in" });
        expect(peekRememberedOAuthProvider()).toBeNull();
    });
});

describe("the sign-in page remembers the provider it sends the person to", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ setAccessToken: vi.fn() });
    });

    it.each([
        ["google", google],
        ["github", github],
    ] as const)("pressing %s stores it and starts the flow without consent", (provider, name) => {
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/signin"]}>
                    <SignInForm />
                </MemoryRouter>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name }));
        expect(peekRememberedOAuthProvider()).toBe(provider);
        expect(redirectToOAuthLogin).toHaveBeenCalledWith(provider);
    });
});

describe("the provider hint exists in every locale", () => {
    it("names the provider slot in all seven", { timeout: 30_000 }, async () => {
        const locales = await Promise.all([
            import("../i18n/locales/ja"),
            import("../i18n/locales/zh"),
            import("../i18n/locales/es"),
            import("../i18n/locales/fr"),
            import("../i18n/locales/hi"),
            import("../i18n/locales/ar"),
        ]);
        const all = [en, ...locales.map((m) => Object.values(m)[0])] as unknown as {
            admin: { auth: { signUp: { providerHint: string } } };
        }[];
        expect(all).toHaveLength(7);
        for (const cat of all) {
            expect(cat.admin.auth.signUp.providerHint).toContain("{provider}");
        }
        for (const cat of all.slice(1)) {
            expect(cat.admin.auth.signUp.providerHint).not.toBe(signUpText.providerHint);
        }
    });
});
