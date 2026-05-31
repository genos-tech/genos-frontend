import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Badge, Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { useTranslation } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";

type BottomTabBarProps = {
    useIM: InboxManagementState;
    useCM: ChatManagementState;
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
];

export const BottomTabBar = (props: BottomTabBarProps) => {
    const { useIM, useCM } = props;
    const isMobile = useIsMobile();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    if (!isMobile) return null;

    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const accent = isDark ? purplePalette.dark.accentSoft : purplePalette.light.accent;

    const getBadgeCount = (id: number): number => {
        if (id === 0) return useIM.unReadInboxItemCount;
        if (id === 1) return useCM.unReadChatAndActivityCounts;
        return 0;
    };

    return (
        <Sheet
            sx={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1200,
                height: "var(--BottomTabBar-height, 60px)",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-around",
                borderTop: "1px solid",
                borderColor: palette.divider,
                background: isDark
                    ? "linear-gradient(180deg, rgba(20,14,34,0.96) 0%, rgba(11,10,22,0.98) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,0.96) 0%, rgba(248,245,255,0.98) 100%)",
                backdropFilter: "blur(12px)",
                paddingBottom: "env(safe-area-inset-bottom, 0)",
            }}
        >
            {TAB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.includes(item.path);
                const badgeCount = getBadgeCount(item.id);

                return (
                    <Box
                        key={item.id}
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 0.25,
                            cursor: "pointer",
                            color: isActive
                                ? accent
                                : isDark
                                  ? "rgba(255,255,255,0.55)"
                                  : "rgba(0,0,0,0.5)",
                            transition: "color 0.2s ease",
                            "&:active": { opacity: 0.7 },
                        }}
                        onClick={() => navigate(item.path)}
                    >
                        <Badge
                            badgeContent={badgeCount > 0 ? badgeCount : 0}
                            invisible={badgeCount === 0}
                            size="sm"
                            sx={{
                                "& .MuiBadge-badge": {
                                    background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: "0.6rem",
                                    minWidth: 18,
                                    height: 18,
                                },
                            }}
                        >
                            <Icon sx={{ fontSize: 22 }} />
                        </Badge>
                        <Box
                            sx={{
                                fontSize: "0.62rem",
                                fontWeight: isActive ? 600 : 500,
                                letterSpacing: "0.02em",
                            }}
                        >
                            {t.sidebar.nav[item.labelKey]}
                        </Box>
                    </Box>
                );
            })}
        </Sheet>
    );
};
