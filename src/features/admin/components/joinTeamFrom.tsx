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
    FormControl,
    FormLabel,
    Input,
    Link,
    List,
    ListItemButton,
    ListItemDecorator,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";

import { JoinTeamFormStyles } from "../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../context/AuthContext";
import { wsJoinTeamHook } from "../../../hooks/common/useWebSocket";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { CreateTeamResponse, FindTeamResponse, Team } from "../../../types/admin";
import { sleepMilliSeconds } from "../../../utils/sleep";
import { createTeam } from "../services/createTeam";
import { findTeam } from "../services/findTeam";
import { joinTeam } from "../services/joinTeam";
import { loadMyTeams } from "../services/loadMyTeams";

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

export const JoinTeam = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchTeamMessage, setSearchMessage] = useState<string | null>(null);
    const [moveToTeamErrorMessage, setMoveToTeamErrorMessage] = useState<string | null>(null);
    const [searchTeamErrorMessage, setSearchTeamErrorMessage] = useState<string | null>(null);
    const [createTeamErrorMessage, setCreateTeamErrorMessage] = useState<string | null>(null);
    const { accessToken, setAccessToken } = useAuth();
    const [joinedTeams, setJoinedTeams] = useState<Team[]>([]);
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? JoinTeamFormStyles.dark : JoinTeamFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

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
                navigate("/workspace");
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
            setSearchMessage(t.admin.joinTeam.joinRequestSent);
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
                setSearchTeamErrorMessage(t.admin.joinTeam.alreadyJoined);
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
                {t.admin.joinTeam.title}
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
                                border: `1px solid ${palette.dangerTintBorder}`,
                            }}
                        >
                            {moveToTeamErrorMessage}
                        </Alert>
                    )}
                    <Stack alignItems="center" direction="row" gap={1.5} sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "10px",
                                background: `linear-gradient(135deg, ${styles.accentColor} 0%, ${palette.accentStrong} 100%)`,
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
                            {t.admin.joinTeam.yourTeams}
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
                                onClick={() => {
                                    moveToTeam(team.teamId, team.teamName);
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
                    <Stack alignItems="center" direction="row" gap={1.5} sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "10px",
                                background: `linear-gradient(135deg, ${palette.successTint} 0%, ${palette.accentStrong} 100%)`,
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
                            {t.admin.joinTeam.teamFound}
                        </Typography>
                    </Stack>

                    {moveToTeamErrorMessage && (
                        <Alert
                            color="danger"
                            sx={{
                                mb: 2,
                                borderRadius: "12px",
                                border: `1px solid ${palette.dangerTintBorder}`,
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
                            startDecorator={<ArrowBackRoundedIcon />}
                            variant="outlined"
                            sx={{
                                borderRadius: "10px",
                                borderColor: styles.secondaryButtonBorder,
                                background: styles.secondaryButtonBg,
                                "&:hover": {
                                    background: styles.secondaryButtonHover,
                                    borderColor: styles.accentColor,
                                },
                            }}
                            onClick={() => setFoundTeamDetails(undefined)}
                        >
                            {t.admin.joinTeam.searchAnother}
                        </Button>
                        <Button
                            startDecorator={<SendRoundedIcon />}
                            sx={{
                                background: palette.primaryButtonBg,
                                borderRadius: "10px",
                                boxShadow: palette.primaryButtonShadow,
                                "&:hover": {
                                    background: palette.primaryButtonHover,
                                    transform: "translateY(-1px)",
                                },
                            }}
                            onClick={() => getApproveToJoinTeam(foundTeamDetails)}
                        >
                            {t.admin.joinTeam.requestToJoin}
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
                    <Stack alignItems="center" direction="row" gap={1.5} sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "10px",
                                background: `linear-gradient(135deg, ${styles.accentColor} 0%, ${palette.accentStrong} 100%)`,
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
                            {t.admin.joinTeam.searchByTeamId}
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
                                border: `1px solid ${palette.dangerTintBorder}`,
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
                                {t.admin.joinTeam.teamIdLabel}
                            </FormLabel>
                            <Input
                                name="teamId"
                                placeholder={t.admin.joinTeam.teamIdPlaceholder}
                                sx={inputStyle}
                                type="text"
                                startDecorator={
                                    <SearchRoundedIcon
                                        sx={{ color: styles.accentColor, fontSize: 20 }}
                                    />
                                }
                            />
                        </FormControl>
                        <Button
                            startDecorator={<SearchRoundedIcon />}
                            type="submit"
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
                            fullWidth
                        >
                            {t.admin.joinTeam.searchTeam}
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
                <Stack alignItems="center" direction="row" gap={1.5} sx={{ mb: 2 }}>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            background: palette.primaryButtonBg,
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
                            color: styles.accentColor,
                            fontWeight: 600,
                        }}
                    >
                        {t.admin.joinTeam.createNewTeam}
                    </Typography>
                </Stack>

                {createTeamErrorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "12px",
                            border: `1px solid ${palette.dangerTintBorder}`,
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
                            {t.admin.joinTeam.teamNameLabel}
                        </FormLabel>
                        <Input
                            name="teamName"
                            placeholder={t.admin.joinTeam.teamNamePlaceholder}
                            type="text"
                            startDecorator={
                                <GroupsRoundedIcon
                                    sx={{
                                        color: styles.accentColor,
                                        fontSize: 20,
                                    }}
                                />
                            }
                            sx={{
                                ...inputStyle,
                                "&:focus-within": {
                                    borderColor: palette.inputFocusBorder,
                                    boxShadow: palette.inputFocusShadow,
                                },
                            }}
                        />
                    </FormControl>
                    <Button
                        startDecorator={<AddCircleRoundedIcon />}
                        type="submit"
                        sx={{
                            mt: 2,
                            py: 1.25,
                            background: palette.primaryButtonBg,
                            borderRadius: "12px",
                            fontWeight: 600,
                            boxShadow: palette.primaryButtonShadow,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                background: palette.primaryButtonHover,
                                transform: "translateY(-2px)",
                            },
                        }}
                        fullWidth
                    >
                        {t.admin.joinTeam.createTeam}
                    </Button>
                </form>
            </Box>

            {/* Sign Out */}
            <Typography level="body-sm" sx={{ color: styles.subtitleColor }} textAlign="center">
                <Link
                    component="button"
                    level="title-sm"
                    type="button"
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
                    {t.admin.joinTeam.signOut}
                </Link>
            </Typography>
        </Box>
    );
};
