import React, { useState } from "react";
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
import { CssVarsProvider } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignUpResponse } from "../../../types/admin";
import { signUp } from "../services/signup";
import { AdminBackground } from "./Background";
import { AdminHeader } from "./Header";

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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
                                    Sign Up
                                </Typography>
                            </Stack>
                            {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
                        </Stack>

                        <Stack sx={{ gap: 4, mt: 2 }}>
                            <form
                                onSubmit={(event: React.FormEvent<SignUpFormElement>) => {
                                    event.preventDefault(); // Needs for prevent reload page

                                    const formElements = event.currentTarget.elements;
                                    const name = formElements.userName.value;
                                    const email = formElements.email.value;
                                    const password = formElements.password.value;
                                    const confirm_password = formElements.confirm_password.value;

                                    if (password !== confirm_password) {
                                        setErrorMessage("Failed to confirm your password.");
                                    } else {
                                        _signup(name, email, password);
                                    }
                                }}
                            >
                                <FormControl required>
                                    <FormLabel>Name</FormLabel>
                                    <Input type="name" name="userName" />
                                </FormControl>

                                <FormControl required>
                                    <FormLabel>Email</FormLabel>
                                    <Input type="email" name="email" />
                                </FormControl>

                                <FormControl required>
                                    <FormLabel>Password</FormLabel>
                                    <Input type="password" name="password" />
                                </FormControl>

                                <FormControl required>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <Input type="password" name="confirm_password" />
                                </FormControl>

                                <Stack sx={{ gap: 4, mt: 2 }}>
                                    <Button type="submit" fullWidth variant="soft">
                                        Sign up
                                    </Button>
                                </Stack>
                            </form>
                        </Stack>

                        <Typography level="body-sm" textAlign={"right"}>
                            <Link href="SignIn" level="title-sm">
                                Back to Sign In
                            </Link>
                        </Typography>
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
