import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Badge, Box } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { usePendingServiceHighlight } from "../../hooks/common/usePendingServiceHighlight";
import {
    HIDEABLE_SIDEBAR_ITEMS,
    SidebarItemKey,
    useSidebarVisibility,
} from "../../hooks/common/useSidebarVisibility";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { fmt, useTranslation } from "../../i18n";
import { switchService } from "../../services/serviceSwitch/serviceSwitchStore";
import { g, type } from "../../theme/tokens";
import { NAV_HOVER_MEDIA, NAV_SELECTED, navFocusSx, navToneSx } from "../ui/nav/navStyles";

type BottomTabBarProps = {
    useIM: InboxManagementState;
    useCM: ChatManagementState;
    onOpenMore: () => void;
};

// Mirrors NAV_ITEMS in `sidebar.tsx`. Kept inline rather than imported
// because the desktop sidebar is structurally different (vertical list
// with sub-affordances); we don't want changes there to leak into the
// mobile tab bar.
const TAB_ITEMS = [
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
    // "More" opens a sheet rather than navigating: To-Do, History, settings,
    // theme, team switch and sign-out live in the desktop sidebar, which is
    // `null` on mobile (MIP-1277). `path` is empty so nothing here is ever
    // route-active.
    {
        id: 4,
        icon: MoreHorizRoundedIcon,
        labelKey: "more" as const,
        path: "",
    },
];

export const BottomTabBar = (props: BottomTabBarProps) => {
    const { useIM, useCM, onOpenMore } = props;
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const navigate = useNavigate();
    // What the bar lights up: the route, except between a tap and the switch
    // committing, when it is the tab just tapped (MIP-965).
    const { highlightPath, markPending } = usePendingServiceHighlight();
    const { isVisible } = useSidebarVisibility();

    if (!isMobile) return null;

    // Hide tabs the user turned off in Settings → Sidebar. More has no
    // toggle (like Genos on desktop), so it's kept via the labelKey guard.
    const hideable = new Set<string>(HIDEABLE_SIDEBAR_ITEMS);
    const visibleTabs = TAB_ITEMS.filter(
        (item) => !hideable.has(item.labelKey) || isVisible(item.labelKey as SidebarItemKey)
    );

    const getBadgeCount = (id: number): number => {
        if (id === 0) return useIM.unReadInboxItemCount;
        if (id === 1) return useCM.unReadChatAndActivityCounts;
        return 0;
    };

    return (
        <Box
            aria-label={t.sidebar.navLabel}
            component="nav"
            sx={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1200,
                // The variable is the bar's TOTAL footprint (60px of tabs +
                // the home-indicator strip). `box-sizing: border-box` means
                // the padding below comes out of this height, leaving the
                // tabs their full 60px — before, the inset was subtracted
                // from 60 and the icons had ~26px on a notched iPhone.
                boxSizing: "border-box",
                height: "var(--BottomTabBar-height, 60px)",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-around",
                borderTop: `1px solid ${g.border.subtle}`,
                // A tab bar is page chrome, not an overlay: the page background,
                // opaque, no blur.
                background: g.bg.default,
                paddingBottom: "env(safe-area-inset-bottom, 0)",
            }}
        >
            {visibleTabs.map((item) => {
                const Icon = item.icon;
                // Guard on empty `path` — `includes("")` is true for every
                // route, which would light up the More tab everywhere.
                const isActive = item.path !== "" && highlightPath.includes(item.path);
                const badgeCount = getBadgeCount(item.id);
                // The unread count is part of the tab's name, not only a badge to look at.
                const tabName =
                    badgeCount > 0
                        ? fmt(t.sidebar.unreadTab, {
                              label: t.sidebar.nav[item.labelKey],
                              count: badgeCount,
                          })
                        : undefined;
                // A real button: focusable and announced, where it used to be a clickable div.
                // The look is the rail's (`navToneSx`: text colour, the icon colour that goes
                // with it, selected = accent text and medium weight); a full-width tint on a
                // 78px tab would be heavy, so the selected tab changes colour only.
                const openTab = () => {
                    if (item.path === "") {
                        onOpenMore();
                        return;
                    }
                    markPending(item.path);
                    switchService(navigate, item.path);
                };

                return (
                    <Box
                        key={item.id}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={tabName}
                        component="button"
                        data-selected={isActive ? "true" : undefined}
                        type="button"
                        sx={[
                            navToneSx,
                            {
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.25,
                                p: 0,
                                m: 0,
                                border: 0,
                                borderRadius: 0,
                                background: "transparent",
                                font: "inherit",
                                cursor: "pointer",
                                WebkitTapHighlightColor: "transparent",
                                touchAction: "manipulation",
                                // Colour only, at rest, selected and under a mouse (a narrow desktop
                                // window shows this bar too): a full-cell tint is for rail tiles.
                                [NAV_HOVER_MEDIA]: { "&:hover": { background: "transparent" } },
                                [NAV_SELECTED]: {
                                    background: "transparent",
                                    [NAV_HOVER_MEDIA]: {
                                        "&:hover": { background: "transparent" },
                                    },
                                },
                                "&:active": { opacity: 0.7 },
                            },
                            navFocusSx,
                        ]}
                        onClick={openTab}
                    >
                        <Badge
                            badgeContent={badgeCount > 0 ? badgeCount : 0}
                            invisible={badgeCount === 0}
                            size="sm"
                            sx={{
                                "& .MuiBadge-badge": {
                                    background: g.accent.solid,
                                    color: g.accent.fg,
                                    fontWeight: 600,
                                    fontSize: "0.6rem",
                                    minWidth: 18,
                                    height: 18,
                                },
                            }}
                        >
                            <Icon sx={{ fontSize: 22 }} />
                        </Badge>
                        <Box component="span" sx={{ ...type("caption"), fontWeight: "inherit" }}>
                            {t.sidebar.nav[item.labelKey]}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
};
