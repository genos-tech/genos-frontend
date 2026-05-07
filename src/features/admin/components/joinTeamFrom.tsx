import React, { useEffect, useState } from "react";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
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
    List,
    ListItemButton,
    ListItemDecorator,
    Stack,
    Typography,
} from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";

import { useAuth } from "../../../context/AuthContext";
import { wsJoinTeamHook } from "../../../hooks/common/useWebSocket";
import {
    CreateDMResponse,
    CreateTeamResponse,
    FindTeamResponse,
    Team,
} from "../../../types/admin";
import { sleepMilliSeconds } from "../../../utils/sleep";
import { createDMChat } from "../../chat/services/createDMChat";
import { sendDMMessage } from "../../chat/services/sendDMMessage";
import { createTeam } from "../services/createTeam";
import { findTeam } from "../services/findTeam";
import { joinTeam } from "../services/joinTeam";
import { loadMyTeams } from "../services/loadMyTeams";
import { AdminHeader } from "./Header";

// Theme-aware styling - Blue/Cyan theme for team management
const FORM_STYLES = {
    dark: {
        cardBg: "linear-gradient(145deg, rgba(30,32,44,0.95) 0%, rgba(20,22,34,0.98) 100%)",
        cardBorder: "rgba(56,189,248,0.2)",
        cardShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(56,189,248,0.1)",
        inputBg: "rgba(0,0,0,0.3)",
        inputBorder: "rgba(56,189,248,0.2)",
        inputFocusBorder: "#38bdf8",
        inputFocusShadow: "0 0 0 3px rgba(56,189,248,0.2)",
        labelColor: "rgba(148,163,184,0.9)",
        titleGradient: "linear-gradient(90deg, #38bdf8 0%, #22d3ee 50%, #06b6d4 100%)",
        sectionTitleColor: "#38bdf8",
        buttonBg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
        buttonHover: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
        buttonShadow: "0 4px 16px rgba(56,189,248,0.4)",
        secondaryButtonBg: "rgba(56,189,248,0.1)",
        secondaryButtonBorder: "rgba(56,189,248,0.3)",
        secondaryButtonHover: "rgba(56,189,248,0.2)",
        linkColor: "#38bdf8",
        linkHover: "#22d3ee",
        accentColor: "#38bdf8",
        textColor: "#f1f5f9",
        subtitleColor: "#94a3b8",
        listItemBg: "rgba(56,189,248,0.05)",
        listItemBorder: "rgba(56,189,248,0.1)",
        listItemHover: "rgba(56,189,248,0.15)",
        successBg: "rgba(34,197,94,0.1)",
        successBorder: "rgba(34,197,94,0.3)",
        successText: "#4ade80",
    },
    light: {
        cardBg: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        cardBorder: "rgba(14,165,233,0.15)",
        cardShadow: "0 8px 32px rgba(56,189,248,0.1), 0 0 60px rgba(56,189,248,0.05)",
        inputBg: "rgba(255,255,255,0.9)",
        inputBorder: "rgba(14,165,233,0.2)",
        inputFocusBorder: "#0284c7",
        inputFocusShadow: "0 0 0 3px rgba(56,189,248,0.1)",
        labelColor: "rgba(71,85,105,0.9)",
        titleGradient: "linear-gradient(90deg, #0284c7 0%, #0891b2 50%, #0e7490 100%)",
        sectionTitleColor: "#0284c7",
        buttonBg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
        buttonHover: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
        buttonShadow: "0 4px 16px rgba(56,189,248,0.3)",
        secondaryButtonBg: "rgba(14,165,233,0.05)",
        secondaryButtonBorder: "rgba(14,165,233,0.2)",
        secondaryButtonHover: "rgba(14,165,233,0.1)",
        linkColor: "#0284c7",
        linkHover: "#0891b2",
        accentColor: "#0284c7",
        textColor: "#1e293b",
        subtitleColor: "#64748b",
        listItemBg: "rgba(14,165,233,0.03)",
        listItemBorder: "rgba(14,165,233,0.08)",
        listItemHover: "rgba(14,165,233,0.08)",
        successBg: "rgba(34,197,94,0.05)",
        successBorder: "rgba(34,197,94,0.2)",
        successText: "#16a34a",
    },
};

interface FindTeamFormElements extends HTMLFormControlsCollection {
    teamId: HTMLInputElement;
}
interface FindTeamFormElement extends HTMLFormElement {
    readonly elements: FindTeamFormElements;
}

interface JoinTeamFormElements extends HTMLFormControlsCollection {
    teamName: HTMLInputElement;
}
interface JoinTeamFormElement extends HTMLFormElement {
    readonly elements: JoinTeamFormElements;
}

const base_url = import.meta.env.VITE_API_BASE_URL;

const JoinTeamContent = () => {
    const navigate = useNavigate();
    const [searchTeamMessage, setSearchMessage] = useState<string | null>(null);
    const [moveToTeamErrorMessage, setMoveToTeamErrorMessage] = useState<string | null>(null);
    const [searchTeamErrorMessage, setSearchTeamErrorMessage] = useState<string | null>(null);
    const [createTeamErrorMessage, setCreateTeamErrorMessage] = useState<string | null>(null);
    const { accessToken, setAccessToken } = useAuth();
    const [joinedTeams, setJoinedTeams] = useState<Team[]>([]);
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? FORM_STYLES.dark : FORM_STYLES.light;

    const ws_url = import.meta.env.VITE_WS_BASE_URL;
    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
    const socket = (accessToken: string | null): Socket => {
        return io(ws_url, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            withCredentials: true,
            query: {
                teamId: localStorage.getItem("teamId"),
                userId: localStorage.getItem("userId"),
                userName: localStorage.getItem("userName"),
                userEmail: localStorage.getItem("userEmail"),
            },
            extraHeaders: {
                Authorization: accessToken || "",
            },
        });
    };

    const moveToTeam = async (teamId: string, teamName: string) => {
        const userId: string | null = localStorage.getItem("userId");

        if (userId) {
            const joinTeamRes = await joinTeam(
                accessToken,
                teamId,
                userId,
                setMoveToTeamErrorMessage
            );

            localStorage.setItem("teamId", teamId);
            localStorage.setItem("teamName", teamName);

            if (joinTeamRes) {
                const createDmRes: CreateDMResponse = await createDMChat(
                    accessToken,
                    teamId,
                    userId,
                    userId,
                    setMoveToTeamErrorMessage
                );

                if (createDmRes && createDmRes.dm_exists === false) {
                    const initMessageBody = [
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: "Has joined", styles: {} }],
                        },
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: "", styles: {} }],
                        },
                    ];

                    await sendDMMessage(
                        accessToken,
                        createDmRes.dm_id,
                        createDmRes.user_1_id,
                        createDmRes.user_2_id,
                        initMessageBody,
                        setMoveToTeamErrorMessage,
                        true
                    );

                    await sleepMilliSeconds(100);

                    navigate("/home");
                } else {
                    navigate("/home");
                }
            }
        }
    };

    const getApproveToJoinTeam = async (targetTeamDetails: Team) => {
        const userId: string | null = localStorage.getItem("userId");
        const userName: string | null = localStorage.getItem("userName");
        const userEmail: string | null = localStorage.getItem("userEmail");
        if (userId && userName && userEmail && socketInstance !== null) {
            socketInstance.emit("join_team_request", {
                joiningTeamId: targetTeamDetails.teamId,
                joiningTeamName: targetTeamDetails.teamName,
            });
            setSearchMessage("Has sent a request to join the team!");
            setFoundTeamDetails(undefined);
        } else {
            console.error("userId is not found in your localStorage");
        }
    };

    const _createTeam = async (teamName: string) => {
        const userId: string | null = localStorage.getItem("userId");
        if (userId) {
            const createTeamRes: CreateTeamResponse = await createTeam(
                accessToken,
                teamName,
                userId,
                setCreateTeamErrorMessage
            );
            await sleepMilliSeconds(100);
            if (createTeamRes) {
                moveToTeam(createTeamRes.teamDetails.teamId, createTeamRes.teamDetails.teamName);
            } else {
                navigate("/jointeam");
            }
        } else {
            navigate("/jointeam");
        }
    };

    const [foundTeamDetails, setFoundTeamDetails] = useState<Team>();
    const getTeamInfo = async (teamId: string) => {
        const findTeamRes: FindTeamResponse = await findTeam(
            accessToken,
            teamId,
            setSearchTeamErrorMessage
        );
        if (findTeamRes.exist === true) {
            if (joinedTeams.some((team) => team.teamId === findTeamRes.teamDetails.teamId)) {
                setSearchTeamErrorMessage("Already joined");
            } else {
                setFoundTeamDetails(findTeamRes.teamDetails);
            }
        } else {
            setFoundTeamDetails(undefined);
        }
    };

    useEffect(() => {
        const userId: string | null = localStorage.getItem("userId");
        if (accessToken !== null && userId !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadMyTeams(accessToken, userId);
                setJoinedTeams(loadedTeams);
            })();
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) {
            setSocketInstance(socket(accessToken));
            console.log("WS connected");
        }
    }, [accessToken]);

    wsJoinTeamHook({
        socket: socketInstance,
        accessToken: accessToken,
    });

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
                        gap: 3,
                        width: { xs: "100%", md: 480 },
                        maxWidth: "100%",
                        mx: "auto",
                    }}
                >
                    {/* Main Title */}
                    <Typography
                        component="h1"
                        level="h2"
                        textAlign="center"
                        sx={{
                            background: styles.titleGradient,
                            backgroundClip: "text",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Team Management
                    </Typography>

                    {/* Your Teams Section */}
                    {joinedTeams.length > 0 && (
                        <Box
                            sx={{
                                background: styles.cardBg,
                                border: `1px solid ${styles.cardBorder}`,
                                borderRadius: "20px",
                                boxShadow: styles.cardShadow,
                                p: 3,
                                backdropFilter: "blur(12px)",
                            }}
                        >
                            {moveToTeamErrorMessage && (
                                <Alert
                                    color="danger"
                                    sx={{
                                        mb: 2,
                                        borderRadius: "12px",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                    }}
                                >
                                    {moveToTeamErrorMessage}
                                </Alert>
                            )}
                            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "10px",
                                        background: `linear-gradient(135deg, ${styles.accentColor} 0%, ${isDark ? "#22d3ee" : "#0891b2"} 100%)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <GroupsRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
                                </Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        color: styles.sectionTitleColor,
                                        fontWeight: 600,
                                    }}
                                >
                                    Your Teams
                                </Typography>
                            </Stack>

                            <List
                                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                sx={{
                                    maxHeight: 250,
                                    overflow: "auto",
                                    gap: 1,
                                    px: 1,
                                    "--List-gap": "8px",
                                }}
                            >
                                {joinedTeams.map((team) => (
                                    <ListItemButton
                                        key={team.teamId}
                                        title={team.teamEmail}
                                        onClick={() => {
                                            moveToTeam(team.teamId, team.teamName);
                                        }}
                                        sx={{
                                            background: styles.listItemBg,
                                            border: `1px solid ${styles.listItemBorder}`,
                                            borderRadius: "12px",
                                            py: 1.5,
                                            px: 2,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: styles.listItemHover,
                                                borderColor: styles.accentColor,
                                                transform: "translateX(4px)",
                                            },
                                        }}
                                    >
                                        <ListItemDecorator>
                                            <Box
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "8px",
                                                    background: `linear-gradient(135deg, ${styles.accentColor}30 0%, ${styles.accentColor}10 100%)`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    mr: 1,
                                                }}
                                            >
                                                <GroupsRoundedIcon
                                                    sx={{
                                                        color: styles.accentColor,
                                                        fontSize: 18,
                                                    }}
                                                />
                                            </Box>
                                        </ListItemDecorator>
                                        <Typography level="title-md" sx={{ fontWeight: 500 }}>
                                            {team.teamName}
                                        </Typography>
                                        <LoginRoundedIcon
                                            sx={{
                                                ml: "auto",
                                                color: styles.subtitleColor,
                                                fontSize: 18,
                                            }}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                    )}

                    {/* Found Team Section */}
                    {foundTeamDetails !== undefined && (
                        <Box
                            sx={{
                                background: styles.cardBg,
                                border: `1px solid ${styles.successBorder}`,
                                borderRadius: "20px",
                                boxShadow: styles.cardShadow,
                                p: 3,
                                backdropFilter: "blur(12px)",
                            }}
                        >
                            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "10px",
                                        background:
                                            "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <GroupsRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
                                </Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        color: styles.successText,
                                        fontWeight: 600,
                                    }}
                                >
                                    Team Found!
                                </Typography>
                            </Stack>

                            {moveToTeamErrorMessage && (
                                <Alert
                                    color="danger"
                                    sx={{
                                        mb: 2,
                                        borderRadius: "12px",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                    }}
                                >
                                    {moveToTeamErrorMessage}
                                </Alert>
                            )}

                            <Box
                                sx={{
                                    background: styles.successBg,
                                    border: `1px solid ${styles.successBorder}`,
                                    borderRadius: "12px",
                                    p: 2,
                                    mb: 2,
                                }}
                            >
                                <Typography level="title-md" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    {foundTeamDetails.teamName}
                                </Typography>
                                <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                    {foundTeamDetails.teamEmail}
                                </Typography>
                            </Box>

                            <Stack direction="row" gap={2} justifyContent="center">
                                <Button
                                    variant="outlined"
                                    startDecorator={<ArrowBackRoundedIcon />}
                                    onClick={() => setFoundTeamDetails(undefined)}
                                    sx={{
                                        borderRadius: "10px",
                                        borderColor: styles.secondaryButtonBorder,
                                        background: styles.secondaryButtonBg,
                                        "&:hover": {
                                            background: styles.secondaryButtonHover,
                                            borderColor: styles.accentColor,
                                        },
                                    }}
                                >
                                    Search Another
                                </Button>
                                <Button
                                    startDecorator={<SendRoundedIcon />}
                                    onClick={() => getApproveToJoinTeam(foundTeamDetails)}
                                    sx={{
                                        background:
                                            "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                        borderRadius: "10px",
                                        boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
                                            transform: "translateY(-1px)",
                                        },
                                    }}
                                >
                                    Request to Join
                                </Button>
                            </Stack>
                        </Box>
                    )}

                    {/* Search Team Section */}
                    {foundTeamDetails === undefined && (
                        <Box
                            sx={{
                                background: styles.cardBg,
                                border: `1px solid ${styles.cardBorder}`,
                                borderRadius: "20px",
                                boxShadow: styles.cardShadow,
                                p: 3,
                                backdropFilter: "blur(12px)",
                            }}
                        >
                            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "10px",
                                        background: `linear-gradient(135deg, ${styles.accentColor} 0%, ${isDark ? "#22d3ee" : "#0891b2"} 100%)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <SearchRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
                                </Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        color: styles.sectionTitleColor,
                                        fontWeight: 600,
                                    }}
                                >
                                    Search by Team ID
                                </Typography>
                            </Stack>

                            {searchTeamMessage && (
                                <Alert
                                    color="success"
                                    sx={{
                                        mb: 2,
                                        borderRadius: "12px",
                                        background: styles.successBg,
                                        border: `1px solid ${styles.successBorder}`,
                                    }}
                                >
                                    {searchTeamMessage}
                                </Alert>
                            )}
                            {searchTeamErrorMessage && (
                                <Alert
                                    color="danger"
                                    sx={{
                                        mb: 2,
                                        borderRadius: "12px",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                    }}
                                >
                                    {searchTeamErrorMessage}
                                </Alert>
                            )}

                            <form
                                onSubmit={(event: React.FormEvent<FindTeamFormElement>) => {
                                    event.preventDefault();
                                    const formElements = event.currentTarget.elements;
                                    const teamId = formElements.teamId.value;
                                    getTeamInfo(teamId);
                                }}
                            >
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
                                        Team ID
                                    </FormLabel>
                                    <Input
                                        name="teamId"
                                        type="text"
                                        placeholder="Enter team ID to search"
                                        startDecorator={
                                            <SearchRoundedIcon
                                                sx={{ color: styles.accentColor, fontSize: 20 }}
                                            />
                                        }
                                        sx={inputStyle}
                                    />
                                </FormControl>
                                <Button
                                    type="submit"
                                    fullWidth
                                    startDecorator={<SearchRoundedIcon />}
                                    sx={{
                                        mt: 2,
                                        py: 1.25,
                                        background: styles.buttonBg,
                                        borderRadius: "12px",
                                        fontWeight: 600,
                                        boxShadow: styles.buttonShadow,
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-2px)",
                                        },
                                    }}
                                >
                                    Search Team
                                </Button>
                            </form>
                        </Box>
                    )}

                    {/* Create Team Section */}
                    <Box
                        sx={{
                            background: styles.cardBg,
                            border: `1px solid ${styles.cardBorder}`,
                            borderRadius: "20px",
                            boxShadow: styles.cardShadow,
                            p: 3,
                            backdropFilter: "blur(12px)",
                        }}
                    >
                        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "10px",
                                    background:
                                        "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <AddCircleRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
                            </Box>
                            <Typography
                                level="title-lg"
                                sx={{
                                    color: isDark ? "#a855f7" : "#7c3aed",
                                    fontWeight: 600,
                                }}
                            >
                                Create New Team
                            </Typography>
                        </Stack>

                        {createTeamErrorMessage && (
                            <Alert
                                color="danger"
                                sx={{
                                    mb: 2,
                                    borderRadius: "12px",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                }}
                            >
                                {createTeamErrorMessage}
                            </Alert>
                        )}

                        <form
                            onSubmit={(event: React.FormEvent<JoinTeamFormElement>) => {
                                event.preventDefault();
                                const formElements = event.currentTarget.elements;
                                const teamName = formElements.teamName.value;
                                _createTeam(teamName);
                            }}
                        >
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
                                    Team Name
                                </FormLabel>
                                <Input
                                    name="teamName"
                                    type="text"
                                    placeholder="Enter your team name"
                                    startDecorator={
                                        <GroupsRoundedIcon
                                            sx={{
                                                color: isDark ? "#a855f7" : "#7c3aed",
                                                fontSize: 20,
                                            }}
                                        />
                                    }
                                    sx={{
                                        ...inputStyle,
                                        "&:focus-within": {
                                            borderColor: isDark ? "#a855f7" : "#7c3aed",
                                            boxShadow: "0 0 0 3px rgba(168,85,247,0.2)",
                                        },
                                    }}
                                />
                            </FormControl>
                            <Button
                                type="submit"
                                fullWidth
                                startDecorator={<AddCircleRoundedIcon />}
                                sx={{
                                    mt: 2,
                                    py: 1.25,
                                    background:
                                        "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    boxShadow: "0 4px 16px rgba(168,85,247,0.4)",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background:
                                            "linear-gradient(135deg, #c084fc 0%, #a855f7 100%)",
                                        transform: "translateY(-2px)",
                                    },
                                }}
                            >
                                Create Team
                            </Button>
                        </form>
                    </Box>

                    {/* Sign Out */}
                    <Typography
                        level="body-sm"
                        textAlign="center"
                        sx={{ color: styles.subtitleColor }}
                    >
                        <Link
                            component="button"
                            type="button"
                            level="title-sm"
                            sx={{
                                color: styles.linkColor,
                                fontWeight: 600,
                                transition: "all 0.2s ease",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                "&:hover": {
                                    color: styles.linkHover,
                                },
                            }}
                            onClick={async () => {
                                try {
                                    await fetch(`${base_url}/user/signout/`, {
                                        method: "POST",
                                        credentials: "include",
                                    });
                                } catch (error) {
                                    console.error("Error signing out:", error);
                                }
                                localStorage.setItem("isSigningIn", "");
                                setAccessToken(null);
                                navigate("/signin");
                            }}
                        >
                            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
                            Sign Out
                        </Link>
                    </Typography>
                </Box>

                <Box component="footer" sx={{ py: 3 }}>
                    <Typography
                        level="body-xs"
                        sx={{ textAlign: "center", color: styles.subtitleColor }}
                    >
                        © Genos {new Date().getFullYear()}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export const JoinTeam = () => {
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
            <JoinTeamContent />
        </CssVarsProvider>
    );
};
