import { CSSProperties } from "react";
import { Box, Dropdown, MenuButton } from "@mui/joy";
import IconButton from "@mui/joy/IconButton";

import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { fmt, useTranslation } from "../../../../i18n";
import { focusRing, g } from "../../../../theme/tokens";
import { STATUS_PALETTE, StatusColorKey } from "../../../../theme/tokens/statusPalette";
import { ProjectStatusDef } from "../../../../types/tasks";
import { rowColorCss, statusColorCss } from "../../utils/projectStatus";
import { getStatusIcon } from "../meta/statusIcons";

// The palette's names are the ones the tag colour picker already translates.
const NAMES = {
    slate: "gray",
    blue: "blue",
    indigo: "indigo",
    violet: "purple",
    teal: "teal",
    pink: "pink",
    red: "red",
    orange: "orange",
    amber: "gold",
    green: "green",
} as const satisfies Record<StatusColorKey, string>;

/** The status's own glyph in a colour: the icon is the swatch. */
export const StatusGlyph = ({
    category,
    color,
    size = 18,
}: {
    category: string;
    color: string;
    size?: number;
}) => (
    <span
        aria-hidden="true"
        style={{ display: "inline-flex", color, "--Icon-color": color } as CSSProperties}
    >
        {getStatusIcon(category, size)}
    </span>
);

const cellSx = {
    width: 36,
    height: 36,
    minHeight: 36,
    p: 0,
    justifyContent: "center",
    borderRadius: g.radius.full,
    border: "2px solid transparent",
    "&:hover": { background: g.hover },
    "&:focus-visible": focusRing,
    '&[aria-checked="true"]': { borderColor: g.accent.solid },
    "@media (pointer: coarse)": { width: 44, height: 44, minHeight: 44 },
} as const;

/** A status row's icon, which opens the colours it can take (MIP-2493). */
export const StatusColorMenu = ({
    row,
    name,
    zIndex,
    disabled,
    onPick,
}: {
    row: ProjectStatusDef;
    name: string;
    zIndex: number;
    disabled?: boolean;
    onPick: (color: string) => void;
}) => {
    const { t } = useTranslation();
    const words = t.tasks.projectStatuses;
    const choices = [
        { color: "", label: words.categoryColor, shown: statusColorCss("", row.category) },
        ...STATUS_PALETTE.map((c) => ({
            color: c.hex as string,
            label: t.tasks.tagColors[NAMES[c.key]],
            shown: c.hex as string,
        })),
    ];
    return (
        <Dropdown>
            <MenuButton
                disabled={disabled}
                slots={{ root: IconButton }}
                slotProps={{
                    root: {
                        "aria-label": fmt(words.changeColor, { name }),
                        size: "sm",
                        variant: "plain",
                        color: "neutral",
                        sx: {
                            width: 32,
                            height: 32,
                            minWidth: 32,
                            minHeight: 32,
                            borderRadius: g.radius.full,
                            "&:hover": { background: g.hover },
                            "&:focus-visible": focusRing,
                            "@media (pointer: coarse)": {
                                width: 44,
                                height: 44,
                                minWidth: 44,
                                minHeight: 44,
                            },
                        },
                    },
                }}
            >
                <StatusGlyph category={row.category} color={rowColorCss(row)} />
            </MenuButton>
            <MenuSurface
                aria-label={fmt(words.colorFor, { name })}
                placement="bottom-start"
                zIndex={zIndex}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, auto)",
                        gap: 0.5,
                        p: 0.5,
                    }}
                >
                    {choices.map((choice) => (
                        <MenuRow
                            mark="none"
                            key={choice.color || "category"}
                            aria-checked={row.color === choice.color}
                            aria-label={choice.label}
                            role="menuitemradio"
                            sx={cellSx}
                            title={choice.label}
                            onClick={() => onPick(choice.color)}
                        >
                            <Box sx={{ position: "relative", display: "inline-flex" }}>
                                <StatusGlyph category={row.category} color={choice.shown} />
                                {/* The category's own colour is marked apart from a chosen one. */}
                                {choice.color === "" && (
                                    <Box
                                        aria-hidden="true"
                                        sx={{
                                            position: "absolute",
                                            insetInlineEnd: -3,
                                            bottom: -1,
                                            width: 6,
                                            height: 6,
                                            borderRadius: g.radius.full,
                                            border: `1px solid ${g.text.tertiary}`,
                                            background: g.surface.raised,
                                        }}
                                    />
                                )}
                            </Box>
                        </MenuRow>
                    ))}
                </Box>
            </MenuSurface>
        </Dropdown>
    );
};
