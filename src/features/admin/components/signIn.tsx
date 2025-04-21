import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { CssVarsProvider, useColorScheme } from '@mui/joy/styles';
import GlobalStyles from '@mui/joy/GlobalStyles';
import CssBaseline from '@mui/joy/CssBaseline';
import { Alert } from "@mui/joy";
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Checkbox from '@mui/joy/Checkbox';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import IconButton, { IconButtonProps } from '@mui/joy/IconButton';
import Link from '@mui/joy/Link';
import Input from '@mui/joy/Input';
import Typography from '@mui/joy/Typography';
import Stack from '@mui/joy/Stack';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import BusinessIcon from '@mui/icons-material/Business';
import { useAuth } from "../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FormElements extends HTMLFormControlsCollection {
    email: HTMLInputElement;
    password: HTMLInputElement;
    persistent: HTMLInputElement;
}
interface SignInFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

type SignInResponse = {
    username: string;
    user_id: string;
    email: string;
    access: string | null;
    message: string;
};

type MyTeamResponse = {
    team_ids: number[];
}

function ColorSchemeToggle(props: IconButtonProps) {
    const { onClick, ...other } = props;
    const { mode, setMode } = useColorScheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    return (
        <IconButton
            aria-label="toggle light/dark mode"
            size="sm"
            variant="outlined"
            disabled={!mounted}
            onClick={(event) => {
                setMode(mode === 'light' ? 'dark' : 'light');
                onClick?.(event);
            }}
            {...other}
        >
            {mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
        </IconButton>
    );
}


export default function SignIn() {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rememberEmail, setRememberEmail] = useState<boolean>(false);
    const { setAccessToken } = useAuth();

    async function signIn(email: string, password: string): Promise<SignInResponse> {

        try {
            // Sign In
            const signInResponse = await fetch(`${base_url}/user/signin/`, {
                method: 'POST',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data: SignInResponse = await signInResponse.json();

            if (!signInResponse.ok) {
                const err_msg = data.message || 'Authentication Failed'
                setErrorMessage(err_msg);
                throw new Error(err_msg);
            }

            setAccessToken(data.access); // Store access token in memory
            localStorage.setItem("isSigningIn", "yes");
            localStorage.setItem("userName", data.username);
            localStorage.setItem("userId", data.user_id);
            localStorage.setItem("userEmail", data.email);

            // Get joining teams
            const myTeamResponse = await fetch(`${base_url}/team/getMyTeams/?user_id=${data.user_id}`, {
                method: 'GET',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${data.access}`
                }
            });
            const myTeamData: MyTeamResponse = await myTeamResponse.json();
            if (!myTeamResponse.ok) {
                const err_msg = 'Failed to get my teams'
                setErrorMessage(err_msg);
                throw new Error(err_msg);
            }

            if (myTeamData.team_ids.length > 0) {
                navigate('/SelectTeam')
            } else {
                navigate('/CreateTeam')
            }

            return data

        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
            navigate('/');
            return { message: err_msg, user_id: "", username: "", email: "", access: null }
        }

    }

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ':root': {
                        '--Form-maxWidth': '800px',
                        '--Transition-duration': '0.4s', // set to `none` to disable transition
                    },
                }}
            />
            <Box
                sx={(theme) => ({
                    width: { xs: '100%', md: '50vw' },
                    transition: 'width var(--Transition-duration)',
                    transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    backdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(255 255 255 / 0.2)',
                    [theme.getColorSchemeSelector('dark')]: {
                        backgroundColor: 'rgba(19 19 24 / 0.4)',
                    },
                })}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '100dvh',
                        width: '100%',
                        px: 2,
                    }}
                >
                    <Box
                        component="header"
                        sx={{ py: 3, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
                            <IconButton component='a' variant="soft" color="primary" size="sm">
                                <BusinessIcon />
                            </IconButton>
                            <Typography level="title-lg">Origin</Typography>
                        </Box>
                        <ColorSchemeToggle />
                    </Box>
                    <Box
                        component="main"
                        sx={{
                            my: 'auto',
                            py: 2,
                            pb: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            width: 400,
                            maxWidth: '100%',
                            mx: 'auto',
                            borderRadius: 'sm',
                            '& form': {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                            },
                            [`& .MuiFormLabel-asterisk`]: {
                                visibility: 'hidden',
                            },
                        }}
                    >
                        <Stack sx={{ gap: 4, mb: 2 }}>
                            <Stack sx={{ gap: 1 }}>
                                <Typography component="h1" level="h3">
                                    Sign in
                                </Typography>
                                <Typography level="body-sm">
                                    New to company?{' '}
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
                                    event.preventDefault(); // Needs for prevent reload page
                                    const formElements = event.currentTarget.elements;
                                    const email = formElements.email.value
                                    const password = formElements.password.value

                                    if (!email || !password) {
                                        return {
                                            type: 'CredentialsSignin',
                                            error: 'Email and password are required.',
                                        };
                                    }

                                    signIn(email, password);

                                    if (rememberEmail) {
                                        localStorage.setItem("signInEmail", email)
                                    }

                                }}
                            >
                                <FormControl required>
                                    <FormLabel>Email</FormLabel>
                                    <Input type="email" name="email" defaultValue={localStorage.getItem("signInEmail") || ""} />
                                </FormControl>
                                <FormControl required>
                                    <FormLabel>Password</FormLabel>
                                    <Input type="password" name="password" />
                                </FormControl>
                                <Stack sx={{ gap: 4, mt: 2 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Checkbox size="sm" label="Remember me" name="persistent" onChange={(event) => {
                                            if (event.target.checked) {
                                                setRememberEmail(true)
                                            } else {
                                                setRememberEmail(false)
                                                localStorage.setItem("signInEmail", "")
                                            }
                                        }} />
                                        <Link level="title-sm" href="#replace-with-a-link">
                                            Forgot your password?
                                        </Link>
                                    </Box>
                                    <Button type="submit" fullWidth>
                                        Sign in
                                    </Button>
                                </Stack>
                            </form>
                        </Stack>

                    </Box>
                    <Box component="footer" sx={{ py: 3 }}>
                        <Typography level="body-xs" sx={{ textAlign: 'center' }}>
                            © Origin {new Date().getFullYear()}
                        </Typography>
                    </Box>
                </Box>
            </Box>
            <Box
                sx={(theme) => ({
                    height: '100%',
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    left: { xs: 0, md: '50vw' },
                    transition:
                        'background-image var(--Transition-duration), left var(--Transition-duration) !important',
                    transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
                    backgroundColor: 'background.level1',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundImage:
                        'url(https://images.unsplash.com/photo-1527181152855-fc03fc7949c8?auto=format&w=1000&dpr=2)',
                    [theme.getColorSchemeSelector('dark')]: {
                        backgroundImage:
                            'url(https://images.unsplash.com/photo-1572072393749-3ca9c8ea0831?auto=format&w=1000&dpr=2)',
                    },
                })}
            />
        </CssVarsProvider>
    );
}
