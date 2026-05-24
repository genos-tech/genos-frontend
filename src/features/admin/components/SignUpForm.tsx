import React, { useMemo, useState } from "react";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Alert,
    Box,
    Button,
    Divider,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    LinearProgress,
    Link,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignUpFormStyles } from "../../../components/ui/styles/commonStyle";
import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { OAUTH_INTEGRATIONS_ENABLED } from "../../integrations/featureFlags";
import { redirectToOAuthLogin } from "../../integrations/services/oauth";
import { resendVerificationEmail } from "../services/emailVerification";
import { signUp } from "../services/signup";
import { validatePassword } from "../utils/passwordValidation";
import { GoogleIcon } from "./icons/GoogleIcon";

const maskEmail = (email: string): string => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.slice(0, 1);
    return `${visible}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
};

interface FormElements extends HTMLFormControlsCollection {
    userName: HTMLInputElement;
    email: HTMLInputElement;
    password: HTMLInputElement;
    confirm_password: HTMLInputElement;
}
interface SignUpFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

export const SignUpForm = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null);
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignUpFormStyles.dark : SignUpFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const validation = useMemo(() => validatePassword(password), [password]);
    const showMeter = passwordFocused || password.length > 0;

    // Joy LinearProgress accepts these palette names; map score → color.
    const meterColor: "danger" | "warning" | "primary" | "success" | "neutral" =
        validation.score <= 1
            ? "danger"
            : validation.score === 2
              ? "warning"
              : validation.score === 3
                ? "primary"
                : validation.score === 4
                  ? "success"
                  : "neutral";
    const strengthLabel =
        validation.score <= 1
            ? t.admin.auth.signUp.passwordStrength.weak
            : validation.score === 2
              ? t.admin.auth.signUp.passwordStrength.fair
              : validation.score === 3
                ? t.admin.auth.signUp.passwordStrength.good
                : t.admin.auth.signUp.passwordStrength.strong;

    const checklistRows: { ok: boolean; label: string }[] = [
        { ok: validation.length, label: t.admin.auth.signUp.passwordRequirements.minLength },
        { ok: validation.uppercase, label: t.admin.auth.signUp.passwordRequirements.uppercase },
        { ok: validation.lowercase, label: t.admin.auth.signUp.passwordRequirements.lowercase },
        { ok: validation.number, label: t.admin.auth.signUp.passwordRequirements.number },
    ];

    const _signup = async (username: string, email: string, password: string) => {
        const signUpRes = await signUp(username, email, password, false, setErrorMessage);
        if (signUpRes && signUpRes.message === "verification_email_sent" && "email" in signUpRes) {
            setVerificationSentTo(signUpRes.email);
            setErrorMessage(null);
        }
        // Anything else: setErrorMessage has been called by the service.
    };

    const _resendVerification = async () => {
        if (!verificationSentTo) return;
        setResendStatus("sending");
        const ok = await resendVerificationEmail(verificationSentTo, setErrorMessage);
        setResendStatus(ok ? "sent" : "idle");
    };

    // Input style
    const inputStyle = {
        "--Input-focusedThickness": "2px",
        "--Input-radius": "12px",
        background: styles.inputBg,
        border: `1px solid ${styles.inputBorder}`,
        fontSize: "15px",
        py: 1.25,
        transition: "all 0.2s ease",
        "&:hover": {
            borderColor: styles.accentColor,
        },
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
            {/* Form Card */}
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
                            {verificationSentTo
                                ? t.admin.auth.signUp.afterSubmit.title
                                : t.admin.auth.signUp.title}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                            {verificationSentTo
                                ? fmt(t.admin.auth.signUp.afterSubmit.body, {
                                      email: maskEmail(verificationSentTo),
                                  })
                                : t.admin.auth.signUp.subtitle}
                        </Typography>
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

                {verificationSentTo ? (
                    <Stack sx={{ gap: 2 }}>
                        <Alert
                            color="success"
                            startDecorator={<MarkEmailReadRoundedIcon />}
                            sx={{
                                borderRadius: "12px",
                                border: `1px solid ${palette.successTintBorder}`,
                            }}
                        >
                            {resendStatus === "sent"
                                ? t.admin.auth.signUp.afterSubmit.resendSent
                                : t.admin.auth.signUp.afterSubmit.checkInboxHint}
                        </Alert>
                        <Button
                            disabled={resendStatus !== "idle"}
                            variant="outlined"
                            sx={{
                                py: 1.25,
                                borderRadius: "12px",
                                fontWeight: 600,
                                fontSize: "15px",
                                borderColor: styles.inputBorder,
                                color: styles.labelColor,
                                background: styles.inputBg,
                                "&:hover": {
                                    borderColor: styles.accentColor,
                                    background: `${styles.accentColor}10`,
                                },
                            }}
                            fullWidth
                            onClick={_resendVerification}
                        >
                            {resendStatus === "sending"
                                ? t.admin.auth.signUp.afterSubmit.resending
                                : t.admin.auth.signUp.afterSubmit.resend}
                        </Button>
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
                                {t.admin.auth.signUp.afterSubmit.backToSignIn}
                            </Link>
                        </Typography>
                    </Stack>
                ) : (
                    <>
                        {OAUTH_INTEGRATIONS_ENABLED && (
                            <>
                                <Stack sx={{ gap: 1.25, mb: 2.5 }}>
                                    <Button
                                        startDecorator={<GoogleIcon />}
                                        variant="outlined"
                                        sx={{
                                            py: 1.25,
                                            borderRadius: "12px",
                                            fontWeight: 600,
                                            fontSize: "15px",
                                            borderColor: styles.inputBorder,
                                            color: styles.labelColor,
                                            background: styles.inputBg,
                                            "&:hover": {
                                                borderColor: styles.accentColor,
                                                background: `${styles.accentColor}10`,
                                            },
                                        }}
                                        fullWidth
                                        onClick={() => redirectToOAuthLogin("google")}
                                    >
                                        {t.admin.auth.signIn.continueWithGoogle}
                                    </Button>
                                    <Button
                                        startDecorator={<GitHubIcon sx={{ fontSize: 20 }} />}
                                        variant="outlined"
                                        sx={{
                                            py: 1.25,
                                            borderRadius: "12px",
                                            fontWeight: 600,
                                            fontSize: "15px",
                                            borderColor: styles.inputBorder,
                                            color: styles.labelColor,
                                            background: styles.inputBg,
                                            "&:hover": {
                                                borderColor: styles.accentColor,
                                                background: `${styles.accentColor}10`,
                                            },
                                        }}
                                        fullWidth
                                        onClick={() => redirectToOAuthLogin("github")}
                                    >
                                        {t.admin.auth.signIn.continueWithGithub}
                                    </Button>
                                </Stack>

                                <Divider sx={{ mb: 2.5, color: styles.subtitleColor }}>
                                    {t.admin.auth.signIn.orDivider}
                                </Divider>
                            </>
                        )}

                        <form
                            onSubmit={(event: React.FormEvent<SignUpFormElement>) => {
                                event.preventDefault();
                                const formElements = event.currentTarget.elements;
                                const name = formElements.userName.value;
                                const email = formElements.email.value;

                                if (!validation.isValid) {
                                    setErrorMessage(t.admin.auth.signUp.passwordTooWeak);
                                    return;
                                }
                                if (password !== confirmPassword) {
                                    setErrorMessage(t.admin.auth.signUp.passwordMismatch);
                                    return;
                                }
                                _signup(name, email, password);
                            }}
                        >
                            <Stack sx={{ gap: 2.5 }}>
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
                                        {t.admin.auth.signUp.nameLabel}
                                    </FormLabel>
                                    <Input
                                        name="userName"
                                        placeholder={t.admin.auth.signUp.namePlaceholder}
                                        sx={inputStyle}
                                        type="text"
                                        startDecorator={
                                            <BadgeRoundedIcon
                                                sx={{
                                                    color: styles.accentColor,
                                                    fontSize: 20,
                                                }}
                                            />
                                        }
                                    />
                                </FormControl>

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
                                        {t.admin.auth.signUp.emailLabel}
                                    </FormLabel>
                                    <Input
                                        name="email"
                                        placeholder={t.admin.auth.signUp.emailPlaceholder}
                                        sx={inputStyle}
                                        type="email"
                                        startDecorator={
                                            <EmailRoundedIcon
                                                sx={{
                                                    color: styles.accentColor,
                                                    fontSize: 20,
                                                }}
                                            />
                                        }
                                    />
                                </FormControl>

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
                                        {t.admin.auth.signUp.passwordLabel}
                                    </FormLabel>
                                    <Input
                                        name="password"
                                        placeholder={t.admin.auth.signUp.passwordPlaceholder}
                                        sx={inputStyle}
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        endDecorator={
                                            <IconButton
                                                size="sm"
                                                variant="plain"
                                                aria-label={
                                                    showPassword
                                                        ? t.admin.auth.signUp.passwordVisibility
                                                              .hide
                                                        : t.admin.auth.signUp.passwordVisibility
                                                              .show
                                                }
                                                sx={{
                                                    color: styles.accentColor,
                                                    "--IconButton-size": "28px",
                                                }}
                                                onClick={() => setShowPassword((v) => !v)}
                                            >
                                                {showPassword ? (
                                                    <VisibilityOffRoundedIcon
                                                        sx={{ fontSize: 20 }}
                                                    />
                                                ) : (
                                                    <VisibilityRoundedIcon sx={{ fontSize: 20 }} />
                                                )}
                                            </IconButton>
                                        }
                                        startDecorator={
                                            <LockRoundedIcon
                                                sx={{
                                                    color: styles.accentColor,
                                                    fontSize: 20,
                                                }}
                                            />
                                        }
                                        onBlur={() => setPasswordFocused(false)}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setPasswordFocused(true)}
                                    />
                                    {showMeter && (
                                        <Box sx={{ mt: 1 }}>
                                            <Stack
                                                alignItems="center"
                                                direction="row"
                                                spacing={1}
                                                sx={{ mb: 0.75 }}
                                            >
                                                <LinearProgress
                                                    color={meterColor}
                                                    value={(validation.score / 4) * 100}
                                                    sx={{
                                                        flex: 1,
                                                        "--LinearProgress-thickness": "6px",
                                                    }}
                                                    determinate
                                                />
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: styles.subtitleColor,
                                                        minWidth: 48,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {strengthLabel}
                                                </Typography>
                                            </Stack>
                                            <Stack spacing={0.25}>
                                                {checklistRows.map((row) => (
                                                    <Stack
                                                        key={row.label}
                                                        alignItems="center"
                                                        direction="row"
                                                        spacing={0.75}
                                                    >
                                                        {row.ok ? (
                                                            <CheckCircleRoundedIcon
                                                                color="success"
                                                                sx={{ fontSize: 16 }}
                                                            />
                                                        ) : (
                                                            <RadioButtonUncheckedRoundedIcon
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: styles.subtitleColor,
                                                                }}
                                                            />
                                                        )}
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: row.ok
                                                                    ? styles.labelColor
                                                                    : styles.subtitleColor,
                                                            }}
                                                        >
                                                            {row.label}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                </FormControl>

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
                                        {t.admin.auth.signUp.confirmPasswordLabel}
                                    </FormLabel>
                                    <Input
                                        name="confirm_password"
                                        sx={inputStyle}
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        endDecorator={
                                            <IconButton
                                                size="sm"
                                                variant="plain"
                                                aria-label={
                                                    showConfirmPassword
                                                        ? t.admin.auth.signUp.passwordVisibility
                                                              .hide
                                                        : t.admin.auth.signUp.passwordVisibility
                                                              .show
                                                }
                                                sx={{
                                                    color: styles.accentColor,
                                                    "--IconButton-size": "28px",
                                                }}
                                                onClick={() => setShowConfirmPassword((v) => !v)}
                                            >
                                                {showConfirmPassword ? (
                                                    <VisibilityOffRoundedIcon
                                                        sx={{ fontSize: 20 }}
                                                    />
                                                ) : (
                                                    <VisibilityRoundedIcon sx={{ fontSize: 20 }} />
                                                )}
                                            </IconButton>
                                        }
                                        placeholder={
                                            t.admin.auth.signUp.confirmPasswordPlaceholder
                                        }
                                        startDecorator={
                                            <LockRoundedIcon
                                                sx={{
                                                    color: styles.accentColor,
                                                    fontSize: 20,
                                                }}
                                            />
                                        }
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </FormControl>

                                <Button
                                    startDecorator={<PersonAddRoundedIcon />}
                                    type="submit"
                                    sx={{
                                        mt: 1,
                                        py: 1.5,
                                        background: styles.buttonBg,
                                        borderRadius: "12px",
                                        fontWeight: 600,
                                        fontSize: "15px",
                                        boxShadow: styles.buttonShadow,
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-2px)",
                                            boxShadow: `${styles.buttonShadow}, 0 8px 24px ${palette.glow}`,
                                        },
                                    }}
                                    fullWidth
                                >
                                    {t.admin.auth.signUp.submit}
                                </Button>

                                <Typography
                                    level="body-sm"
                                    sx={{ color: styles.subtitleColor }}
                                    textAlign="center"
                                >
                                    {t.admin.auth.signUp.haveAccountPrompt}{" "}
                                    <Link
                                        component="button"
                                        type="button"
                                        level="title-sm"
                                        onClick={() => navigate("/signin")}
                                        sx={{
                                            color: styles.linkColor,
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                color: styles.linkHover,
                                            },
                                        }}
                                    >
                                        {t.admin.auth.signUp.signInLink}
                                    </Link>
                                </Typography>
                            </Stack>
                        </form>
                    </>
                )}
            </Box>
        </Box>
    );
};
