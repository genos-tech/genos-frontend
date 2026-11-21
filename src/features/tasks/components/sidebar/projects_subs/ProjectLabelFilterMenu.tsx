import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Box, Dropdown, IconButton, MenuButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { MenuDivider, MenuRow, MenuSurface } from "../../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import type { ProjectLabelProps } from "../../../../../types/tasks";

// The project-label filter button and its menu (MIP-1700): shared by the
// joined "Projects" header and the "Join Project" list, so both filter the
// same way. Purely presentational: the caller owns the selected ids.
export const ProjectLabelFilterMenu = ({
    labels,
    activeIds,
    onToggle,
    onClear,
}: {
    labels: ProjectLabelProps[];
    activeIds: number[];
    onToggle: (labelId: number) => void;
    onClear: () => void;
}) => {
    const { t } = useTranslation();
    const filterActive = activeIds.length > 0;
    return (
        <Dropdown>
            <AppTooltip title={t.tasks.sidebar.filterByLabel}>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: filterActive ? "soft" : "plain",
                            color: filterActive ? "primary" : "neutral",
                            sx: {
                                "--IconButton-size": "30px",
                                borderRadius: "6px",
                                px: filterActive ? 0.5 : 0,
                                flexShrink: 0,
                            },
                        },
                    }}
                >
                    <FilterListIcon sx={{ fontSize: 16 }} />
                    {filterActive && (
                        <Typography
                            level="body-xs"
                            sx={{
                                ml: 0.25,
                                fontWeight: 700,
                                color: "inherit",
                            }}
                        >
                            {activeIds.length}
                        </Typography>
                    )}
                </MenuButton>
            </AppTooltip>
            <MenuSurface placement="bottom-end" sx={{ maxHeight: 320, minWidth: 147 }}>
                {labels.length === 0 ? (
                    <MenuRow disabled>{t.tasks.sidebar.noLabels}</MenuRow>
                ) : (
                    labels.map((label) => {
                        const selected = activeIds.includes(label.labelId);
                        return (
                            <MenuRow
                                key={label.labelId}
                                mark="none"
                                selected={selected}
                                onClick={() => onToggle(label.labelId)}
                            >
                                <CheckRoundedIcon
                                    sx={{
                                        fontSize: 16,
                                        flexShrink: 0,
                                        // Always visible; faint
                                        // when unselected so the
                                        // toggle affordance reads.
                                        opacity: selected ? 1 : 0.25,
                                        color: selected ? g.accent.text : "inherit",
                                    }}
                                />
                                <Box
                                    sx={{
                                        px: 0.75,
                                        py: 0.15,
                                        borderRadius: "5px",
                                        backgroundColor: label.color,
                                        color: label.textColor,
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                        maxWidth: 110,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {label.name}
                                </Box>
                            </MenuRow>
                        );
                    })
                )}
                {filterActive && <MenuDivider />}
                {filterActive && (
                    <MenuRow sx={{ justifyContent: "center" }} onClick={onClear}>
                        {t.tasks.sidebar.clearLabelFilter}
                    </MenuRow>
                )}
            </MenuSurface>
        </Dropdown>
    );
};
