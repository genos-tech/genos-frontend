import React, { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
    FormLabel,
    Input,
    Link,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SignUpFormStyles } from "../../../components/ui/styles/commonStyle";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { resendVerificationEmail, verifyEmail } from "../services/emailVerification";

type Phase = "verifying" | "success" | "invalid" | "missing";

export const VerifyEmailHandler = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [phase, setPhase] = useState<Phase>(token ? "verifying" : "missing");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [resendEmail, setResendEmail] = useState<string>("");
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignUpFormStyles.dark : SignUpFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            // Swallow the verbose detail string from the API — we always
            // render the same friendly copy on the invalid branch.
            const ok = await verifyEmail(token, () => {});
            if (cancelled) return;
            setPhase(ok ? "success" : "invalid");
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const _resend = async () => {
        if (!resendEmail) return;
        setResendStatus("sending");
        const ok = await resendVerificationEmail(resendEmail, setErrorMessage);
        setResendStatus(ok ? "sent" : "idle");
    };

    const title =
        phase === "verifying"
            ? t.admin.auth.emailVerification.verifyingTitle
            : phase === "success"
              ? t.admin.auth.emailVerification.successTitle
              : phase === "invalid"
                ? t.admin.auth.emailVerification.invalidTitle
                : t.admin.auth.emailVerification.missingTokenTitle;

    const body =
        phase === "verifying"
            ? ""
            : phase === "success"
              ? t.admin.auth.emailVerification.successBody
              : phase === "invalid"
                ? t.admin.auth.emailVerification.invalidBody
                : t.admin.auth.emailVerification.missingTokenBody;

    const inputStyle = {
        "--Input-focusedThickness": "2px",
        "--Input-radius": "12px",
        background: styles.inputBg,
        border: `1px solid ${styles.inputBorder}`,
        fontSize: "15px",
        py: 1.25,
        "&:hover": { borderColor: styles.accentColor },
        "&:focus-within": {
            borderColor: styles.inputFocusBorder,
            boxShadow: styles.inputFocusShadow,
        },
    };

    return (
        <Box
            component="main"
            sx={{
                my: "auto",
                py: 2,
                pb: 5,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: { xs: "100%", md: 420 },
                maxWidth: "100%",
                mx: "auto",
            }}
        >
            <Box
                sx={{
                    background: styles.cardBg,
                    border: `1px solid ${styles.cardBorder}`,
                    borderRadius: "20px",
                    boxShadow: styles.cardShadow,
                    p: 4,
                    backdropFilter: "blur(12px)",
                }}
            >
                <Stack sx={{ gap: 3, mb: 3 }}>
                    <Stack sx={{ gap: 1 }}>
                        <Typography
                            component="h1"
                            level="h2"
                            sx={{
                                background: styles.titleGradient,
                                backgroundClip: "text",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {title}
                        </Typography>
                        {body && (
                            <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                {body}
                            </Typography>
                        )}
                    </Stack>

                    {errorMessage && (
                        <Alert
                            color="danger"
                            sx={{
                                borderRadius: "12px",
                                border: `1px solid ${palette.dangerTintBorder}`,
                            }}
                        >
                            {errorMessage}
                        </Alert>
                    )}
                </Stack>

                {phase === "verifying" && (
                    <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size="md" />
                    </Stack>
                )}

                {phase === "success" && (
                    <Stack sx={{ gap: 2 }}>
                        <Alert
                            color="success"
                            startDecorator={<CheckCircleRoundedIcon />}
                            sx={{
                                borderRadius: "12px",
                                border: `1px solid ${palette.successTintBorder}`,
                            }}
                        >
                            {t.admin.auth.emailVerification.successBody}
                        </Alert>
                        <Button
                            startDecorator={<LoginRoundedIcon />}
                            sx={{
                                py: 1.5,
                                background: styles.buttonBg,
                                borderRadius: "12px",
                                fontWeight: 600,
                                fontSize: "15px",
                                boxShadow: styles.buttonShadow,
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                            fullWidth
                            onClick={() => navigate("/signin")}
                        >
                            {t.admin.auth.emailVerification.signInButton}
                        </Button>
                    </Stack>
                )}

                {(phase === "invalid" || phase === "missing") && (
                    <Stack sx={{ gap: 2 }}>
                        {resendStatus === "sent" ? (
                            <Alert
                                color="success"
                                sx={{
                                    borderRadius: "12px",
                                    border: `1px solid ${palette.successTintBorder}`,
                                }}
                            >
                                {t.admin.auth.emailVerification.resendSent}
                            </Alert>
                        ) : (
                            <FormControl>
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
                                    {t.admin.auth.emailVerification.resendLabel}
                                </FormLabel>
                                <Input
                                    placeholder={t.admin.auth.emailVerification.resendPlaceholder}
                                    sx={inputStyle}
                                    type="email"
                                    value={resendEmail}
                                    startDecorator={
                                        <EmailRoundedIcon
                                            sx={{
                                                color: styles.accentColor,
                                                fontSize: 20,
                                            }}
                                        />
                                    }
                                    onChange={(e) => setResendEmail(e.target.value)}
                                />
                            </FormControl>
                        )}
                        {resendStatus !== "sent" && (
                            <Button
                                disabled={resendStatus === "sending" || !resendEmail}
                                sx={{
                                    py: 1.5,
                                    background: styles.buttonBg,
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    fontSize: "15px",
                                    boxShadow: styles.buttonShadow,
                                    "&:hover": {
                                        background: styles.buttonHover,
                                    },
                                }}
                                fullWidth
                                onClick={_resend}
                            >
                                {resendStatus === "sending"
                                    ? t.admin.auth.emailVerification.resending
                                    : t.admin.auth.emailVerification.resendButton}
                            </Button>
                        )}
                        <Typography
                            level="body-sm"
                            sx={{ color: styles.subtitleColor }}
                            textAlign="center"
                        >
                            <Link
                                level="title-sm"
                                sx={{
                                    color: styles.linkColor,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    "&:hover": { color: styles.linkHover },
                                }}
                                onClick={() => navigate("/signin")}
                            >
                                {t.admin.auth.emailVerification.backToSignIn}
                            </Link>
                        </Typography>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};
