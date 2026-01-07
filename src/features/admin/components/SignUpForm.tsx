import React, { useState } from "react";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import {
    Alert,
    Box,
    Button,
    CssBaseline,
    FormControl,
    FormLabel,
    GlobalStyles,
    Input,
    Link,
    Stack,
    Typography,
} from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignUpResponse } from "../../../types/admin";
import { signUp } from "../services/signup";
import { AdminHeader } from "./Header";

// Theme-aware styling - Green/Emerald theme for sign up
const FORM_STYLES = {
    dark: {
        cardBg: "linear-gradient(145deg, rgba(30,32,44,0.95) 0%, rgba(20,22,34,0.98) 100%)",
        cardBorder: "rgba(34,197,94,0.2)",
        cardShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(34,197,94,0.1)",
        inputBg: "rgba(0,0,0,0.3)",
        inputBorder: "rgba(34,197,94,0.2)",
        inputFocusBorder: "#4ade80",
        inputFocusShadow: "0 0 0 3px rgba(34,197,94,0.2)",
        labelColor: "rgba(148,163,184,0.9)",
        titleGradient: "linear-gradient(90deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
        buttonBg: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        buttonHover: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
        buttonShadow: "0 4px 16px rgba(34,197,94,0.4)",
        linkColor: "#4ade80",
        linkHover: "#22c55e",
        accentColor: "#4ade80",
        textColor: "#f1f5f9",
        subtitleColor: "#94a3b8",
    },
    light: {
        cardBg: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        cardBorder: "rgba(22,163,74,0.15)",
        cardShadow: "0 8px 32px rgba(34,197,94,0.1), 0 0 60px rgba(34,197,94,0.05)",
        inputBg: "rgba(255,255,255,0.9)",
        inputBorder: "rgba(22,163,74,0.2)",
        inputFocusBorder: "#16a34a",
        inputFocusShadow: "0 0 0 3px rgba(34,197,94,0.1)",
        labelColor: "rgba(71,85,105,0.9)",
        titleGradient: "linear-gradient(90deg, #16a34a 0%, #15803d 50%, #166534 100%)",
        buttonBg: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
        buttonHover: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
        buttonShadow: "0 4px 16px rgba(34,197,94,0.3)",
        linkColor: "#16a34a",
        linkHover: "#15803d",
        accentColor: "#16a34a",
        textColor: "#1e293b",
        subtitleColor: "#64748b",
    },
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

const SignUpContent = () => {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? FORM_STYLES.dark : FORM_STYLES.light;

    const _signup = async (username: string, email: string, password: string) => {
        const signUpRes: SignUpResponse = await signUp(
            username,
            email,
            password,
            false,
            setErrorMessage
        );
        if (signUpRes) {
            navigate("/");
        } else {
            navigate("/SignUp");
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
                        width: 420,
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
                                    Create Account
                                </Typography>
                                <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                    Join us and start your journey
                                </Typography>
                            </Stack>

                            {errorMessage && (
                                <Alert
                                    color="danger"
                                    sx={{
                                        borderRadius: "12px",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                    }}
                                >
                                    {errorMessage}
                                </Alert>
                            )}
                        </Stack>

                        <form
                            onSubmit={(event: React.FormEvent<SignUpFormElement>) => {
                                event.preventDefault();
                                const formElements = event.currentTarget.elements;
                                const name = formElements.userName.value;
                                const email = formElements.email.value;
                                const password = formElements.password.value;
                                const confirm_password = formElements.confirm_password.value;

                                if (password !== confirm_password) {
                                    setErrorMessage("Passwords do not match.");
                                } else {
                                    _signup(name, email, password);
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
                                        Name
                                    </FormLabel>
                                    <Input
                                        name="userName"
                                        type="text"
                                        placeholder="Enter your name"
                                        startDecorator={
                                            <BadgeRoundedIcon
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
                                        Email
                                    </FormLabel>
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email"
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
                                        Password
                                    </FormLabel>
                                    <Input
                                        name="password"
                                        type="password"
                                        placeholder="Create a password"
                                        startDecorator={
                                            <LockRoundedIcon
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
                                        Confirm Password
                                    </FormLabel>
                                    <Input
                                        name="confirm_password"
                                        type="password"
                                        placeholder="Confirm your password"
                                        startDecorator={
                                            <LockRoundedIcon
                                                sx={{ color: styles.accentColor, fontSize: 20 }}
                                            />
                                        }
                                        sx={inputStyle}
                                    />
                                </FormControl>

                                <Button
                                    type="submit"
                                    fullWidth
                                    startDecorator={<PersonAddRoundedIcon />}
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
                                            boxShadow: `${styles.buttonShadow}, 0 8px 24px rgba(34,197,94,0.3)`,
                                        },
                                    }}
                                >
                                    Create Account
                                </Button>

                                <Typography
                                    level="body-sm"
                                    textAlign="center"
                                    sx={{ color: styles.subtitleColor }}
                                >
                                    Already have an account?{" "}
                                    <Link
                                        href="SignIn"
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
                                        Sign in
                                    </Link>
                                </Typography>
                            </Stack>
                        </form>
                    </Box>
                </Box>

                <Box component="footer" sx={{ py: 3 }}>
                    <Typography
                        level="body-xs"
                        sx={{ textAlign: "center", color: styles.subtitleColor }}
                    >
                        © Origin {new Date().getFullYear()}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export const SignUpForm = () => {
    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ":root": {
                        "--Form-maxWidth": "800px",
                        "--Transition-duration": "0.4s",
                    },
                }}
            />
            <SignUpContent />
        </CssVarsProvider>
    );
};
