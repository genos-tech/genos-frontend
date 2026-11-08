import React from "react";
import PaletteIcon from "@mui/icons-material/Palette";
import { Box, Dropdown, IconButton, MenuButton } from "@mui/joy";

import { MenuRow, MenuSurface } from "../../../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../../../i18n";
import { g } from "../../../../../../theme/tokens";
import { TagColorOption } from "../../../../../../types/tasks";
import { getContrastTextColor } from "../../../../utils/contrastTextColor";

const BASE_COLORS = [
    { key: "red", name: "Red", value: "#ff2323" },
    { key: "green", name: "Green", value: "#1dc200" },
    { key: "blue", name: "Blue", value: "#0044c2" },
    { key: "yellow", name: "Yellow", value: "#ffd93b" },
    { key: "orange", name: "Orange", value: "#ffa823" },
    { key: "purple", name: "Purple", value: "#8e23ff" },
    { key: "pink", name: "Pink", value: "#ff238a" },
    { key: "gray", name: "Gray", value: "#808080" },
    { key: "lightGray", name: "Light Gray", value: "#d3d3d3" },
    { key: "teal", name: "Teal", value: "#008080" },
    { key: "cyan", name: "Cyan", value: "#00ffff" },
    { key: "indigo", name: "Indigo", value: "#4b0082" },
    { key: "lime", name: "Lime", value: "#bfff00" },
    { key: "magenta", name: "Magenta", value: "#ff00ff" },
    { key: "brown", name: "Brown", value: "#8b4513" },
    { key: "olive", name: "Olive", value: "#808000" },
    { key: "navy", name: "Navy", value: "#000080" },
    { key: "turquoise", name: "Turquoise", value: "#40e0d0" },
    { key: "gold", name: "Gold", value: "#ffd700" },
    { key: "crimson", name: "Crimson", value: "#dc143c" },
    { key: "salmon", name: "Salmon", value: "#fa8072" },
    { key: "tomato", name: "Tomato", value: "#ff6347" },
    { key: "coral", name: "Coral", value: "#ff7f50" },
    { key: "darkOrange", name: "Dark Orange", value: "#ff8c00" },
    { key: "khaki", name: "Khaki", value: "#f0e68c" },
    { key: "beige", name: "Beige", value: "#f5f5dc" },
    { key: "mint", name: "Mint", value: "#98ff98" },
    { key: "seaGreen", name: "Sea Green", value: "#2e8b57" },
    { key: "forestGreen", name: "Forest Green", value: "#228b22" },
    { key: "lightSkyBlue", name: "Light Sky Blue", value: "#87cefa" },
    { key: "steelBlue", name: "Steel Blue", value: "#4682b4" },
    { key: "royalBlue", name: "Royal Blue", value: "#4169e1" },
    { key: "slateBlue", name: "Slate Blue", value: "#6a5acd" },
    { key: "lavender", name: "Lavender", value: "#e6e6fa" },
    { key: "plum", name: "Plum", value: "#dda0dd" },
    { key: "orchid", name: "Orchid", value: "#da70d6" },
    { key: "hotPink", name: "Hot Pink", value: "#ff69b4" },
    { key: "deepPink", name: "Deep Pink", value: "#ff1493" },
    { key: "chocolate", name: "Chocolate", value: "#d2691e" },
] as const;

type TagColorKey = (typeof BASE_COLORS)[number]["key"];

const COLORS: (TagColorOption & { key: TagColorKey })[] = BASE_COLORS.map((color) => ({
    ...color,
    textColor: getContrastTextColor(color.value),
}));

type ColorPickerMenuProps = {
    onSelectColor: (color: TagColorOption) => void;
    // Layer for the portaled Joy Menu. Defaults to 10010 (the tag-manage
    // modal's layer). A host whose modal sits higher — e.g. the custom-
    // fields manager opened above a UrlLinkModal preview — passes its own
    // popup z so the palette clears the dialog. See [[frontend-zindex-stacking-map]].
    zIndex?: number;
};

export const ColorPickerMenu: React.FC<ColorPickerMenuProps> = ({
    onSelectColor,
    zIndex = 10010,
}) => {
    const { t } = useTranslation();
    // A Dropdown + MenuButton like every other menu: Joy then moves focus into the menu
    // on open, and Escape closes the menu and returns focus to the button. With an
    // `anchorEl` and `open` held here, focus stayed on the button (Arrow keys did
    // nothing) and Escape went on to close the whole Manage Tags dialog (MIP-1202).
    return (
        <Dropdown>
            <MenuButton
                aria-label={t.common.editor.colors}
                slots={{ root: IconButton }}
                slotProps={{
                    root: {
                        variant: "outlined",
                        color: "neutral",
                        size: "sm",
                        sx: { ml: "5px" },
                    },
                }}
            >
                <PaletteIcon />
            </MenuButton>

            <MenuSurface placement="bottom-start" sx={{ maxHeight: "300px" }} zIndex={zIndex}>
                {COLORS.map((color) => (
                    <MenuRow
                        key={color.name}
                        icon={
                            <Box
                                component="span"
                                sx={{
                                    display: "inline-block",
                                    width: 16,
                                    height: 16,
                                    borderRadius: g.radius.full,
                                    backgroundColor: color.value,
                                    border: `1px solid ${g.border.strong}`,
                                }}
                            />
                        }
                        onClick={() => onSelectColor(color)}
                    >
                        {t.tasks.tagColors[color.key]}
                    </MenuRow>
                ))}
            </MenuSurface>
        </Dropdown>
    );
};
