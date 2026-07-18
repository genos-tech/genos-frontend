import { useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import {
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { BoxSlotRoot } from "../../../../components/ui/slotRoot";
import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { useTranslation } from "../../../../i18n";
import { PersonalTag } from "../../../../types/personalTags";
import { selectVisibleTagChips } from "../../utils/gmTagFilters";
import { ModalManageGMTags } from "../modals/ModalManageGMTags";

/**
 * Tag filter chip row above the GM chat list. Mirrors the Activity
 * pane's `ActivityDivider` (chip row + trailing "Tags" multi-select
 * menu) but for the user's PERSONAL tags:
 *
 * - The row shows `selectVisibleTagChips`: pinned tags when the user
 *   has customized, else the recency-derived default — plus any
 *   currently-selected tag so an active filter is always removable in
 *   place. Clicking a chip toggles it (multi-select, OR semantics).
 * - The trailing menu lists ALL tags (checkable, stays open), a
 *   per-row pin toggle (the "customize default chips" surface), a
 *   clear-all item, and "Manage tags…" opening the CRUD modal.
 * - Renders nothing while the user has no tags — the feature stays
 *   invisible until first use.
 */

type GMTagFilterRowProps = {
    selectedTagIds: ReadonlySet<number>;
    setSelectedTagIds: (next: ReadonlySet<number>) => void;
};

export const GMTagFilterRow = ({ selectedTagIds, setSelectedTagIds }: GMTagFilterRowProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { tags, defaultVisibleTagIds, updateTag } = usePersonalGMTags();
    const [openManage, setOpenManage] = useState(false);

    const visibleChips = selectVisibleTagChips(tags, defaultVisibleTagIds, selectedTagIds);
    const hasSelection = selectedTagIds.size > 0;

    const toggleTag = (tagId: number) => {
        const next = new Set(selectedTagIds);
        if (next.has(tagId)) {
            next.delete(tagId);
        } else {
            next.add(tagId);
        }
        setSelectedTagIds(next);
    };

    if (tags.length === 0) return null;

    // Neutral chip-trigger styling copied from `ActivityDivider`'s
    // chipButtonSx family so the two filter rows read as one system.
    const chipButtonSx = (isActive: boolean) => ({
        "&:hover": {
            background: isActive
                ? isDark
                    ? "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(139,92,246,0.16) 100%)"
                    : "linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.1) 100%)"
                : isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
        },
        alignItems: "center",
        background: isActive
            ? isDark
                ? "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.06) 100%)"
            : "transparent",
        border: "1px solid",
        borderColor: isActive
            ? isDark
                ? "rgba(139,92,246,0.25)"
                : "rgba(124,58,237,0.15)"
            : "transparent",
        borderRadius: "6px",
        cursor: "pointer",
        display: "flex",
        gap: 0.25,
        minHeight: 0,
        px: 0.75,
        py: 0.25,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        whiteSpace: "nowrap",
    });
    const chipIconSx = (isActive: boolean) => ({
        color: isActive
            ? isDark
                ? "#a78bfa"
                : "#7c3aed"
            : isDark
              ? "rgba(255,255,255,0.45)"
              : "rgba(0,0,0,0.4)",
        fontSize: 13,
        transition: "color 0.2s ease",
    });
    const chipLabelSx = (isActive: boolean) => ({
        color: isActive
            ? isDark
                ? "rgba(255,255,255,0.9)"
                : "rgba(0,0,0,0.85)"
            : isDark
              ? "rgba(255,255,255,0.55)"
              : "rgba(0,0,0,0.5)",
        fontSize: "0.65rem",
        fontWeight: isActive ? 600 : 500,
        transition: "all 0.2s ease",
    });

    // Tag chips tint with the tag's own color (the ModernChip
    // `${color}NN` alpha-suffix recipe) so the row scans by color.
    const tagChipSx = (tag: PersonalTag, isActive: boolean) => ({
        "&:hover": {
            background: `${tag.color}${isActive ? "30" : "14"}`,
        },
        alignItems: "center",
        background: isActive ? `${tag.color}26` : "transparent",
        border: "1px solid",
        borderColor: isActive
            ? `${tag.color}59`
            : isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.08)",
        borderRadius: "6px",
        cursor: "pointer",
        display: "flex",
        gap: 0.5,
        minHeight: 0,
        px: 0.75,
        py: 0.25,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        whiteSpace: "nowrap",
    });

    const colorDot = (tag: PersonalTag, size = 7) => (
        <Box
            sx={{
                background: tag.color,
                borderRadius: "50%",
                flexShrink: 0,
                height: size,
                width: size,
            }}
        />
    );

    return (
        <Box
            sx={{
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                px: 1,
                py: 0.75,
            }}
        >
            <Stack
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                direction="row"
                spacing={0.25}
                sx={{
                    "&::-webkit-scrollbar": {
                        height: 4,
                    },
                    overflowX: "auto",
                    pb: 0.25,
                }}
            >
                {visibleChips.map((tag) => {
                    const isActive = selectedTagIds.has(tag.tagId);
                    return (
                        <Box
                            key={tag.tagId}
                            sx={tagChipSx(tag, isActive)}
                            onClick={() => toggleTag(tag.tagId)}
                        >
                            {colorDot(tag)}
                            <Typography level="body-xs" sx={chipLabelSx(isActive)}>
                                {tag.name}
                            </Typography>
                        </Box>
                    );
                })}

                {/* Trailing "Tags" menu — all tags, checkable; pin
                    toggles customize the default chip row; Clear-all;
                    Manage tags… */}
                <Dropdown>
                    <MenuButton
                        slots={{ root: BoxSlotRoot }}
                        slotProps={{
                            root: {
                                "aria-label": t.chat.sidebar.gmTagFilterMenuLabel,
                                sx: chipButtonSx(hasSelection),
                            },
                        }}
                    >
                        <SellOutlinedIcon sx={chipIconSx(hasSelection)} />
                        <Typography level="body-xs" sx={chipLabelSx(hasSelection)}>
                            {t.chat.sidebar.gmTagFilterMenuLabel}
                        </Typography>
                        {hasSelection && (
                            <Box
                                sx={{
                                    alignItems: "center",
                                    background: isDark ? "#a78bfa" : "#7c3aed",
                                    borderRadius: "999px",
                                    color: "#fff",
                                    display: "flex",
                                    fontSize: "0.55rem",
                                    fontWeight: 700,
                                    height: 13,
                                    justifyContent: "center",
                                    lineHeight: 1,
                                    minWidth: 13,
                                    px: 0.375,
                                }}
                            >
                                {selectedTagIds.size}
                            </Box>
                        )}
                    </MenuButton>
                    <Menu
                        placement="bottom-start"
                        size="sm"
                        sx={{
                            background: isDark
                                ? "rgba(30, 30, 40, 0.98)"
                                : "rgba(255, 255, 255, 0.98)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            borderRadius: "10px",
                            boxShadow: isDark
                                ? "0 8px 24px rgba(0,0,0,0.5)"
                                : "0 8px 24px rgba(0,0,0,0.12)",
                            maxHeight: 400,
                            minWidth: 220,
                            overflowY: "auto",
                            zIndex: 10010,
                        }}
                    >
                        {tags.map((tag) => {
                            const isChecked = selectedTagIds.has(tag.tagId);
                            return (
                                <MenuItem
                                    key={tag.tagId}
                                    selected={isChecked}
                                    sx={{
                                        borderRadius: "6px",
                                        fontSize: "0.8rem",
                                        gap: 1,
                                        mx: 0.5,
                                        py: 0.5,
                                    }}
                                    onClick={(e) => {
                                        // Keep the menu open so users can
                                        // toggle multiple tags in one
                                        // session (ActivityDivider pattern).
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleTag(tag.tagId);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            alignItems: "center",
                                            color: isChecked
                                                ? isDark
                                                    ? "#a78bfa"
                                                    : "#7c3aed"
                                                : "transparent",
                                            display: "flex",
                                            justifyContent: "center",
                                            width: 16,
                                        }}
                                    >
                                        <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                    </Box>
                                    {colorDot(tag, 10)}
                                    <Typography
                                        level="body-sm"
                                        sx={{ flex: 1, fontSize: "0.8rem" }}
                                        noWrap
                                    >
                                        {tag.name}
                                    </Typography>
                                    {/* Pin toggle = "show this chip by
                                        default". Stop propagation so it
                                        doesn't also toggle the filter. */}
                                    <AppTooltip
                                        size="sm"
                                        title={
                                            tag.isDefaultVisible
                                                ? t.chat.sidebar.gmTagUnpinDefault
                                                : t.chat.sidebar.gmTagPinDefault
                                        }
                                    >
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                "--IconButton-size": "22px",
                                                color: tag.isDefaultVisible
                                                    ? isDark
                                                        ? "#a78bfa"
                                                        : "#7c3aed"
                                                    : isDark
                                                      ? "rgba(255,255,255,0.35)"
                                                      : "rgba(0,0,0,0.3)",
                                            }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                void updateTag(tag.tagId, {
                                                    isDefaultVisible: !tag.isDefaultVisible,
                                                });
                                            }}
                                        >
                                            {tag.isDefaultVisible ? (
                                                <PushPinRoundedIcon sx={{ fontSize: 14 }} />
                                            ) : (
                                                <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
                                            )}
                                        </IconButton>
                                    </AppTooltip>
                                </MenuItem>
                            );
                        })}
                        {hasSelection && (
                            <MenuItem
                                sx={{
                                    borderRadius: "6px",
                                    borderTop: "1px solid",
                                    borderTopColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.06)",
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    gap: 1,
                                    mt: 0.5,
                                    mx: 0.5,
                                    py: 0.75,
                                }}
                                onClick={() => setSelectedTagIds(new Set())}
                            >
                                {t.chat.sidebar.gmTagFilterClear}
                            </MenuItem>
                        )}
                        <MenuItem
                            sx={{
                                borderRadius: "6px",
                                borderTop: "1px solid",
                                borderTopColor: isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.06)",
                                fontSize: "0.8rem",
                                gap: 1,
                                mt: 0.5,
                                mx: 0.5,
                                py: 0.75,
                            }}
                            onClick={() => setOpenManage(true)}
                        >
                            <LabelOutlinedIcon
                                sx={{ color: isDark ? "#a78bfa" : "#7c3aed", fontSize: 16 }}
                            />
                            {t.chat.sidebar.gmTagManageMenu}
                        </MenuItem>
                    </Menu>
                </Dropdown>
            </Stack>

            <ModalManageGMTags open={openManage} setOpen={setOpenManage} />
        </Box>
    );
};
