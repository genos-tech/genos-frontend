import React, { useEffect, useMemo, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    CssBaseline,
    FormControl,
    FormLabel,
    GlobalStyles,
    IconButton,
    Input,
    LinearProgress,
    Link,
    Stack,
    Typography,
} from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SignUpFormStyles } from "../../../components/ui/styles/commonStyle";
import { fmt, I18nProvider, useTranslation } from "../../../i18n";
import { purplePalette, purpleTheme } from "../../../theme/purplePalette";
import { confirmPasswordReset } from "../services/passwordReset";
import { validatePassword } from "../utils/passwordValidation";
import { AdminHeader } from "./Header";

const ResetPasswordContent = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [password, setPassword] = useState("");
    const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [succeeded, setSucceeded] = useState(false);

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignUpFormStyles.dark : SignUpFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const validation = useMemo(() => validatePassword(password), [password]);
    const showMeter = passwordFocused || password.length > 0;

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

    // After a successful reset show a brief confirmation then bounce
    // the user to /signin so they can log in with the new password.
    useEffect(() => {
        if (!succeeded) return;
        const handle = setTimeout(() => navigate("/signin"), 1500);
        return () => clearTimeout(handle);
    }, [succeeded, navigate]);

    const inputStyle = {
        "--Input-focusedThickness": "2px",
        "--Input-radius": "12px",
        background: styles.inputBg,
        border: `1px solid ${styles.inputBorder}`,
        fontSize: "15px",
        py: 1.25,
        transition: "all 0.2s ease",
        "&:hover": { borderColor: styles.accentColor },
        "&:focus-within": {
            borderColor: styles.inputFocusBorder,
            boxShadow: styles.inputFocusShadow,
        },
    };

    // Empty token = link is malformed or user navigated here directly.
    // Render the error state immediately without a network call.
    const tokenMissing = token.length === 0;

    return (
        <Box
            sx={(theme) => ({
                width: { xs: "100%", md: "100vw" },
                transition: "width var(--Transition-duration)",
                transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
                position: "relative",
                zIndex: 1,
                display: "flex",
                justifyContent: "flex-end",
                backdropFilter: "blur(12px)",
                backgroundColor: "rgba(255 255 255 / 0.2)",
                [theme.getColorSchemeSelector("dark")]: {
                    backgroundColor: "rgba(19 19 24 / 0.4)",
                },
            })}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100dvh",
                    width: "100%",
                    px: 2,
                }}
            >
                <AdminHeader />

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
                                    {succeeded
                                        ? t.admin.auth.passwordReset.successTitle
                                        : t.admin.auth.passwordReset.title}
                                </Typography>
                                <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                    {succeeded
                                        ? t.admin.auth.passwordReset.successBody
                                        : t.admin.auth.passwordReset.subtitle}
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

                        {tokenMissing ? (
                            <Stack spacing={2}>
                                <Alert
                                    color="warning"
                                    sx={{
                                        borderRadius: "12px",
                                        border: `1px solid ${palette.dangerTintBorder}`,
                                    }}
                                >
                                    {t.admin.auth.passwordReset.missingToken}
                                </Alert>
                                <Link
                                    href="/signin"
                                    level="title-sm"
                                    sx={{
                                        color: styles.linkColor,
                                        fontWeight: 600,
                                        "&:hover": { color: styles.linkHover },
                                    }}
                                >
                                    {t.admin.auth.passwordReset.backToSignIn}
                                </Link>
                            </Stack>
                        ) : succeeded ? (
                            <Stack alignItems="center" sx={{ py: 2 }}>
                                <CircularProgress size="md" />
                            </Stack>
                        ) : (
                            <form
                                onSubmit={async (event: React.FormEvent<HTMLFormElement>) => {
                                    event.preventDefault();
                                    setErrorMessage(null);
                                    if (!validation.isValid) {
                                        setErrorMessage(t.admin.auth.signUp.passwordTooWeak);
                                        return;
                                    }
                                    if (password !== confirmPasswordValue) {
                                        setErrorMessage(t.admin.auth.signUp.passwordMismatch);
                                        return;
                                    }
                                    setSubmitting(true);
                                    const ok = await confirmPasswordReset(
                                        token,
                                        password,
                                        setErrorMessage
                                    );
                                    setSubmitting(false);
                                    if (ok) setSucceeded(true);
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
                                            {t.admin.auth.signUp.passwordLabel}
                                        </FormLabel>
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder={t.admin.auth.signUp.passwordPlaceholder}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setPasswordFocused(true)}
                                            onBlur={() => setPasswordFocused(false)}
                                            startDecorator={
                                                <LockRoundedIcon
                                                    sx={{
                                                        color: styles.accentColor,
                                                        fontSize: 20,
                                                    }}
                                                />
                                            }
                                            endDecorator={
                                                <IconButton
                                                    aria-label={
                                                        showPassword
                                                            ? t.admin.auth.signUp
                                                                  .passwordVisibility.hide
                                                            : t.admin.auth.signUp
                                                                  .passwordVisibility.show
                                                    }
                                                    size="sm"
                                                    variant="plain"
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    sx={{
                                                        color: styles.accentColor,
                                                        "--IconButton-size": "28px",
                                                    }}
                                                >
                                                    {showPassword ? (
                                                        <VisibilityOffRoundedIcon
                                                            sx={{ fontSize: 20 }}
                                                        />
                                                    ) : (
                                                        <VisibilityRoundedIcon
                                                            sx={{ fontSize: 20 }}
                                                        />
                                                    )}
                                                </IconButton>
                                            }
                                            sx={inputStyle}
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
                                                        determinate
                                                        value={(validation.score / 4) * 100}
                                                        sx={{
                                                            flex: 1,
                                                            "--LinearProgress-thickness": "6px",
                                                        }}
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
                                            type={showConfirm ? "text" : "password"}
                                            placeholder={
                                                t.admin.auth.signUp.confirmPasswordPlaceholder
                                            }
                                            value={confirmPasswordValue}
                                            onChange={(e) =>
                                                setConfirmPasswordValue(e.target.value)
                                            }
                                            startDecorator={
                                                <LockRoundedIcon
                                                    sx={{
                                                        color: styles.accentColor,
                                                        fontSize: 20,
                                                    }}
                                                />
                                            }
                                            endDecorator={
                                                <IconButton
                                                    aria-label={
                                                        showConfirm
                                                            ? t.admin.auth.signUp
                                                                  .passwordVisibility.hide
                                                            : t.admin.auth.signUp
                                                                  .passwordVisibility.show
                                                    }
                                                    size="sm"
                                                    variant="plain"
                                                    onClick={() => setShowConfirm((v) => !v)}
                                                    sx={{
                                                        color: styles.accentColor,
                                                        "--IconButton-size": "28px",
                                                    }}
                                                >
                                                    {showConfirm ? (
                                                        <VisibilityOffRoundedIcon
                                                            sx={{ fontSize: 20 }}
                                                        />
                                                    ) : (
                                                        <VisibilityRoundedIcon
                                                            sx={{ fontSize: 20 }}
                                                        />
                                                    )}
                                                </IconButton>
                                            }
                                            sx={inputStyle}
                                        />
                                    </FormControl>

                                    <Button
                                        type="submit"
                                        fullWidth
                                        disabled={submitting}
                                        startDecorator={
                                            submitting ? (
                                                <CircularProgress size="sm" />
                                            ) : (
                                                <SaveRoundedIcon />
                                            )
                                        }
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
                                    >
                                        {t.admin.auth.passwordReset.submit}
                                    </Button>

                                    <Typography
                                        level="body-sm"
                                        textAlign="center"
                                        sx={{ color: styles.subtitleColor }}
                                    >
                                        <Link
                                            href="/signin"
                                            level="title-sm"
                                            sx={{
                                                color: styles.linkColor,
                                                fontWeight: 600,
                                                "&:hover": { color: styles.linkHover },
                                            }}
                                        >
                                            {t.admin.auth.passwordReset.backToSignIn}
                                        </Link>
                                    </Typography>
                                </Stack>
                            </form>
                        )}
                    </Box>
                </Box>

                <Box component="footer" sx={{ py: 3 }}>
                    <Typography
                        level="body-xs"
                        sx={{ textAlign: "center", color: styles.subtitleColor }}
                    >
                        {fmt(t.admin.brand.copyright, { year: new Date().getFullYear() })}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export const ResetPasswordForm = () => {
    return (
        <CssVarsProvider disableTransitionOnChange theme={purpleTheme}>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ":root": {
                        "--Form-maxWidth": "800px",
                        "--Transition-duration": "0.4s",
                    },
                }}
            />
            <I18nProvider>
                <ResetPasswordContent />
            </I18nProvider>
        </CssVarsProvider>
    );
};
