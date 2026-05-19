import React, { useState } from "react";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    CssBaseline,
    Divider,
    FormControl,
    FormLabel,
    GlobalStyles,
    Input,
    Link,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import { AUTH_LOCAL_STORAGE_KEYS, useAuth } from "../../../context/AuthContext";
import { DatabaseUtils } from "../../../db/utils";
import { fmt, I18nProvider, useTranslation } from "../../../i18n";
import { purplePalette, purpleTheme } from "../../../theme/purplePalette";
import { SignInResponse } from "../../../types/admin";
import { demoSignIn } from "../services/demoSignin";
import { signIn } from "../services/signin";
import { AdminHeader } from "./Header";

interface FormElements extends HTMLFormControlsCollection {
    email: HTMLInputElement;
    password: HTMLInputElement;
    persistent: HTMLInputElement;
}
interface SignInFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

const SignInContent = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rememberEmail, setRememberEmail] = useState<boolean>(false);
    const [openForgotPassword, setOpenForgotPassword] = useState<boolean>(false);
    const [demoLoading, setDemoLoading] = useState<boolean>(false);
    const { setAccessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignInFormStyles.dark : SignInFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const _signin = async (email: string, password: string) => {
        const signInRes: SignInResponse = await signIn(email, password, setErrorMessage);

        if (signInRes) {
            // Capture the previously signed-in user before the setItem block
            // below overwrites it, so we can skip wiping IndexedDB when the
            // same user is signing back in. `userId` is intentionally
            // preserved across logout to support this comparison.
            const previousUserId = localStorage.getItem("userId");

            setAccessToken(signInRes.access);
            localStorage.setItem("isSigningIn", "yes");
            localStorage.setItem("userName", signInRes.username || "");
            localStorage.setItem("userId", signInRes.user_id || "");
            localStorage.setItem("tsJoined", signInRes.ts_joined_at || "");
            localStorage.setItem("isOfflineForced", signInRes.is_offline_forced || "");
            localStorage.setItem("role", signInRes.role || "");
            localStorage.setItem("baseCountry", signInRes.base_country || "");
            localStorage.setItem("customStatus", signInRes.custom_status || "");
            localStorage.setItem("userEmail", signInRes.email || "");
            localStorage.setItem("avatarImgPath", signInRes.profile_image_file_name || "");

            if (signInRes.user_id) {
                if (previousUserId !== signInRes.user_id) {
                    await DatabaseUtils.clearTeamScopedStores();
                }

                navigate("/jointeam");
            } else {
                console.error("Failed to get userId from sign-in response:", signInRes);
            }
        }
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
                                    {t.admin.auth.signIn.title}
                                </Typography>
                                <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                    {t.admin.auth.signIn.newMemberPrompt}{" "}
                                    <Link
                                        href="signup"
                                        level="title-sm"
                                        sx={{
                                            color: styles.linkColor,
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                color: styles.linkHover,
                                            },
                                        }}
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
                        </Stack>

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
                                        type="email"
                                        placeholder={t.admin.auth.signIn.emailPlaceholder}
                                        startDecorator={
                                            <EmailRoundedIcon
                                                sx={{ color: styles.accentColor, fontSize: 20 }}
                                            />
                                        }
                                        sx={inputStyle}
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
                                        type="password"
                                        placeholder={t.admin.auth.signIn.passwordPlaceholder}
                                        startDecorator={
                                            <LockRoundedIcon
                                                sx={{ color: styles.accentColor, fontSize: 20 }}
                                            />
                                        }
                                        sx={inputStyle}
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
                                        type="button"
                                        level="body-sm"
                                        sx={{
                                            color: styles.linkColor,
                                            fontWeight: 500,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                color: styles.linkHover,
                                            },
                                        }}
                                        onClick={() => setOpenForgotPassword(true)}
                                    >
                                        {t.admin.auth.signIn.forgotPassword}
                                    </Link>
                                </Box>

                                <Button
                                    type="submit"
                                    fullWidth
                                    startDecorator={<LoginRoundedIcon />}
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
                                            boxShadow: `${styles.buttonShadow}, 0 8px 24px rgba(124,58,237,0.3)`,
                                        },
                                    }}
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
                                fullWidth
                                variant="outlined"
                                disabled={demoLoading}
                                onClick={_demoSignin}
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
                                        background: `${styles.accentColor}15`,
                                        borderColor: styles.accentColor,
                                        transform: "translateY(-2px)",
                                    },
                                }}
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

                <Box component="footer" sx={{ py: 3 }}>
                    <Typography
                        level="body-xs"
                        sx={{ textAlign: "center", color: styles.subtitleColor }}
                    >
                        {fmt(t.admin.brand.copyright, { year: new Date().getFullYear() })}
                    </Typography>
                </Box>
            </Box>

            <Modal
                open={openForgotPassword}
                onClose={() => setOpenForgotPassword(false)}
                sx={{ backdropFilter: "blur(4px)" }}
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
                        {t.admin.auth.forgotPassword.title}
                    </Typography>
                    <Typography level="body-md" sx={{ color: styles.subtitleColor, mb: 2 }}>
                        {t.admin.auth.forgotPassword.body}
                    </Typography>
                    <Typography
                        component="a"
                        href="mailto:genos.support@gmail.com?subject=Password%20Reset%20Request&body=Hi%2C%0A%0AI%20forgot%20my%20password.%20Could%20you%20please%20reset%20it%3F%0A%0AMy%20email%3A<replace_with_your_email>%20%0A%0AThank%20you."
                        startDecorator={
                            <EmailRoundedIcon sx={{ color: styles.accentColor, fontSize: 20 }} />
                        }
                        sx={{
                            textDecoration: "none",
                            color: styles.linkColor,
                            fontWeight: 600,
                            fontSize: "15px",
                            transition: "all 0.2s ease",
                            "&:hover": { color: styles.linkHover },
                        }}
                    >
                        genos.support@gmail.com
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{
                            mt: 2,
                            borderRadius: "10px",
                            borderColor: styles.cardBorder,
                            color: styles.linkColor,
                            "&:hover": {
                                borderColor: styles.accentColor,
                                background: `${styles.accentColor}15`,
                            },
                        }}
                        onClick={() => setOpenForgotPassword(false)}
                    >
                        {t.admin.auth.forgotPassword.close}
                    </Button>
                </ModalDialog>
            </Modal>
        </Box>
    );
};

export const SignInForm = () => {
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
                <SignInContent />
            </I18nProvider>
        </CssVarsProvider>
    );
};
