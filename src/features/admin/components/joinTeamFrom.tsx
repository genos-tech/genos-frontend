import React, { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CssBaseline,
    FormControl,
    FormLabel,
    GlobalStyles,
    Link,
    List,
    ListItemDecorator,
    ListItemButton,
    Input,
    Typography,
    Stack,
} from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { CssVarsProvider } from "@mui/joy/styles";
import AcUnitIcon from "@mui/icons-material/AcUnit";

import { AdminBackground } from "./Background";
import { AdminHeader } from "./Header";
import { createTeam } from "../services/createTeam";
import { joinTeam } from "../services/joinTeam";
import { loadAllTeams } from "../services/loadAllTeams";
import { createDMChat } from "../../chat/services/createDMChat";
import { sendDMMessage } from "../../chat/services/sendDMMessage";
import { sleepMilliSeconds } from "../../../utils/sleep";
import { useAuth } from "../../../context/AuthContext";
import { Team, CreateDMResponse, JoinTeamResponse } from "../../../types/admin";

interface FormElements extends HTMLFormControlsCollection {
    teamName: HTMLInputElement;
}
interface JoinTeamFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

export const JoinTeam = () => {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { accessToken } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);

    const moveToTeam = async (teamId: string, teamName: string) => {
        const userId: string | null = localStorage.getItem("userId");

        if (userId) {
            const joinTeamRes = await joinTeam(accessToken, teamId, userId, setErrorMessage);

            localStorage.setItem("teamId", teamId);
            localStorage.setItem("teamName", teamName);

            if (joinTeamRes) {
                const createDmRes: CreateDMResponse = await createDMChat(
                    accessToken,
                    teamId,
                    userId,
                    userId,
                    setErrorMessage
                );

                if (createDmRes && createDmRes.dm_exists === false) {
                    const initMessageBody = [
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: "Joined", styles: {} }],
                        },
                        { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
                    ];

                    await sendDMMessage(
                        accessToken,
                        createDmRes.dm_id,
                        createDmRes.user_1_id,
                        createDmRes.user_2_id,
                        initMessageBody,
                        setErrorMessage,
                        true
                    );

                    await sleepMilliSeconds(100);

                    navigate("/App");
                } else {
                    navigate("/App");
                }
            }
        }
    };

    const _createTeam = async (teamName: string) => {
        const userId: string | null = localStorage.getItem("userId");
        if (userId) {
            const createTeamRes: JoinTeamResponse = await createTeam(
                accessToken,
                teamName,
                userId,
                setErrorMessage
            );
            await sleepMilliSeconds(100);
            if (createTeamRes) {
                moveToTeam(createTeamRes.teamId, createTeamRes.teamName);
            } else {
                navigate("/JoinTeam");
            }
        } else {
            navigate("/JoinTeam");
        }
    };

    useEffect(() => {
        if (accessToken !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadAllTeams(accessToken);
                setTeams(loadedTeams);
            })();
        }
    }, [accessToken]);

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ":root": {
                        "--Form-maxWidth": "800px",
                        "--Transition-duration": "0.4s", // set to `none` to disable transition
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
                        {teams.length > 0 && (
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
                                <Typography component="h1" level="h3">
                                    Join Team
                                </Typography>

                                <List
                                    component="nav"
                                    sx={{
                                        maxHeight: 300,
                                        overflow: "auto",
                                    }}
                                >
                                    {teams.map((team) => (
                                        <ListItemButton
                                            key={team.teamId}
                                            title={team.teamEmail}
                                            onClick={() => {
                                                moveToTeam(team.teamId, team.teamName);
                                            }}
                                        >
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
                        )}

                        <Stack sx={{ gap: 4, mb: 2 }}>
                            <Stack sx={{ gap: 1 }}>
                                <Typography component="h1" level="h3">
                                    Create New Team
                                </Typography>
                            </Stack>
                            {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
                        </Stack>
                        <Stack sx={{ gap: 4 }}>
                            <form
                                onSubmit={(event: React.FormEvent<JoinTeamFormElement>) => {
                                    event.preventDefault(); // Needs for prevent reload page
                                    const formElements = event.currentTarget.elements;
                                    const teamName = formElements.teamName.value;
                                    _createTeam(teamName);
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

                        <Typography level="body-sm" textAlign={"right"}>
                            <Link href="SignIn" level="title-sm">
                                Back to Sign in
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
