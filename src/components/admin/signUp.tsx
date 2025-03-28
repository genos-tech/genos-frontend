import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { CssVarsProvider, useColorScheme } from '@mui/joy/styles';
import GlobalStyles from '@mui/joy/GlobalStyles';
import CssBaseline from '@mui/joy/CssBaseline';
import { Alert } from "@mui/joy";
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import IconButton, { IconButtonProps } from '@mui/joy/IconButton';
import Input from '@mui/joy/Input';
import Typography from '@mui/joy/Typography';
import Stack from '@mui/joy/Stack';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import Link from '@mui/joy/Link';

const base_url = import.meta.env.VITE_API_BASE_URL;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FormElements extends HTMLFormControlsCollection {
    userName: HTMLInputElement;
    email: HTMLInputElement;
    password: HTMLInputElement;
    confirm_password: HTMLInputElement;
}
interface SignUpFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

type SignUpResponse = {
    access: string | null;
    refresh: string | null;
    user: any | null;
    message: string;
};

type CreateMyDMResponse = {
    dm_id: string | null;
    ts_created_at: string | null;
    ts_updated_at: string | null;
    user_1_email: string | null;
    user_2_email: string | null;
};

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


export default function SignUp() {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function fetchData(name: string, email: string, password: string): Promise<SignUpResponse> {

        try {
            const signupResponse = await fetch(`${base_url}/user/signup/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: name,
                    email: email,
                    password: password
                }),
            });

            const signupData: SignUpResponse = await signupResponse.json();

            if (!signupResponse.ok) {
                setErrorMessage(signupData.message || 'User Creation Failed');
                throw new Error(signupData.message || 'User Creation Failed');
            } else {
                // Join team(organization, company)
                const checkTeamExistResponse = await fetch(`${base_url}/team/exist/?team_name=origin-tech`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${signupData.access}`
                    }
                });
                const checkTeamExistData = await checkTeamExistResponse.json();

                console.log("checkTeamExistData:", checkTeamExistData)

                if (!checkTeamExistData.team_exists) {
                    const createTeamResponse = await fetch(`${base_url}/team/create/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${signupData.access}`
                        },
                        body: JSON.stringify({
                            team_name: "origin-tech",
                            owner_email: email
                        }),
                    });
                    const createTeamData = await createTeamResponse.json();
                }

                await sleep(500);

                const joinTeamResponse = await fetch(`${base_url}/team/join/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${signupData.access}`
                    },
                    body: JSON.stringify({
                        team_name: "origin-tech",
                        attendee_email: email
                    }),
                });
                const joinTeamData = await joinTeamResponse.json();
                if (!joinTeamResponse.ok) {
                    setErrorMessage(joinTeamData.message || 'User Creation Failed');
                    throw new Error(joinTeamData.message || 'User Creation Failed');
                } else {
                    // Send initial DM message to myself
                    // 1. Crete DM for myself
                    const createMyDMResponse = await fetch(`${base_url}/dm/create/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${signupData.access}`
                        },
                        body: JSON.stringify({ user_1_email: email, user_2_email: email }),
                    });

                    const createMyDMData: CreateMyDMResponse = await createMyDMResponse.json();
                    console.log("createMyDMData:", createMyDMData)

                    // 2. Send an initial message
                    const initMessageResponse = await fetch(`${base_url}/dm/addMessage/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${signupData.access}`
                        },
                        body: JSON.stringify({
                            dm_id: createMyDMData.dm_id,
                            sender_email: email,
                            receiver_email: email,
                            message_body: "I'm joined"
                        }),
                    });
                    const initMessageData = await initMessageResponse.json();
                    console.log("initMessageData:", initMessageData)
                }
            }

            navigate('/');

            return signupData

        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
            navigate('/SignUp');
            return { message: err_msg, user: null, access: null, refresh: null }
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
                                <BadgeRoundedIcon />
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
                                    const name = formElements.userName.value
                                    const email = formElements.email.value
                                    const password = formElements.password.value
                                    const confirm_password = formElements.confirm_password.value

                                    if (password !== confirm_password) {
                                        setErrorMessage('Failed to confirm your password.');
                                    } else {
                                        fetchData(name, email, password);
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
                                    <Button type="submit" fullWidth>
                                        Sign up
                                    </Button>
                                </Stack>
                            </form>
                        </Stack>
                        <Typography level="body-sm" textAlign={'right'}>
                            <Link href="SignIn" level="title-sm">
                                Back to Sign in
                            </Link>
                        </Typography>
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
