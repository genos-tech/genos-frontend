// MIP-2239: Settings > Security, two-step verification. The server enforces everything that
// matters (password before setup, lock after five wrong codes, replay); these tests pin what the
// person sees and what the screen sends: the password goes with setup, disable and new codes, the
// secret is drawn in the browser and typed-key fallback is shown grouped, the recovery codes are
// shown once and "Done" waits for "I have saved these codes".
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { groupKey } from "../features/security/groupKey";
import { TwoFactorSection } from "../features/security/TwoFactorSection";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const getMfaStatus = vi.fn();
const startMfaSetup = vi.fn();
const confirmMfaSetup = vi.fn();
const disableMfa = vi.fn();
const newRecoveryCodes = vi.fn();

vi.mock("../features/security/services/mfa", async () => {
    const actual = await vi.importActual<typeof import("../features/security/services/mfa")>(
        "../features/security/services/mfa"
    );
    return {
        ...actual,
        getMfaStatus: (...a: unknown[]) => getMfaStatus(...a),
        startMfaSetup: (...a: unknown[]) => startMfaSetup(...a),
        confirmMfaSetup: (...a: unknown[]) => confirmMfaSetup(...a),
        disableMfa: (...a: unknown[]) => disableMfa(...a),
        newRecoveryCodes: (...a: unknown[]) => newRecoveryCodes(...a),
    };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const OFF = { enabled: false, eligible: true, enabledAt: null, recoveryCodesRemaining: 0 };
const ON = {
    enabled: true,
    eligible: true,
    enabledAt: "2026-11-24T01:00:00Z",
    recoveryCodesRemaining: 10,
};
const SETUP = {
    secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    otpauthUri:
        "otpauth://totp/Genos:a%40b.c?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Genos",
};
const CODES = ["AAAA-BBBB-CCCC", "DDDD-EEEE-FFFF", "GGGG-HHHH-JJJJ"];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("groupKey", () => {
    it("groups the key in fours", () => {
        expect(groupKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    });
});

describe("TwoFactorSection", () => {
    it("says it is off and offers to turn it on", async () => {
        getMfaStatus.mockResolvedValue(OFF);
        render(<TwoFactorSection />);
        expect(await screen.findByRole("button", { name: "Turn on" })).toBeInTheDocument();
        expect(screen.getByText("Off")).toBeInTheDocument();
        expect(getMfaStatus).toHaveBeenCalledWith("tok");
    });

    it("tells a Google or GitHub account that there is nothing to set up here", async () => {
        getMfaStatus.mockResolvedValue({ ...OFF, eligible: false });
        render(<TwoFactorSection />);
        expect(await screen.findByText(/has its own two-step verification/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
        expect(screen.queryByText("Off")).not.toBeInTheDocument();
    });

    it("shows an error with a retry when the status cannot be loaded, never 'Off'", async () => {
        getMfaStatus.mockResolvedValueOnce(null).mockResolvedValueOnce(OFF);
        render(<TwoFactorSection />);
        expect(
            await screen.findByText("Could not load your security settings.")
        ).toBeInTheDocument();
        expect(screen.queryByText("Off")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByRole("button", { name: "Turn on" })).toBeInTheDocument();
    });

    it("turns it on: password, scan and first code, then recovery codes shown once", async () => {
        getMfaStatus.mockResolvedValueOnce(OFF).mockResolvedValue(ON);
        startMfaSetup.mockResolvedValue({ ok: true, data: SETUP });
        confirmMfaSetup.mockResolvedValue({ ok: true, data: CODES });
        render(<TwoFactorSection />);

        await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
        const dialog = await screen.findByRole("dialog");
        const next = within(dialog).getByRole("button", { name: "Continue" });
        expect(next).toBeDisabled();
        await userEvent.type(within(dialog).getByLabelText(/Password/), "hunter22");
        await userEvent.click(next);
        expect(startMfaSetup).toHaveBeenCalledWith("tok", "hunter22");

        // The QR code is drawn here, and the key is there to type.
        expect(await screen.findByTestId("mfa-qr")).toBeInTheDocument();
        expect(screen.getByTestId("mfa-key")).toHaveTextContent(groupKey(SETUP.secret));
        expect(screen.getByRole("link", { name: /Open in authenticator app/ })).toHaveAttribute(
            "href",
            SETUP.otpauthUri
        );

        const verify = screen.getByRole("button", { name: "Turn on" });
        expect(verify).toBeDisabled();
        await userEvent.type(screen.getByLabelText("6-digit code"), "123 456");
        await userEvent.click(verify);
        expect(confirmMfaSetup).toHaveBeenCalledWith("tok", "123 456");

        // The codes, once; Done waits for the checkbox.
        const grid = await screen.findByTestId("mfa-recovery-codes");
        for (const c of CODES) expect(within(grid).getByText(c)).toBeInTheDocument();
        const done = screen.getByRole("button", { name: "Done" });
        expect(done).toBeDisabled();
        await userEvent.click(screen.getByRole("checkbox", { name: "I have saved these codes" }));
        expect(done).toBeEnabled();
        await userEvent.click(done);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        // The secret and the codes are gone from the page once it closes.
        expect(screen.queryByText(CODES[0])).not.toBeInTheDocument();
        expect(await screen.findByText("On")).toBeInTheDocument();
    });

    it("keeps the dialog open on a wrong password and says so", async () => {
        getMfaStatus.mockResolvedValue(OFF);
        startMfaSetup.mockResolvedValue({ ok: false, code: "bad_password" });
        render(<TwoFactorSection />);
        await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
        const dialog = await screen.findByRole("dialog");
        await userEvent.type(within(dialog).getByLabelText(/Password/), "nope");
        await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("That password is not right.");
        expect(screen.queryByTestId("mfa-qr")).not.toBeInTheDocument();
    });

    it("says a wrong first code is wrong and clears the box, and states the lock in minutes", async () => {
        getMfaStatus.mockResolvedValue(OFF);
        startMfaSetup.mockResolvedValue({ ok: true, data: SETUP });
        confirmMfaSetup
            .mockResolvedValueOnce({ ok: false, code: "invalid_code" })
            .mockResolvedValueOnce({ ok: false, code: "mfa_locked", retryAfterSeconds: 840 });
        render(<TwoFactorSection />);
        await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
        const dialog = await screen.findByRole("dialog");
        await userEvent.type(within(dialog).getByLabelText(/Password/), "hunter22");
        await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
        const input = await screen.findByLabelText("6-digit code");
        await userEvent.type(input, "111111");
        await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/code is not right/);
        expect(input).toHaveValue("");
        await userEvent.type(input, "222222");
        await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Try again in 14 min.")
        );
    });

    it("shows what is on, and warns when the recovery codes are nearly gone", async () => {
        getMfaStatus.mockResolvedValue({ ...ON, recoveryCodesRemaining: 2 });
        render(<TwoFactorSection />);
        expect(await screen.findByText("On")).toBeInTheDocument();
        expect(screen.getByText("Recovery codes left: 2")).toBeInTheDocument();
        expect(screen.getByText(/Almost out of recovery codes/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
    });

    it("does not warn while there are codes left", async () => {
        getMfaStatus.mockResolvedValue(ON);
        render(<TwoFactorSection />);
        expect(await screen.findByText("Recovery codes left: 10")).toBeInTheDocument();
        expect(screen.queryByText(/Almost out/)).not.toBeInTheDocument();
    });

    it("turns it off only with the password", async () => {
        getMfaStatus.mockResolvedValueOnce(ON).mockResolvedValue(OFF);
        disableMfa.mockResolvedValue({ ok: true, data: true });
        render(<TwoFactorSection />);
        await userEvent.click(await screen.findByRole("button", { name: "Turn off" }));
        const dialog = await screen.findByRole("dialog");
        const confirm = within(dialog).getByRole("button", { name: "Turn off" });
        expect(confirm).toBeDisabled();
        await userEvent.type(within(dialog).getByLabelText(/Password/), "hunter22");
        await userEvent.click(confirm);
        expect(disableMfa).toHaveBeenCalledWith("tok", "hunter22");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(await screen.findByText("Off")).toBeInTheDocument();
    });

    it("gets new recovery codes with the password and shows them once", async () => {
        getMfaStatus.mockResolvedValue(ON);
        newRecoveryCodes.mockResolvedValue({ ok: true, data: CODES });
        render(<TwoFactorSection />);
        await userEvent.click(
            await screen.findByRole("button", { name: "Get new recovery codes" })
        );
        const dialog = await screen.findByRole("dialog");
        await userEvent.type(within(dialog).getByLabelText(/Password/), "hunter22");
        await userEvent.click(within(dialog).getByRole("button", { name: "Get new codes" }));
        expect(newRecoveryCodes).toHaveBeenCalledWith("tok", "hunter22");
        const grid = await screen.findByTestId("mfa-recovery-codes");
        expect(within(grid).getByText(CODES[1])).toBeInTheDocument();
    });

    it("does not send the password anywhere but the three password steps", async () => {
        getMfaStatus.mockResolvedValue(ON);
        render(<TwoFactorSection />);
        await screen.findByText("On");
        expect(startMfaSetup).not.toHaveBeenCalled();
        expect(disableMfa).not.toHaveBeenCalled();
        expect(newRecoveryCodes).not.toHaveBeenCalled();
    });
});
