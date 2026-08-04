import { ReactNode, useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Box,
    Button,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    Modal,
    ModalClose,
    ModalDialog,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { switchTeam } from "../../features/admin/services/switchTeam";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useSignOut } from "../../hooks/common/useSignOut";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";
import { Team, UserProps } from "../../types/admin";
import { UserAvatar } from "../ui/avatars/UserAvatar";
import { SettingsModal } from "./SettingsModal";

type MobileAccountSheetProps = {
    open: boolean;
    onClose: () => void;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
};

const RowButton = ({
    icon,
    label,
    detail,
    danger,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    detail?: string;
    danger?: boolean;
    onClick: () => void;
}) => (
    <Button
        color={danger ? "danger" : "neutral"}
        size="lg"
        startDecorator={icon}
        variant="plain"
        endDecorator={
            detail ? (
                <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                    {detail}
                </Typography>
            ) : undefined
        }
        sx={{
            justifyContent: "flex-start",
            fontWeight: 500,
            // 48px is the comfortable one-handed tap target; the desktop
            // sidebar's 32px icon buttons are too small for touch.
            minHeight: 48,
            "& .MuiButton-endDecorator": { marginInlineStart: "auto" },
        }}
        onClick={onClick}
    >
        {label}
    </Button>
);

/**
 * Account surface for mobile.
 *
 * Everything in here lives only in the desktop sidebar, which renders
 * `null` below 900px — so before this existed a phone user had no way to
 * reach settings, notification preferences, the theme toggle, their team
 * list, or sign-out. Opened from the BottomTabBar's Account tab.
 */
export const MobileAccountSheet = (props: MobileAccountSheetProps) => {
    const { open, onClose, myself, setMyself, socket, useCM, useTEM, useUISM } = props;
    const { accessToken } = useAuth();
    const { mode, setMode } = useColorScheme();
    const { t } = useTranslation();
    const signOut = useSignOut();
    const isMobile = useIsMobile();

    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsOpen, setTeamsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // SettingsModal fires listConnections/listCalendars from mount effects
    // that don't check `open`, so mounting it eagerly would cost every
    // session those requests even if Settings is never opened. Mount on
    // first open, then keep it mounted so closing still animates.
    const [settingsMounted, setSettingsMounted] = useState(false);
    const [signOutOpen, setSignOutOpen] = useState(false);
    const [signOutBusy, setSignOutBusy] = useState(false);

    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    // Load the team list lazily — only once the sheet is actually opened,
    // so the tab bar's presence doesn't cost a request on every session.
    useEffect(() => {
        if (!open || !accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                const loaded: Team[] = await loadMyTeams(accessToken, myself.userId);
                if (!cancelled) setTeams(loaded);
            } catch {
                // Non-fatal: the team row just shows the current team only.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, accessToken, myself.userId]);

    const handleSwitchTeam = (team: Team) => {
        switchTeam({
            accessToken,
            myself,
            setMyself,
            teamId: team.teamId,
            teamName: team.teamName,
            isGuest: team.isGuest,
        });
        setTeamsOpen(false);
        onClose();
    };

    // Desktop reaches all of this through the sidebar, which owns its own
    // SettingsModal — bailing here keeps that from being mounted twice.
    if (!isMobile) return null;

    return (
        <>
            <Drawer
                anchor="bottom"
                open={open}
                slotProps={{
                    content: {
                        sx: {
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            height: "auto",
                            // Clear the home-indicator strip on iPhones.
                            pb: "env(safe-area-inset-bottom, 0px)",
                        },
                    },
                }}
                onClose={onClose}
            >
                <Box sx={{ p: 2 }}>
                    <Stack alignItems="center" direction="row" spacing={1.5} sx={{ mb: 1 }}>
                        <UserAvatar showNameAndEmail size={44} userId={myself.userId} />
                        <ModalClose sx={{ position: "static", ml: "auto" }} />
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    <Stack spacing={0.5}>
                        <RowButton
                            detail={myself.teamName}
                            icon={<GroupsRoundedIcon />}
                            label={t.layout.mobileAccount.switchTeam}
                            onClick={() => setTeamsOpen(true)}
                        />
                        <RowButton
                            icon={isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                            onClick={() => setMode(isDark ? "light" : "dark")}
                            label={
                                isDark
                                    ? t.layout.mobileAccount.lightMode
                                    : t.layout.mobileAccount.darkMode
                            }
                        />
                        <RowButton
                            icon={<SettingsRoundedIcon />}
                            label={t.layout.mobileAccount.settings}
                            onClick={() => {
                                setSettingsMounted(true);
                                setSettingsOpen(true);
                            }}
                        />
                        <Divider sx={{ my: 0.5 }} />
                        <RowButton
                            danger
                            icon={<LogoutRoundedIcon />}
                            label={t.layout.mobileAccount.signOut}
                            onClick={() => setSignOutOpen(true)}
                        />
                    </Stack>
                </Box>
            </Drawer>

            {/* Team picker — a second sheet rather than an inline expander so
                a long team list can't push sign-out off-screen. */}
            <Drawer
                anchor="bottom"
                open={teamsOpen}
                slotProps={{
                    content: {
                        sx: {
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            height: "auto",
                            maxHeight: "70dvh",
                            pb: "env(safe-area-inset-bottom, 0px)",
                        },
                    },
                }}
                onClose={() => setTeamsOpen(false)}
            >
                <Box sx={{ p: 2, overflowY: "auto" }}>
                    <Stack alignItems="center" direction="row" sx={{ mb: 1 }}>
                        <Typography level="title-md">
                            {t.layout.mobileAccount.switchTeam}
                        </Typography>
                        <ModalClose sx={{ position: "static", ml: "auto" }} />
                    </Stack>
                    <Divider sx={{ mb: 1 }} />
                    <Stack spacing={0.5}>
                        {teams.map((team) => {
                            const isCurrent = team.teamId === myself.teamId;
                            return (
                                <Sheet
                                    key={team.teamId}
                                    variant={isCurrent ? "soft" : "plain"}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minHeight: 48,
                                        px: 1.5,
                                        borderRadius: "md",
                                        cursor: "pointer",
                                        "&:active": { opacity: 0.7 },
                                    }}
                                    onClick={() => !isCurrent && handleSwitchTeam(team)}
                                >
                                    <Typography level="body-md" sx={{ flex: 1, minWidth: 0 }}>
                                        {team.teamName}
                                    </Typography>
                                    {/* Someone else's team, here because they
                                        shared something with ours. */}
                                    {team.isGuest && (
                                        <Chip color="neutral" size="sm" variant="soft">
                                            {t.admin.teamDropdown.guestTeam}
                                        </Chip>
                                    )}
                                    {isCurrent && (
                                        <CheckCircleRoundedIcon
                                            sx={{ fontSize: 18, color: palette.accent }}
                                        />
                                    )}
                                </Sheet>
                            );
                        })}
                    </Stack>
                </Box>
            </Drawer>

            {settingsMounted && (
                <SettingsModal
                    myself={myself}
                    open={settingsOpen}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    onClose={() => setSettingsOpen(false)}
                />
            )}

            {/* Mirrors the sidebar's confirm: sign-out clears local storage,
                drafts, and history, so it must never be a single stray tap. */}
            <Modal open={signOutOpen} onClose={() => !signOutBusy && setSignOutOpen(false)}>
                <ModalDialog sx={{ width: "calc(100vw - 32px)", maxWidth: 420 }}>
                    <DialogTitle>{t.sidebar.signOutConfirm.title}</DialogTitle>
                    <Divider />
                    <DialogContent>
                        <Typography level="body-sm" sx={{ pt: 1 }}>
                            {t.sidebar.signOutConfirm.body}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color="neutral"
                            disabled={signOutBusy}
                            variant="plain"
                            onClick={() => setSignOutOpen(false)}
                        >
                            {t.sidebar.signOutConfirm.cancel}
                        </Button>
                        <Button
                            color="danger"
                            loading={signOutBusy}
                            onClick={async () => {
                                setSignOutBusy(true);
                                try {
                                    await signOut();
                                } finally {
                                    setSignOutBusy(false);
                                    setSignOutOpen(false);
                                }
                            }}
                        >
                            {t.sidebar.signOutConfirm.confirm}
                        </Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>
        </>
    );
};
