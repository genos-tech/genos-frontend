import React, { useEffect, useRef, useState } from "react";
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
    FormHelperText,
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

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { JoinTeamFormStyles } from "../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../context/authState";
import { useTeamSetupFields } from "../../../hooks/common/useTeamSetupFields";
import { wsJoinTeamHook } from "../../../hooks/common/useWebSocket";
import { useTranslation } from "../../../i18n";
import { clearPrivateProfile, ensurePrivateProfile } from "../../../services/privateProfileStore";
import { purplePalette } from "../../../theme/purplePalette";
import { g } from "../../../theme/tokens";
import { CreateTeamResponse, FindTeamResponse, Team } from "../../../types/admin";
import { takeWorkspaceReturn } from "../../../utils/pendingReturn";
import { sleepMilliSeconds } from "../../../utils/sleep";
import { createTeam } from "../services/createTeam";
import { findTeam } from "../services/findTeam";
import { joinTeam } from "../services/joinTeam";
import { loadMyTeams, membershipTeams } from "../services/loadMyTeams";
import type { TeamCreateFailure } from "../services/teamCreateFailure";
import { acceptInvite, previewInvite } from "../services/teamInvite";
import { LanguageSwitchButton } from "./LanguageSwitchButton";
import { TeamSetupFields } from "./TeamSetupFields";

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
    // Where a refused create-team belongs (MIP-1841): the team name, the departments, or the form.
    const [createFailure, setCreateFailure] = useState<TeamCreateFailure | null>(null);
    // The sample data (readiness plan §3.3, default ON) and the departments (MIP-1691): the
    // same two choices the in-app Create New Team modal makes (MIP-1709).
    const setup = useTeamSetupFields();
    const { withStarter, departments, problem } = setup;
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
            // No `userEmail`: it isn't stored any more (MIP-619). The server
            // only copied it into join-request mentions, which never render
            // it (MIP-732).
            query: {
                teamId: localStorage.getItem("teamId"),
                userId: localStorage.getItem("userId"),
                userName: localStorage.getItem("userName"),
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
                // A Settings link followed before sign-in lands on its tab (MIP-2323).
                navigate(takeWorkspaceReturn() ?? "/workspace");
            }
        }
    };

    const getApproveToJoinTeam = async (targetTeamDetails: Team) => {
        const userId: string | null = localStorage.getItem("userId");
        const userName: string | null = localStorage.getItem("userName");
        if (userId && userName && socketInstance !== null) {
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
            setCreateFailure(null);
            const createTeamRes: CreateTeamResponse = await createTeam(
                accessToken,
                teamName,
                userId,
                setCreateFailure,
                withStarter,
                departments
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

    // A refusal about the departments goes once they are edited (MIP-1841).
    useEffect(() => {
        setCreateFailure(null);
    }, [setup.departmentsText]);

    useEffect(() => {
        const userId: string | null = localStorage.getItem("userId");
        if (accessToken !== null && userId !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadMyTeams(accessToken, userId);
                setJoinedTeams(membershipTeams(loadedTeams));
            })();
        }
    }, [accessToken]);

    // Consume a pending email invite once we're authenticated. This is the
    // single funnel for ALL invite paths once a user has a token: a person
    // who signed in (password OR OAuth) or just signed up via an invite
    // link lands here, the stashed invite is redeemed, and they're routed
    // into the team. `inviteConsumedRef` guards against a double-accept if
    // the effect re-runs (re-render / StrictMode) before the async clear.
    const inviteConsumedRef = useRef(false);
    useEffect(() => {
        if (inviteConsumedRef.current) return;
        const token = localStorage.getItem("pendingInviteToken");
        if (!token || !accessToken) return;

        inviteConsumedRef.current = true;
        let cancelled = false;
        (async () => {
            // If the stashed invite is for a different email than the
            // signed-in user — e.g. a previous user on a shared device
            // abandoned an invite — it isn't ours to redeem. Clear it
            // silently: don't redeem or show a mismatch error to someone
            // who never requested an invite. (acceptInvite also enforces the
            // match server-side, so this can't wrongly add anyone either
            // way.) Both addresses are asked for rather than read from
            // storage, which no longer holds either (MIP-619); if either is
            // unknown, the server's check decides.
            //
            // No `cancelled` check before the accept: a token refresh re-runs
            // this effect, the ref above stops the re-run, so this run is
            // the only one that will redeem the invite.
            const [preview, profile] = await Promise.all([
                previewInvite(token),
                ensurePrivateProfile(accessToken),
            ]);
            const pendingEmail = preview.valid ? preview.invited_email.toLowerCase() : "";
            const myEmail = (profile?.userEmail ?? "").toLowerCase();
            if (pendingEmail && myEmail && pendingEmail !== myEmail) {
                localStorage.removeItem("pendingInviteToken");
                return;
            }

            const r = await acceptInvite(accessToken, token);
            if (cancelled) return;
            // Clear on every terminal outcome so a stale token can't leak
            // into a later, unrelated sign-in on this device.
            localStorage.removeItem("pendingInviteToken");
            if (r.ok && r.team_id) {
                localStorage.setItem("teamId", r.team_id);
                localStorage.setItem("teamName", r.team_name ?? "");
                navigate("/workspace");
            } else if (r.error === "email_mismatch") {
                setMoveToTeamErrorMessage(t.admin.acceptInvite.mismatchShort);
            }
            // else: silently fall through to the normal team picker.
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) {
            setSocketInstance(socket(accessToken));
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
                position: "relative",
            }}
        >
            <Box sx={{ position: "absolute", top: 0, right: 0 }}>
                <LanguageSwitchButton color={styles.subtitleColor} />
            </Box>
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
                            <AppTooltip key={team.teamId} title={team.teamEmail}>
                                <ListItemButton
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
                                                background: `linear-gradient(135deg, rgba(${styles.accentColorRgb}, 0.188) 0%, rgba(${styles.accentColorRgb}, 0.063) 100%)`,
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
                            </AppTooltip>
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
                            sx={{ mt: 2 }}
                            type="submit"
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
                            background: g.accent.solid,
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

                {createFailure?.field === "form" && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "12px",
                            border: `1px solid ${palette.dangerTintBorder}`,
                        }}
                    >
                        {createFailure.message}
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
                    <FormControl error={createFailure?.field === "teamName"} required>
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
                            onChange={() => {
                                if (createFailure?.field === "teamName") setCreateFailure(null);
                            }}
                        />
                        {createFailure?.field === "teamName" && (
                            <FormHelperText>{createFailure.message}</FormHelperText>
                        )}
                    </FormControl>
                    <TeamSetupFields
                        checkboxColor={styles.labelColor}
                        fields={setup}
                        hintColor={styles.subtitleColor}
                        departmentsError={
                            createFailure?.field === "departments" ? createFailure.message : null
                        }
                        labelSx={{
                            color: styles.labelColor,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            mb: 0.75,
                        }}
                        textareaSx={{
                            ...inputStyle,
                            "&:focus-within": {
                                borderColor: palette.inputFocusBorder,
                                boxShadow: palette.inputFocusShadow,
                            },
                        }}
                    />
                    <Button
                        disabled={problem !== null}
                        startDecorator={<AddCircleRoundedIcon />}
                        sx={{ mt: 2 }}
                        type="submit"
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
                        clearPrivateProfile();
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
