import React, { useEffect, useState } from "react";
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
import BusinessIcon from '@mui/icons-material/Business';
import Link from '@mui/joy/Link';
import { useAuth } from "../admin/AuthContext";
import loadAllTeams from '../backendOperation/loadAllTeams';
import { Team } from '../../types';
import List from '@mui/joy/List';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import ListItemButton from '@mui/joy/ListItemButton';
import AcUnitIcon from '@mui/icons-material/AcUnit';

const base_url = import.meta.env.VITE_API_BASE_URL;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FormElements extends HTMLFormControlsCollection {
    teamName: HTMLInputElement;
}
interface CreateTeamFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

type CreateTeamResponse = {
    teamId: number;
    detail: string | null;
    hint: string | null;
};

type CreateMyDMResponse = {
    dm_id: string | null;
    ts_created_at: string | null;
    ts_updated_at: string | null;
    user_1_id: string | null;
    user_2_id: string | null;
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


export default function CreateTeam() {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { accessToken } = useAuth();

    const [teams, setTeams] = useState<Team[]>([]);
    useEffect(() => {
        if (accessToken !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadAllTeams({ accessToken: accessToken || "" });
                setTeams(loadedTeams)
            })();
        }
    }, [accessToken])

    async function moveToTeam(teamId: string) {
        try {
            const joinTeamResponse = await fetch(`${base_url}/team/join/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team_id: teamId,
                    attendee_id: localStorage.getItem("userId")
                }),
            });

            const joinTeamData = await joinTeamResponse.json();

            localStorage.setItem("teamId", joinTeamData.team);

            if (!joinTeamResponse.ok) {
                console.error("joinTeamData:", joinTeamData)
                throw new Error('Failed to join team');
            } else {
                // Send initial DM message to myself
                const myUserId = localStorage.getItem("userId")
                // 1. Crete DM for myself
                const createMyDMResponse = await fetch(`${base_url}/dm/create/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        user_1_id: myUserId
                        , user_2_id: myUserId
                    }),
                });

                const createMyDMData: CreateMyDMResponse = await createMyDMResponse.json();

                // 2. Send an initial message
                const initMessageResponse = await fetch(`${base_url}/dm/addMessage/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        dm_id: createMyDMData.dm_id,
                        sender_id: myUserId,
                        receiver_id: myUserId,
                        message_body: [{ type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] }, { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }],
                        is_init: true
                    }),
                });
                const initMessageData = await initMessageResponse.json();
            }

            navigate('/App')
        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
        }
    }

    async function createTeam(teamName: string): Promise<CreateTeamResponse> {
        try {
            const teamCreateResponse = await fetch(`${base_url}/team/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team_name: teamName,
                    team_email: `${teamName}@origin.tech`,
                    owner_id: localStorage.getItem("userId")
                }),
            });

            await sleep(100);

            const teamCreateData: CreateTeamResponse = await teamCreateResponse.json();

            if (!teamCreateResponse.ok) {
                setErrorMessage(teamCreateData.hint || teamCreateData.detail || 'Team Creation Failed');
                throw new Error(teamCreateData.hint || teamCreateData.detail || 'Team Creation Failed');
            } else {

                const joinTeamResponse = await fetch(`${base_url}/team/join/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        team_id: teamCreateData.teamId,
                        attendee_id: localStorage.getItem("userId")
                    }),
                });

                const joinTeamData = await joinTeamResponse.json();
                localStorage.setItem("teamId", joinTeamData.team);

                if (!joinTeamResponse.ok) {
                    setErrorMessage('Failed to join team');
                    throw new Error('Failed to join team');
                } else {
                    // Send initial DM message to myself
                    const myUserId = localStorage.getItem("userId")
                    // 1. Crete DM for myself
                    const createMyDMResponse = await fetch(`${base_url}/dm/create/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                            user_1_id: myUserId,
                            user_2_id: myUserId
                        }),
                    });

                    const createMyDMData: CreateMyDMResponse = await createMyDMResponse.json();

                    // 2. Send an initial message
                    const initMessageResponse = await fetch(`${base_url}/dm/addMessage/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                            dm_id: createMyDMData.dm_id,
                            sender_id: myUserId,
                            receiver_id: myUserId,
                            message_body: [{ type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] }, { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }],
                        }),
                    });
                    const initMessageData = await initMessageResponse.json();
                }
            }

            navigate('/App')

            return teamCreateData

        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
            navigate('/CreateTeam');
            return { teamId: -1, detail: null, hint: null }
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
                            <Typography component="h1" level="h3">
                                Join Team
                            </Typography>
                            <List component="nav"
                                sx={{
                                    maxHeight: 300,
                                    overflow: 'auto',
                                }}
                            >
                                {teams.map((team) => (
                                    <ListItemButton key={team.teamId} title={team.teamEmail} onClick={() => {
                                        moveToTeam(team.teamId);
                                    }}>
                                        <ListItemDecorator>
                                            <AcUnitIcon />
                                        </ListItemDecorator>
                                        <Typography component="h1" level="h4">
                                            {team.teamName}
                                        </Typography>
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>

                        <Stack sx={{ gap: 4, mb: 2 }}>
                            <Stack sx={{ gap: 1 }}>
                                <Typography component="h1" level="h3">
                                    Create New Team
                                </Typography>
                            </Stack>
                            {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
                        </Stack>

                        <Stack sx={{ gap: 4, mt: 2 }}>
                            <form
                                onSubmit={(event: React.FormEvent<CreateTeamFormElement>) => {
                                    event.preventDefault(); // Needs for prevent reload page
                                    const formElements = event.currentTarget.elements;
                                    const teamName = formElements.teamName.value
                                    createTeam(teamName);
                                }}
                            >
                                <FormControl required>
                                    <FormLabel>Team Name</FormLabel>
                                    <Input type="name" name="teamName" />
                                </FormControl>
                                <Stack sx={{ gap: 4, mt: 2 }}>
                                    <Button type="submit" fullWidth>
                                        Create
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
