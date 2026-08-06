import { ReactNode, useEffect, useMemo, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Box,
    Button,
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
import { ModalTeamProfile } from "../../features/admin/components/modals/ModalTeamProfile";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { loadMyTeams, membershipTeams } from "../../features/admin/services/loadMyTeams";
import { switchTeam } from "../../features/admin/services/switchTeam";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useSignOut } from "../../hooks/common/useSignOut";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";
import { Team, TeamProfileProps, UserProps } from "../../types/admin";
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
    disabled,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    detail?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) => (
    <Button
        color={danger ? "danger" : "neutral"}
        disabled={disabled}
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

    // `getMyTeams` answers with full team profiles (roster, owner, created
    // date), which is everything both the switcher and the team-profile
    // modal need — so it is fetched once and kept whole here rather than
    // narrowed on arrival and re-fetched for the modal the way the desktop
    // dropdown does it.
    const [myTeams, setMyTeams] = useState<TeamProfileProps[]>([]);
    const [teamsOpen, setTeamsOpen] = useState(false);
    const [teamProfile, setTeamProfile] = useState<TeamProfileProps | null>(null);
    const [teamProfileOpen, setTeamProfileOpen] = useState(false);
    // Opening a member (or the owner) from inside the team profile. The
    // desktop sidebar owns the same pair for the same reason: the profile
    // modal only reports which user was tapped, it doesn't show them.
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const [userProfileOpen, setUserProfileOpen] = useState(false);
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
                const loaded: TeamProfileProps[] = await loadMyTeams(accessToken, myself.userId);
                if (!cancelled) setMyTeams(loaded ?? []);
            } catch {
                // Non-fatal: the team row just shows the current team only.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, accessToken, myself.userId]);

    // Host-team shells arrive here too (a chat or folder another
    // organization shared with us). They aren't teams you can switch into.
    const switchableTeams = useMemo(() => membershipTeams(myTeams), [myTeams]);
    const currentTeamProfile = useMemo(
        () => myTeams.find((team) => team.teamId === myself.teamId) ?? null,
        [myTeams, myself.teamId]
    );

    const handleSwitchTeam = (team: Team) => {
        switchTeam({
            accessToken,
            myself,
            setMyself,
            teamId: team.teamId,
            teamName: team.teamName,
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
                        {/* Same label and order as the desktop team
                            dropdown, which opens this modal from the row
                            above its team list. Disabled until the fetch
                            above lands — there is no profile to show yet,
                            and a tap that silently does nothing reads as a
                            broken button. */}
                        <RowButton
                            disabled={!currentTeamProfile}
                            icon={<VisibilityRoundedIcon />}
                            label={t.admin.teamDropdown.showTeamProfile}
                            onClick={() => {
                                setTeamProfile(currentTeamProfile);
                                setTeamProfileOpen(true);
                                // The profile is full-screen on mobile, so
                                // the sheet underneath is invisible anyway;
                                // closing it means one back-tap returns to
                                // the workspace rather than to this menu.
                                onClose();
                            }}
                        />
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
                        {switchableTeams.map((team) => {
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

            {teamProfile && (
                <ModalTeamProfile
                    myself={myself}
                    openModalTeamProfile={teamProfileOpen}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenModalTeamProfile={setTeamProfileOpen}
                    setOpenUserProfile={setUserProfileOpen}
                    setTeamProfile={setTeamProfile}
                    socket={socket}
                    teamProfile={teamProfile}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}

            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={userProfileOpen}
                    setMyself={setMyself}
                    setOpenUserProfile={setUserProfileOpen}
                    socket={socket}
                    useCM={useCM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                    useUISM={useUISM}
                />
            )}

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
