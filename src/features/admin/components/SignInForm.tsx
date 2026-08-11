import React, { useState } from "react";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Divider,
    FormControl,
    FormLabel,
    Input,
    Link,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import {
    AUTH_LOCAL_STORAGE_KEYS,
    clearUserScopedLocalStorage,
    useAuth,
} from "../../../context/AuthContext";
import { DatabaseUtils } from "../../../db/utils";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { OAUTH_INTEGRATIONS_ENABLED } from "../../integrations/featureFlags";
import { redirectToOAuthLogin } from "../../integrations/services/oauth";
import { demoSignIn } from "../services/demoSignin";
import { resendVerificationEmail } from "../services/emailVerification";
import { requestPasswordReset } from "../services/passwordReset";
import { signIn } from "../services/signin";
import { GoogleIcon } from "./icons/GoogleIcon";
import { LanguageSwitchButton } from "./LanguageSwitchButton";

interface FormElements extends HTMLFormControlsCollection {
    email: HTMLInputElement;
    password: HTMLInputElement;
    persistent: HTMLInputElement;
}
interface SignInFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

export const SignInForm = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rememberEmail, setRememberEmail] = useState<boolean>(false);
    const [openForgotPassword, setOpenForgotPassword] = useState<boolean>(false);
    const [forgotEmail, setForgotEmail] = useState<string>("");
    const [forgotSubmitting, setForgotSubmitting] = useState<boolean>(false);
    const [forgotSucceeded, setForgotSucceeded] = useState<boolean>(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [demoLoading, setDemoLoading] = useState<boolean>(false);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
    const { setAccessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignInFormStyles.dark : SignInFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const _signin = async (email: string, password: string) => {
        setUnverifiedEmail(null);
        setResendStatus("idle");
        const signInRes = await signIn(email, password, setErrorMessage);

        if (signInRes && "kind" in signInRes && signInRes.kind === "unverified") {
            setUnverifiedEmail(signInRes.email);
            setErrorMessage(null);
            return;
        }

        if (signInRes && "access" in signInRes) {
            // Capture the previously signed-in user before we touch
            // localStorage below, so we can decide whether to wipe the
            // previous user's caches. `userId` is intentionally preserved
            // across logout to support this comparison.
            const previousUserId = localStorage.getItem("userId");
            const isDifferentUser = previousUserId !== signInRes.user_id;

            if (isDifferentUser) {
                // Different user on this device — wipe the previous user's
                // localStorage (device-level UI prefs are preserved) so
                // their drafts / last-opened state / Spotlight history
                // don't leak into the new session.
                clearUserScopedLocalStorage();
            }

            setAccessToken(signInRes.access);
            localStorage.setItem("isSigningIn", "yes");
            localStorage.setItem("userName", signInRes.username || "");
            localStorage.setItem("userId", signInRes.user_id || "");
            localStorage.setItem("tsJoined", signInRes.ts_joined_at || "");
            localStorage.setItem("isOfflineForced", signInRes.is_offline_forced || "");
            localStorage.setItem("role", signInRes.role || "");
            localStorage.setItem("baseCountry", signInRes.base_country || "");
            localStorage.setItem("phoneNumber", signInRes.phone_number || "");
            localStorage.setItem("currentLocation", signInRes.current_location || "");
            // Store the string "false" only on an explicit opt-out; a missing
            // field (older server) leaves it shared, matching useAuth's read.
            localStorage.setItem(
                "locationShared",
                signInRes.location_shared === false ? "false" : "true"
            );
            localStorage.setItem("aboutMe", signInRes.about_me || "");
            localStorage.setItem("customStatus", signInRes.custom_status || "");
            localStorage.setItem("userEmail", signInRes.email || "");
            localStorage.setItem("avatarImgPath", signInRes.profile_image_file_name || "");

            if (signInRes.user_id) {
                if (isDifferentUser) {
                    await DatabaseUtils.clearTeamScopedStores();
                }

                navigate("/jointeam");
            } else {
                console.error("Failed to get userId from sign-in response:", signInRes);
            }
        }
    };

    const _resendVerification = async () => {
        if (!unverifiedEmail) return;
        setResendStatus("sending");
        const ok = await resendVerificationEmail(unverifiedEmail, setErrorMessage);
        setResendStatus(ok ? "sent" : "idle");
    };

    const _demoSignin = async () => {
        setDemoLoading(true);
        setErrorMessage(null);
        try {
            // Clear any cached data from a prior session (real user OR
            // a previous demo). Without this, a stale userId / teamId
            // or leftover IndexedDB rows could leak into the new demo
            // session before the new values are written below.
            AUTH_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
            await DatabaseUtils.clearTeamScopedStores();

            const res = await demoSignIn(setErrorMessage);
            if (!res) return;

            setAccessToken(res.access);
            localStorage.setItem("isSigningIn", "yes");
            localStorage.setItem("userName", res.username || "");
            localStorage.setItem("userId", res.user_id || "");
            localStorage.setItem("tsJoined", res.ts_joined_at || "");
            localStorage.setItem("isOfflineForced", res.is_offline_forced || "");
            localStorage.setItem("role", res.role || "");
            localStorage.setItem("baseCountry", res.base_country || "");
            localStorage.setItem("phoneNumber", res.phone_number || "");
            localStorage.setItem("currentLocation", res.current_location || "");
            localStorage.setItem(
                "locationShared",
                res.location_shared === false ? "false" : "true"
            );
            localStorage.setItem("aboutMe", res.about_me || "");
            localStorage.setItem("customStatus", res.custom_status || "");
            localStorage.setItem("userEmail", res.email || "");
            localStorage.setItem("avatarImgPath", res.profile_image_file_name || "");
            // Demo-specific: pre-set the team so we can skip /jointeam.
            localStorage.setItem("teamId", res.team_id);
            localStorage.setItem("teamName", res.team_name);
            localStorage.setItem("isDemoUser", "yes");

            navigate("/workspace");
        } finally {
            setDemoLoading(false);
        }
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
        <>
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
                        position: "relative",
                    }}
                >
                    <Box sx={{ position: "absolute", top: 14, right: 14 }}>
                        <LanguageSwitchButton color={styles.subtitleColor} />
                    </Box>
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
                                {t.admin.auth.signIn.title}
                            </Typography>
                            <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                {t.admin.auth.signIn.newMemberPrompt}{" "}
                                <Link
                                    component="button"
                                    level="title-sm"
                                    type="button"
                                    sx={{
                                        color: styles.linkColor,
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            color: styles.linkHover,
                                        },
                                    }}
                                    onClick={() => navigate("/signup")}
                                >
                                    {t.admin.auth.signIn.createAccountLink}
                                </Link>
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

                        {unverifiedEmail && (
                            <Alert
                                color="warning"
                                sx={{
                                    borderRadius: "12px",
                                    flexDirection: "column",
                                    alignItems: "stretch",
                                    gap: 1,
                                }}
                            >
                                <Typography level="body-sm">
                                    {resendStatus === "sent"
                                        ? t.admin.auth.signIn.emailNotVerified.resendSent
                                        : t.admin.auth.signIn.emailNotVerified.message}
                                </Typography>
                                {resendStatus !== "sent" && (
                                    <Button
                                        color="warning"
                                        disabled={resendStatus === "sending"}
                                        size="sm"
                                        sx={{ alignSelf: "flex-start" }}
                                        variant="soft"
                                        onClick={_resendVerification}
                                    >
                                        {resendStatus === "sending"
                                            ? t.admin.auth.signIn.emailNotVerified.resending
                                            : t.admin.auth.signIn.emailNotVerified.resendButton}
                                    </Button>
                                )}
                            </Alert>
                        )}
                    </Stack>

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
                                            background: `rgba(${styles.accentColorRgb}, 0.063)`,
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
                                            background: `rgba(${styles.accentColorRgb}, 0.063)`,
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
                        onSubmit={(event: React.FormEvent<SignInFormElement>) => {
                            event.preventDefault();
                            const formElements = event.currentTarget.elements;
                            const email = formElements.email.value;
                            const password = formElements.password.value;

                            if (!email || !password) {
                                return;
                            }

                            _signin(email, password);

                            if (rememberEmail) {
                                localStorage.setItem("signInEmail", email);
                            }
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
                                    {t.admin.auth.signIn.emailLabel}
                                </FormLabel>
                                <Input
                                    defaultValue={localStorage.getItem("signInEmail") || ""}
                                    name="email"
                                    placeholder={t.admin.auth.signIn.emailPlaceholder}
                                    sx={inputStyle}
                                    type="email"
                                    startDecorator={
                                        <EmailRoundedIcon
                                            sx={{ color: styles.accentColor, fontSize: 20 }}
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
                                    {t.admin.auth.signIn.passwordLabel}
                                </FormLabel>
                                <Input
                                    name="password"
                                    placeholder={t.admin.auth.signIn.passwordPlaceholder}
                                    sx={inputStyle}
                                    type="password"
                                    startDecorator={
                                        <LockRoundedIcon
                                            sx={{ color: styles.accentColor, fontSize: 20 }}
                                        />
                                    }
                                />
                            </FormControl>

                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Checkbox
                                    label={t.admin.auth.signIn.rememberMe}
                                    name="persistent"
                                    size="sm"
                                    sx={{
                                        "& .MuiCheckbox-checkbox": {
                                            borderRadius: "6px",
                                        },
                                    }}
                                    onChange={(event) => {
                                        if (event.target.checked) {
                                            setRememberEmail(true);
                                        }
                                    }}
                                />
                                <Link
                                    component="button"
                                    level="body-sm"
                                    type="button"
                                    sx={{
                                        color: styles.linkColor,
                                        fontWeight: 500,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            color: styles.linkHover,
                                        },
                                    }}
                                    onClick={() => {
                                        // Seed the modal email from the
                                        // "Remember me" localStorage so
                                        // returning users don't retype.
                                        setForgotEmail(localStorage.getItem("signInEmail") || "");
                                        setForgotSucceeded(false);
                                        setForgotError(null);
                                        setOpenForgotPassword(true);
                                    }}
                                >
                                    {t.admin.auth.signIn.forgotPassword}
                                </Link>
                            </Box>

                            <Button
                                startDecorator={<LoginRoundedIcon />}
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
                                        boxShadow: `${styles.buttonShadow}, 0 8px 24px rgba(var(--gp-brand-700-rgb), 0.3)`,
                                    },
                                }}
                                fullWidth
                            >
                                {t.admin.auth.signIn.submit}
                            </Button>
                        </Stack>
                    </form>

                    <Divider sx={{ my: 2.5, color: styles.subtitleColor }}>
                        {t.admin.auth.signIn.orDivider}
                    </Divider>

                    <Stack sx={{ gap: 0.75 }}>
                        <Button
                            disabled={demoLoading}
                            variant="outlined"
                            startDecorator={
                                demoLoading ? (
                                    <CircularProgress size="sm" />
                                ) : (
                                    <ScienceRoundedIcon />
                                )
                            }
                            sx={{
                                py: 1.5,
                                borderRadius: "12px",
                                fontWeight: 600,
                                fontSize: "15px",
                                borderColor: styles.accentColor,
                                color: styles.linkColor,
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                "&:hover": {
                                    background: `rgba(${styles.accentColorRgb}, 0.082)`,
                                    borderColor: styles.accentColor,
                                    transform: "translateY(-2px)",
                                },
                            }}
                            fullWidth
                            onClick={_demoSignin}
                        >
                            {demoLoading
                                ? t.admin.auth.signIn.demoLoading
                                : t.admin.auth.signIn.demoButton}
                        </Button>
                        <Stack sx={{ gap: 0.25, mt: 0.5 }}>
                            <Typography
                                level="body-xs"
                                sx={{
                                    textAlign: "center",
                                    color: styles.subtitleColor,
                                }}
                            >
                                {t.admin.auth.signIn.demoHint}
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    textAlign: "center",
                                    fontWeight: 600,
                                    color: styles.accentColor,
                                }}
                            >
                                {t.admin.auth.signIn.demoWarning}
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>
            </Box>

            <Modal
                open={openForgotPassword}
                sx={{ backdropFilter: "blur(4px)" }}
                onClose={() => {
                    setOpenForgotPassword(false);
                    // Reset transient modal state when it closes so the
                    // next open starts fresh.
                    setForgotSucceeded(false);
                    setForgotError(null);
                    setForgotSubmitting(false);
                }}
            >
                <ModalDialog
                    sx={{
                        background: styles.cardBg,
                        border: `1px solid ${styles.cardBorder}`,
                        borderRadius: "16px",
                        boxShadow: styles.cardShadow,
                        p: 3,
                        maxWidth: 400,
                    }}
                >
                    <Typography
                        level="title-lg"
                        sx={{
                            background: styles.titleGradient,
                            backgroundClip: "text",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 700,
                            mb: 1,
                        }}
                    >
                        {forgotSucceeded
                            ? t.admin.auth.forgotPassword.successTitle
                            : t.admin.auth.forgotPassword.title}
                    </Typography>
                    <Typography level="body-md" sx={{ color: styles.subtitleColor, mb: 2 }}>
                        {forgotSucceeded
                            ? t.admin.auth.forgotPassword.successBody
                            : t.admin.auth.forgotPassword.body}
                    </Typography>

                    {!forgotSucceeded && (
                        <form
                            onSubmit={async (event) => {
                                event.preventDefault();
                                if (!forgotEmail) return;
                                setForgotError(null);
                                setForgotSubmitting(true);
                                const ok = await requestPasswordReset(forgotEmail, setForgotError);
                                setForgotSubmitting(false);
                                if (ok) setForgotSucceeded(true);
                            }}
                        >
                            <FormControl sx={{ mb: 1.5 }} required>
                                <Input
                                    placeholder={t.admin.auth.forgotPassword.emailPlaceholder}
                                    type="email"
                                    value={forgotEmail}
                                    startDecorator={
                                        <EmailRoundedIcon
                                            sx={{ color: styles.accentColor, fontSize: 20 }}
                                        />
                                    }
                                    sx={{
                                        "--Input-focusedThickness": "2px",
                                        "--Input-radius": "10px",
                                        background: styles.inputBg,
                                        border: `1px solid ${styles.inputBorder}`,
                                        py: 1,
                                        "&:focus-within": {
                                            borderColor: styles.inputFocusBorder,
                                            boxShadow: styles.inputFocusShadow,
                                        },
                                    }}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                />
                            </FormControl>
                            {forgotError && (
                                <Alert
                                    color="danger"
                                    sx={{
                                        borderRadius: "10px",
                                        border: `1px solid ${palette.dangerTintBorder}`,
                                        mb: 1.5,
                                    }}
                                >
                                    {forgotError}
                                </Alert>
                            )}
                            <Button
                                disabled={forgotSubmitting || !forgotEmail}
                                type="submit"
                                startDecorator={
                                    forgotSubmitting ? <CircularProgress size="sm" /> : null
                                }
                                sx={{
                                    py: 1.25,
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    background: styles.buttonBg,
                                    "&:hover": { background: styles.buttonHover },
                                }}
                                fullWidth
                            >
                                {t.admin.auth.forgotPassword.submit}
                            </Button>
                        </form>
                    )}

                    <Button
                        variant="outlined"
                        sx={{
                            mt: 2,
                            borderRadius: "10px",
                            borderColor: styles.cardBorder,
                            color: styles.linkColor,
                            "&:hover": {
                                borderColor: styles.accentColor,
                                background: `rgba(${styles.accentColorRgb}, 0.082)`,
                            },
                        }}
                        onClick={() => {
                            setOpenForgotPassword(false);
                            setForgotSucceeded(false);
                            setForgotError(null);
                            setForgotSubmitting(false);
                        }}
                    >
                        {t.admin.auth.forgotPassword.close}
                    </Button>
                </ModalDialog>
            </Modal>
        </>
    );
};
