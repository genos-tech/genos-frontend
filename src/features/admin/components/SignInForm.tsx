import React, { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CssBaseline,
    FormControl,
    FormLabel,
    GlobalStyles,
    Input,
    Link,
    Stack,
    Typography,
} from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { SignInResponse } from "../../../types/admin";
import { signIn } from "../services/signin";
import { AdminBackground } from "./Background";
import { AdminHeader } from "./Header";

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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rememberEmail, setRememberEmail] = useState<boolean>(false);
    const { setAccessToken } = useAuth();

    const _signin = async (email: string, password: string) => {
        const signInRes: SignInResponse = await signIn(email, password, setErrorMessage);

        if (signInRes) {
            setAccessToken(signInRes.access); // Store access token in memory
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
                navigate("/JoinTeam");
            } else {
                console.error("Failed to get userId from sign-in response:", signInRes);
            }
        }
    };

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
            <Box
                sx={(theme) => ({
                    width: { xs: "100%", md: "50vw" },
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
                            width: 400,
                            maxWidth: "100%",
                            mx: "auto",
                            borderRadius: "sm",
                            "& form": {
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            },
                            [`& .MuiFormLabel-asterisk`]: {
                                visibility: "hidden",
                            },
                        }}
                    >
                        <Stack sx={{ gap: 4, mb: 2 }}>
                            <Stack sx={{ gap: 1 }}>
                                <Typography component="h1" level="h3">
                                    Sign In
                                </Typography>
                                <Typography level="body-sm">
                                    New member?{" "}
                                    <Link href="SignUp" level="title-sm">
                                        Sign up!
                                    </Link>
                                </Typography>
                            </Stack>

                            {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
                        </Stack>

                        <Stack sx={{ gap: 4, mt: 2 }}>
                            <form
                                onSubmit={(event: React.FormEvent<SignInFormElement>) => {
                                    event.preventDefault();

                                    const formElements = event.currentTarget.elements;
                                    const email = formElements.email.value;
                                    const password = formElements.password.value;

                                    if (!email || !password) {
                                        return {
                                            type: "CredentialsSignin",
                                            error: "Email and password are required.",
                                        };
                                    }

                                    _signin(email, password);

                                    if (rememberEmail) {
                                        localStorage.setItem("signInEmail", email);
                                    }
                                }}
                            >
                                <FormControl required>
                                    <FormLabel>Email</FormLabel>
                                    <Input
                                        type="email"
                                        name="email"
                                        defaultValue={localStorage.getItem("signInEmail") || ""}
                                    />
                                </FormControl>

                                <FormControl required>
                                    <FormLabel>Password</FormLabel>
                                    <Input type="password" name="password" />
                                </FormControl>

                                <Stack sx={{ gap: 4, mt: 2 }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Checkbox
                                            size="sm"
                                            label="Remember me"
                                            name="persistent"
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setRememberEmail(true);
                                                }
                                            }}
                                        />
                                        <Link level="title-sm" href="#replace-with-a-link">
                                            Forgot your password?
                                        </Link>
                                    </Box>
                                    <Button type="submit" fullWidth variant="soft">
                                        Sign In
                                    </Button>
                                </Stack>
                            </form>
                        </Stack>
                    </Box>

                    <Box component="footer" sx={{ py: 3 }}>
                        <Typography level="body-xs" sx={{ textAlign: "center" }}>
                            © Origin {new Date().getFullYear()}
                        </Typography>
                    </Box>
                </Box>
            </Box>
            <AdminBackground />
        </CssVarsProvider>
    );
};
