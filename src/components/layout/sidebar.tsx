import { ReactNode, useState } from "react";
import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Badge, Box, Divider, GlobalStyles, List, ListItem, Sheet } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { TeamDropdown } from "../../features/admin/components/teamDropdown";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { usePendingServiceHighlight } from "../../hooks/common/usePendingServiceHighlight";
import { useSidebarVisibility } from "../../hooks/common/useSidebarVisibility";
import { useSignOut } from "../../hooks/common/useSignOut";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { fmt, useTranslation } from "../../i18n";
import { switchService } from "../../services/serviceSwitch/serviceSwitchStore";
import { cycleKeys, shortcutText } from "../../shortcuts";
import { g } from "../../theme/tokens";
import { UserProps } from "../../types/admin";
import { AppTooltip } from "../ui/AppTooltip";
import { AvatarWithStatus } from "../ui/avatars/avatarWithStatus";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { NAV_HOVER_MEDIA, navButtonPlateOffSx, navFocusSx, navToneSx } from "../ui/nav/navStyles";
import { SettingsModal } from "./SettingsModal";

/**
 * Side padding of every rail button. The rail is 68px wide and its labels
 * are 0.65rem; at the old 10px, Geist's wider "Sign out" no longer fit and
 * wrapped onto two lines. Four leaves room for it (and for longer labels in
 * other languages) without moving the icon or shrinking the hit target.
 */
const RAIL_BUTTON_PX = 0.5;
/** Rail labels are a step below the type scale's smallest level (11px): at
 *  11px Geist's "Sign out" and the longer French and Spanish labels no longer
 *  fit the 68px rail on one line. */
const RAIL_LABEL_SIZE = "0.65rem";
const RAIL_ICON_SIZE = 20;

// Navigation item configuration. The shortcut each item's tooltip prints comes
// from the registry (`src/shortcuts`), not from this table.
const NAV_ITEMS = [
    {
        id: 0,
        icon: AllInboxRoundedIcon,
        labelKey: "inbox" as const,
        path: "/workspace/inbox",
    },
    {
        id: 1,
        icon: QuestionAnswerRoundedIcon,
        labelKey: "chats" as const,
        path: "/workspace/chat",
    },
    {
        id: 2,
        icon: AssignmentRoundedIcon,
        labelKey: "tasks" as const,
        path: "/workspace/tasks",
    },
    {
        id: 3,
        icon: NoteAltRoundedIcon,
        labelKey: "notes" as const,
        path: "/workspace/notes",
    },
    // Integrations is no longer surfaced from the sidebar — the
    // Connect/Disconnect surface lives in Settings → Integrations
    // now. The `/workspace/integrations` route remains alive for
    // direct deep links (OAuth callback target, GitHub PR list,
    // calendar event CRUD), it's just not advertised here anymore.
];

type RailButtonProps = {
    icon: ReactNode;
    label: string;
    tooltip: string;
    onClick: () => void;
    /** The service on screen: the accent's quiet tint, as in every sidebar. */
    selected?: boolean;
    /** Unread count; the badge is drawn only when there is something to show. */
    badgeCount?: number;
    /** `danger` turns the hover red (Sign out). */
    tone?: "default" | "danger";
};

/**
 * One button of the 68px global rail: icon over label.
 *
 * The geometry is the rail's own (icon-over-label, `RAIL_BUTTON_PX`), the
 * states are the shared ones (`navToneSx`: hover tint, selected = accent
 * subtle + `aria-current`), so the rail and the sidebars next to it select the
 * same way. As in `NavItem`, the outer box carries the look and the button
 * inside it is transparent.
 *
 * Perf: no colour-scheme hook; the theme is CSS variables.
 */
const RailButton = ({
    icon,
    label,
    tooltip,
    onClick,
    selected = false,
    badgeCount,
    tone = "default",
}: RailButtonProps) => (
    <ListItem
        data-selected={selected ? "true" : undefined}
        sx={[
            navToneSx,
            {
                // ListItem brings its own padding and nesting maths; the tile owns all of it.
                p: 0,
                m: 0,
                minHeight: 0,
                width: "100%",
                boxSizing: "border-box",
                borderRadius: g.radius.sm,
                // Regular at rest, medium when selected (`navToneSx`): the weight is
                // the non-colour cue, as in the sidebars. The label inherits it.
                fontWeight: 400,
            },
            tone === "danger" && {
                [NAV_HOVER_MEDIA]: {
                    "&:hover": {
                        background: g.danger.subtle,
                        color: g.danger.text,
                        "--Icon-color": g.danger.text,
                    },
                },
            },
        ]}
    >
        <AppTooltip placement="right" size="sm" title={tooltip}>
            <ListItemButton
                aria-current={selected ? "page" : undefined}
                color="neutral"
                selected={selected}
                variant="plain"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    m: 0,
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.25,
                    py: 1,
                    px: RAIL_BUTTON_PX,
                    borderRadius: "inherit",
                    ...navButtonPlateOffSx,
                    // Joy points a neutral button's icons at its own `text.icon` grey; the
                    // icon follows the tile's state instead (hover, selected, danger).
                    "--Icon-color": "currentColor",
                    ...navFocusSx,
                }}
                onClick={onClick}
            >
                <Badge
                    badgeContent={badgeCount && badgeCount > 0 ? badgeCount : 0}
                    invisible={!badgeCount}
                    size="sm"
                    sx={{
                        "& .MuiBadge-badge": {
                            background: g.accent.solid,
                            color: g.accent.fg,
                            fontWeight: 600,
                            fontSize: "0.6rem",
                            minWidth: 20,
                            height: 20,
                            pt: 0.25,
                        },
                    }}
                >
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            "& svg": { fontSize: RAIL_ICON_SIZE },
                        }}
                    >
                        {icon}
                    </Box>
                </Badge>
                <Box
                    className="Rail-label"
                    component="span"
                    sx={{
                        fontSize: RAIL_LABEL_SIZE,
                        lineHeight: 1.3,
                        fontWeight: "inherit",
                        letterSpacing: 0,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                    }}
                >
                    {label}
                </Box>
            </ListItemButton>
        </AppTooltip>
    </ListItem>
);

type SidebarProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useIM: InboxManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    // Navigates to the Genos main page (/workspace/genos). The Cmd-K
    // overlay stays reachable from anywhere via the keyboard shortcut.
    onOpenGenos: () => void;
    onOpenHistory: () => void;
    // Opens the ToDo pane (self-DM sub-pane). Same flow as the global
    // Ctrl+Cmd/Alt+O shortcut — see App.tsx `openTodo`.
    onOpenTodo: () => void;
};

export const Sidebar = (props: SidebarProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useIM,
        useCM,
        useUISM,
        onOpenGenos,
        onOpenHistory,
        onOpenTodo,
    } = props;
    const handleLogout = useSignOut();
    const { t } = useTranslation();
    const cycle = cycleKeys();
    const isMobile = useIsMobile();
    const sidebarVisibility = useSidebarVisibility();
    const navigate = useNavigate();
    // What the rail lights up: the route, except between a click and the
    // switch committing, when it is the service just clicked (MIP-965).
    const { highlightPath, markPending } = usePendingServiceHighlight();
    // The Genos entry navigates to a real route now, so it gets the
    // same route-derived active treatment as the NAV_ITEMS below.
    const genosActive = highlightPath.includes("/workspace/genos");

    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const [openSettings, setOpenSettings] = useState<boolean>(false);
    // Sign-out is destructive (clears localStorage, drafts, history) and
    // visually adjacent to the settings icon — easy to misclick. The
    // confirmation modal is the safety net.
    const [openSignOutConfirm, setOpenSignOutConfirm] = useState<boolean>(false);
    const [signOutBusy, setSignOutBusy] = useState<boolean>(false);

    const handleNavClick = (path: string) => {
        // Shows the "Loading data…" page first when the click changes service
        // (MIP-965); a click inside the current service navigates straight.
        markPending(path);
        switchService(navigate, path);
    };

    // Get badge count for a service
    const getBadgeCount = (serviceId: number): number => {
        switch (serviceId) {
            case 0:
                return useIM.unReadInboxItemCount;
            case 1:
                return useCM.unReadChatAndActivityCounts;
            default:
                return 0;
        }
    };

    // On mobile we use BottomTabBar for top-level navigation instead.
    if (isMobile) return null;

    return (
        <Sheet
            className="Sidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                height: "var(--app-vh)",
                width: "var(--Sidebar-width)",
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid",
                borderColor: g.border.default,
                background: g.bg.subtle,
                overflow: "hidden",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--Sidebar-width": "68px",
                        [theme.breakpoints.up("lg")]: {
                            "--Sidebar-width": "68px",
                        },
                    },
                })}
            />

            {/* Header - Team & Theme Toggle */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    alignItems: "center",
                    pt: 2,
                    pb: 1.5,
                }}
            >
                <TeamDropdown
                    myself={myself}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Box>

            <Divider sx={{ mx: 1.5, "--Divider-lineColor": g.border.subtle }} />

            {/* Navigation Items */}
            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    py: 1.5,
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.75,
                        px: 0.25,
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    {/* Genos — navigates to the main page (/workspace/genos),
                        so it carries a route-derived active state like the
                        NAV_ITEMS below. The tooltip keeps the Cmd/Ctrl-K
                        hint: the quick-ask OVERLAY (same conversation)
                        stays bound to the shortcut in `useSpotlight.ts`. */}
                    {/* The AI "sparkle" matches the Spotlight surface, signaling
                        the AI agent rather than plain search. */}
                    <RailButton
                        icon={<AutoAwesomeRoundedIcon />}
                        label={t.sidebar.nav.search}
                        selected={genosActive}
                        tooltip={fmt(t.sidebar.tooltips.spotlightShortcut, {
                            shortcut: shortcutText("global.spotlight"),
                        })}
                        onClick={() => {
                            markPending("/workspace/genos");
                            onOpenGenos();
                        }}
                    />

                    {NAV_ITEMS.filter((item) => sidebarVisibility.isVisible(item.labelKey)).map(
                        (item) => {
                            const Icon = item.icon;
                            // Items with a dedicated letter shortcut show
                            // it directly; the rest fall back to the cycle
                            // gesture (which IS their only global way in).
                            let tooltipText: string;
                            if (item.labelKey === "tasks") {
                                tooltipText = fmt(t.sidebar.tooltips.tasksShortcut, {
                                    shortcut: shortcutText("global.tasksNew"),
                                });
                            } else if (item.labelKey === "notes") {
                                tooltipText = fmt(t.sidebar.tooltips.notesShortcut, {
                                    shortcut: shortcutText("global.notesNew"),
                                });
                            } else {
                                tooltipText = fmt(t.sidebar.tooltips.switchService, {
                                    hold: cycle.hold,
                                    tap: cycle.tap,
                                });
                            }

                            return (
                                <RailButton
                                    key={item.id}
                                    badgeCount={getBadgeCount(item.id)}
                                    icon={<Icon />}
                                    label={t.sidebar.nav[item.labelKey]}
                                    selected={highlightPath.includes(item.path)}
                                    tooltip={tooltipText}
                                    onClick={() => handleNavClick(item.path)}
                                />
                            );
                        }
                    )}
                </List>

                {/* Bottom Actions */}
                <List
                    size="sm"
                    sx={{
                        mt: "auto",
                        flexGrow: 0,
                        gap: 0.75,
                        px: 0.25,
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    {/* ToDo — opens the self-DM ToDo pane. A chat sub-pane
                        (like Genos/History), not a /workspace/* service, so
                        it's a dedicated button rather than a NAV_ITEMS entry.
                        Hideable via Settings → General → Sidebar. */}
                    {sidebarVisibility.isVisible("todo") && (
                        <RailButton
                            icon={<ChecklistRoundedIcon />}
                            label={t.sidebar.actions.todo}
                            tooltip={fmt(t.sidebar.tooltips.todoShortcut, {
                                shortcut: shortcutText("global.todo"),
                            })}
                            onClick={onOpenTodo}
                        />
                    )}
                    <RailButton
                        icon={<HistoryRoundedIcon />}
                        label={t.sidebar.actions.history}
                        tooltip={fmt(t.sidebar.tooltips.historyShortcut, {
                            shortcut: shortcutText("global.history"),
                        })}
                        onClick={onOpenHistory}
                    />
                    <RailButton
                        icon={<SettingsRoundedIcon />}
                        label={t.sidebar.actions.settings}
                        tooltip={t.sidebar.tooltips.settings}
                        onClick={() => setOpenSettings(true)}
                    />
                    <RailButton
                        icon={<LogoutRoundedIcon />}
                        label={t.sidebar.actions.signOut}
                        tone="danger"
                        tooltip={t.sidebar.tooltips.signOut}
                        onClick={() => setOpenSignOutConfirm(true)}
                    />
                </List>
            </Box>

            <Divider sx={{ mx: 1.5, "--Divider-lineColor": g.border.subtle }} />

            {/* User Avatar Section — `<AvatarWithStatus>` delegates to
                `<UserAvatar>`, which renders its own PulseDot for
                online/offline state and opens the profile modal on
                click. The ring around it is the sidebar's signature
                affordance for "you": green while you are online. */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    py: 1.5,
                    position: "relative",
                }}
            >
                <AppTooltip placement="right" size="sm" title={t.sidebar.tooltips.openProfile}>
                    <Box
                        sx={{
                            position: "relative",
                            borderRadius: "50%",
                            p: 0.25,
                            background:
                                myself?.isOfflineForced !== "true"
                                    ? g.success.solid
                                    : g.border.strong,
                            transition: "all 0.3s ease",
                            "&:hover": {
                                transform: "scale(1.05)",
                                boxShadow:
                                    myself?.isOfflineForced !== "true" ? g.shadow.md : "none",
                            },
                        }}
                    >
                        <AvatarWithStatus
                            avatarSize={34}
                            isYou={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                    </Box>
                </AppTooltip>
            </Box>

            {/* User profile for team members */}
            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                    useUISM={useUISM}
                />
            )}

            <SettingsModal
                myself={myself}
                open={openSettings}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                onClose={() => setOpenSettings(false)}
            />

            <ConfirmDialog
                busy={signOutBusy}
                cancelLabel={t.sidebar.signOutConfirm.cancel}
                confirmLabel={t.sidebar.signOutConfirm.confirm}
                description={t.sidebar.signOutConfirm.body}
                open={openSignOutConfirm}
                title={t.sidebar.signOutConfirm.title}
                destructive
                onClose={() => setOpenSignOutConfirm(false)}
                onConfirm={async () => {
                    setSignOutBusy(true);
                    try {
                        await handleLogout();
                    } finally {
                        // Sign-out navigates away on success;
                        // resetting state defends against the
                        // failure path (button stays clickable).
                        setSignOutBusy(false);
                        setOpenSignOutConfirm(false);
                    }
                }}
            />
        </Sheet>
    );
};
