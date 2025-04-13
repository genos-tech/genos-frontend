import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { CssVarsProvider, useColorScheme } from '@mui/joy/styles';
import GlobalStyles from '@mui/joy/GlobalStyles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import IconButton, { IconButtonProps } from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import BusinessIcon from '@mui/icons-material/Business';
import { useAuth } from "../admin/AuthContext";
import List from '@mui/joy/List';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import ListItemButton from '@mui/joy/ListItemButton';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import loadAllTeams from '../backendOperation/loadAllTeams';
import { Team } from '../../types';

const base_url = import.meta.env.VITE_API_BASE_URL;

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

export default function SelectTeam() {
    const navigate = useNavigate();
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
                        message_body: "Joined",
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
                                <ListItemButton key={team.team_id} title={team.team_email} onClick={() => {
                                    moveToTeam(team.team_id);
                                }}>
                                    <ListItemDecorator>
                                        <AcUnitIcon />
                                    </ListItemDecorator>
                                    <Typography component="h1" level="h4">
                                        {team.team_name}
                                    </Typography>
                                </ListItemButton>
                            ))}
                        </List>
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
