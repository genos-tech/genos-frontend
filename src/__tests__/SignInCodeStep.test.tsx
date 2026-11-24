// MIP-2239: the second step of signing in. The server decides; the screen has to send the pending
// token with the code, finish signing in only on a session, send the person back to the password
// form when the token died, and say a lock in minutes without ever echoing the code.
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInFormStyles } from "../components/ui/styles/commonStyle";
import { SignInCodeStep } from "../features/admin/components/SignInCodeStep";
import { purplePalette } from "../theme/purplePalette";

const signInWithCode = vi.fn();

vi.mock("../features/security/services/mfa", async () => {
    const actual = await vi.importActual<typeof import("../features/security/services/mfa")>(
        "../features/security/services/mfa"
    );
    return { ...actual, signInWithCode: (...a: unknown[]) => signInWithCode(...a) };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const SESSION = { access: "a", user_id: "u1", username: "n" };

const setup = () => {
    const onSignedIn = vi.fn();
    const onBack = vi.fn();
    render(
        <SignInCodeStep
            palette={purplePalette.light}
            styles={SignInFormStyles.light}
            token="pending-token"
            onBack={onBack}
            onSignedIn={onSignedIn}
        />
    );
    return { onSignedIn, onBack };
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("SignInCodeStep", () => {
    it("waits for six digits before it lets the person verify", async () => {
        setup();
        const submit = screen.getByRole("button", { name: "Verify" });
        expect(submit).toBeDisabled();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "12345");
        expect(submit).toBeDisabled();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "6");
        expect(submit).toBeEnabled();
    });

    it("keeps only digits and spaces in the code box", async () => {
        setup();
        const input = screen.getByLabelText(/Authentication code/);
        await userEvent.type(input, "1a2b3 c4");
        expect(input).toHaveValue("123 4");
        expect(input).toHaveAttribute("autocomplete", "one-time-code");
        expect(input).toHaveAttribute("inputmode", "numeric");
    });

    it("sends the pending token with the code and finishes signing in on a session", async () => {
        signInWithCode.mockResolvedValue({ ok: true, data: SESSION });
        const { onSignedIn } = setup();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "123456");
        await userEvent.click(screen.getByRole("button", { name: "Verify" }));
        expect(signInWithCode).toHaveBeenCalledWith("pending-token", "123456");
        await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SESSION));
    });

    it("submits with Enter", async () => {
        signInWithCode.mockResolvedValue({ ok: true, data: SESSION });
        const { onSignedIn } = setup();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "123456{Enter}");
        await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    });

    it("says a wrong code is wrong, clears the box and does not sign in", async () => {
        signInWithCode.mockResolvedValue({ ok: false, code: "invalid_code" });
        const { onSignedIn } = setup();
        const input = screen.getByLabelText(/Authentication code/);
        await userEvent.type(input, "111111");
        await userEvent.click(screen.getByRole("button", { name: "Verify" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/That code is not right/);
        expect(input).toHaveValue("");
        expect(onSignedIn).not.toHaveBeenCalled();
    });

    it("states the lock in minutes", async () => {
        signInWithCode.mockResolvedValue({
            ok: false,
            code: "mfa_locked",
            retryAfterSeconds: 901,
        });
        setup();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "111111");
        await userEvent.click(screen.getByRole("button", { name: "Verify" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 16 min.");
    });

    it("sends the person back to the password form, saying why, when the token expired", async () => {
        signInWithCode.mockResolvedValue({ ok: false, code: "mfa_token_invalid" });
        const { onBack, onSignedIn } = setup();
        await userEvent.type(screen.getByLabelText(/Authentication code/), "111111");
        await userEvent.click(screen.getByRole("button", { name: "Verify" }));
        await waitFor(() => expect(onBack).toHaveBeenCalledWith(true));
        expect(onSignedIn).not.toHaveBeenCalled();
    });

    it("goes back to the password form on request, without the expired notice", async () => {
        const { onBack } = setup();
        await userEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
        expect(onBack).toHaveBeenCalledWith(false);
    });

    it("accepts a recovery code of twelve characters, in any case, after switching", async () => {
        signInWithCode.mockResolvedValue({ ok: true, data: SESSION });
        const { onSignedIn } = setup();
        await userEvent.click(screen.getByRole("button", { name: "Use a recovery code" }));
        const input = screen.getByLabelText(/Recovery code/);
        const submit = screen.getByRole("button", { name: "Verify" });
        await userEvent.type(input, "abcd-efgh-jk");
        expect(submit).toBeDisabled();
        await userEvent.type(input, "m2");
        expect(input).toHaveValue("ABCD-EFGH-JKM2");
        expect(submit).toBeEnabled();
        await userEvent.click(submit);
        expect(signInWithCode).toHaveBeenCalledWith("pending-token", "ABCD-EFGH-JKM2");
        await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    });

    it("can switch back to the app", async () => {
        setup();
        await userEvent.click(screen.getByRole("button", { name: "Use a recovery code" }));
        await userEvent.click(screen.getByRole("button", { name: "Use the authenticator app" }));
        expect(screen.getByLabelText(/Authentication code/)).toBeInTheDocument();
    });
});
