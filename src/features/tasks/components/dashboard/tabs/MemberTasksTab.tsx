import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { Box, Card, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { UserAvatar } from "../../../../../components/ui/avatars/UserAvatar";
import { useTranslation } from "../../../../../i18n";
import {
    isSameMember,
    memberOptionLabel,
    renderMemberOption,
} from "../../autocompletes/MemberPickerParts";
import type { TaskHomeData } from "../useTaskHomeData";

type MemberTasksTabProps = Pick<
    TaskHomeData,
    | "isDark"
    | "setSelectedMemberId"
    | "projectMembers"
    | "selectedMember"
    | "cardBg"
    | "cardBorder"
    | "textPrimary"
    | "textMuted"
>;

export const MemberTasksTab = ({
    isDark,
    setSelectedMemberId,
    projectMembers,
    selectedMember,
    cardBg,
    cardBorder,
    textPrimary,
    textMuted,
}: MemberTasksTabProps) => {
    const { t } = useTranslation();
    return (
        <>
            <Box sx={{ mb: 2 }}>
                <Card
                    variant="soft"
                    sx={{
                        p: 2,
                        background: cardBg,
                        border: "1px solid",
                        borderColor: cardBorder,
                    }}
                >
                    <Stack
                        alignItems={{ sm: "center" }}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                    >
                        <Box sx={{ minWidth: { sm: 260 }, width: "100%" }}>
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: textMuted,
                                    fontWeight: 600,
                                    mb: 0.5,
                                }}
                            >
                                {t.tasks.dashboard.memberTasks.pickLabel}
                            </Typography>
                            <Autocomplete
                                getOptionLabel={memberOptionLabel}
                                isOptionEqualToValue={isSameMember}
                                options={projectMembers}
                                placeholder={t.tasks.dashboard.memberTasks.pickPlaceholder}
                                renderOption={renderMemberOption()}
                                size="sm"
                                startDecorator={<PersonRoundedIcon sx={{ fontSize: 16 }} />}
                                value={selectedMember}
                                onChange={(_, v) => setSelectedMemberId(v ? v.id : null)}
                            />
                        </Box>
                        {/* Prominent "whose stats" banner so it's always
                        clear which member is selected. */}
                        {selectedMember ? (
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1.25}
                                sx={{
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: "10px",
                                    background: isDark
                                        ? "rgba(var(--gp-brandalt-500-rgb), 0.12)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(var(--gp-brandalt-500-rgb), 0.3)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.2)",
                                }}
                            >
                                {/* Clickable: opens the member's profile
                                modal. Safe here because — unlike the
                                dashboard task rows — this banner has no
                                onClick of its own for the avatar's
                                handler to bubble into. */}
                                <UserAvatar
                                    showPulseDot={false}
                                    size={32}
                                    userId={selectedMember.id}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography level="body-xs" sx={{ color: textMuted }}>
                                        {t.tasks.dashboard.memberTasks.viewing}
                                    </Typography>
                                    <Typography
                                        level="title-sm"
                                        sx={{
                                            fontWeight: 700,
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        <bdi className="g-bidi-island">{selectedMember.name}</bdi>
                                    </Typography>
                                </Box>
                            </Stack>
                        ) : (
                            <Typography level="body-sm" sx={{ color: textMuted }}>
                                {projectMembers.length === 0
                                    ? t.tasks.dashboard.memberTasks.noMembers
                                    : t.tasks.dashboard.memberTasks.pickHint}
                            </Typography>
                        )}
                    </Stack>
                </Card>
            </Box>
            {selectedMember == null && (
                <Card
                    variant="soft"
                    sx={{
                        p: 4,
                        textAlign: "center",
                        background: cardBg,
                        border: "2px dashed",
                        borderColor: cardBorder,
                    }}
                >
                    <Stack alignItems="center" spacing={2}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "rgba(var(--gp-brandalt-500-rgb), 0.1)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.08)",
                            }}
                        >
                            <GroupsRoundedIcon
                                sx={{
                                    fontSize: 28,
                                    color: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
                                }}
                            />
                        </Box>
                        <Typography level="title-md" sx={{ fontWeight: 600, color: textPrimary }}>
                            {t.tasks.dashboard.memberTasks.promptTitle}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: textMuted }}>
                            {projectMembers.length === 0
                                ? t.tasks.dashboard.memberTasks.noMembers
                                : t.tasks.dashboard.memberTasks.promptBody}
                        </Typography>
                    </Stack>
                </Card>
            )}
        </>
    );
};
