import { FormEvent, useState } from "react";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
    Alert,
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Link,
    Stack,
    Typography,
} from "@mui/joy";

import type { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import { fmt, useTranslation } from "../../../i18n";
import type { purplePalette } from "../../../theme/purplePalette";
import type { SignInResponse } from "../../../types/admin";
import { lockMinutes, signInWithCode } from "../../security/services/mfa";

type Props = {
    /** The pending token from the password step. It is good for five minutes and for nothing else. */
    token: string;
    /** The session came back: finish signing in exactly as after a password. */
    onSignedIn: (res: SignInResponse) => void | Promise<void>;
    /** The sign-in card's own colours, passed in so this step looks like the form it replaces. */
    styles: (typeof SignInFormStyles)["light"];
    palette: (typeof purplePalette)["light"];
    /** Back to the password form. `expired` is set when the token died, so the form says why. */
    onBack: (expired: boolean) => void;
};

/**
 * The second step of signing in with two-step verification (MIP-2239): a 6-digit code from the
 * authenticator app, or one of the recovery codes. Shown in place of the password form, inside
 * the same card, so the person stays on one screen.
 */
export const SignInCodeStep = ({ token, styles, palette, onSignedIn, onBack }: Props) => {
    const { t } = useTranslation();
    const m = t.security;

    const [recovery, setRecovery] = useState(false);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ready = recovery
        ? code.replace(/[\s-]/g, "").length === 12
        : code.replace(/\s/g, "").length === 6;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        const res = await signInWithCode(token, code);
        if (res.ok) {
            await onSignedIn(res.data);
            setBusy(false);
            return;
        }
        setBusy(false);
        if (res.code === "mfa_token_invalid") {
            onBack(true);
            return;
        }
        setCode("");
        if (res.code === "mfa_locked") {
            setError(fmt(m.errors.locked, { minutes: lockMinutes(res.retryAfterSeconds) }));
        } else if (res.code === "invalid_code") {
            setError(m.errors.invalidCode);
        } else if (res.code === "throttled") {
            setError(m.errors.throttled);
        } else if (res.code === "network") {
            setError(m.errors.network);
        } else {
            setError(m.errors.generic);
        }
    };

    return (
        <form data-testid="signin-code-step" noValidate onSubmit={(e) => void submit(e)}>
            <Stack sx={{ gap: 2.5 }}>
                <Stack sx={{ gap: 0.75 }}>
                    <Typography
                        component="h2"
                        level="title-lg"
                        startDecorator={<ShieldRoundedIcon sx={{ color: styles.accentColor }} />}
                    >
                        {m.signIn.title}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                        {recovery ? m.signIn.recoveryBody : m.signIn.appBody}
                    </Typography>
                </Stack>

                {error && (
                    <Alert
                        color="danger"
                        role="alert"
                        sx={{
                            borderRadius: "12px",
                            border: `1px solid ${palette.dangerTintBorder}`,
                        }}
                    >
                        {error}
                    </Alert>
                )}

                <FormControl required>
                    <FormLabel
                        sx={{
                            color: styles.labelColor,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            mb: 0.75,
                        }}
                    >
                        {recovery ? m.signIn.recoveryLabel : m.signIn.codeLabel}
                    </FormLabel>
                    <Input
                        key={recovery ? "recovery" : "app"}
                        autoComplete="one-time-code"
                        name="code"
                        value={code}
                        slotProps={{
                            input: recovery
                                ? {
                                      autoCapitalize: "characters",
                                      spellCheck: false,
                                      maxLength: 20,
                                  }
                                : { inputMode: "numeric", maxLength: 7, pattern: "[0-9 ]*" },
                        }}
                        sx={{
                            "--Input-radius": "12px",
                            background: styles.inputBg,
                            border: `1px solid ${styles.inputBorder}`,
                            fontSize: "18px",
                            fontFamily: "monospace",
                            letterSpacing: recovery ? "0.1em" : "0.3em",
                            py: 1.25,
                            "&:focus-within": {
                                borderColor: styles.inputFocusBorder,
                                boxShadow: styles.inputFocusShadow,
                            },
                        }}
                        autoFocus
                        onChange={(e) =>
                            setCode(
                                recovery
                                    ? e.target.value.toUpperCase()
                                    : e.target.value.replace(/[^0-9 ]/g, "")
                            )
                        }
                    />
                </FormControl>

                <Button disabled={!ready} loading={busy} size="lg" type="submit" fullWidth>
                    {m.signIn.submit}
                </Button>

                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 1,
                        flexWrap: "wrap",
                    }}
                >
                    <Link
                        component="button"
                        level="body-sm"
                        sx={{ color: styles.linkColor, fontWeight: 500 }}
                        type="button"
                        onClick={() => {
                            setRecovery((v) => !v);
                            setCode("");
                            setError(null);
                        }}
                    >
                        {recovery ? m.signIn.useApp : m.signIn.useRecovery}
                    </Link>
                    <Link
                        component="button"
                        level="body-sm"
                        sx={{ color: styles.linkColor, fontWeight: 500 }}
                        type="button"
                        onClick={() => onBack(false)}
                    >
                        {m.signIn.back}
                    </Link>
                </Box>
            </Stack>
        </form>
    );
};
