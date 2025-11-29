import React, { useState } from "react";
import PaletteIcon from "@mui/icons-material/Palette";
import { IconButton, ListItemDecorator, Menu, MenuItem } from "@mui/joy";

import { TagColorOption } from "../../../../../../types/tasks";

const getContrastTextColor = (hex: string): "black" | "white" => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "black" : "white";
};

const BASE_COLORS = [
    { name: "Red", value: "#ff2323" },
    { name: "Green", value: "#1dc200" },
    { name: "Blue", value: "#0044c2" },
    { name: "Yellow", value: "#ff8c00ff" },
    { name: "Orange", value: "#ffa823" },
    { name: "Purple", value: "#8e23ff" },
    { name: "Pink", value: "#ff238a" },
    { name: "Gray", value: "#808080" },
    { name: "Light Gray", value: "#d3d3d3" },
    { name: "Teal", value: "#008080" },
    { name: "Cyan", value: "#00ffff" },
    { name: "Indigo", value: "#4b0082" },
    { name: "Lime", value: "#bfff00" },
    { name: "Magenta", value: "#ff00ff" },
    { name: "Brown", value: "#8b4513" },
    { name: "Olive", value: "#808000" },
    { name: "Navy", value: "#000080" },
    { name: "Turquoise", value: "#40e0d0" },
    { name: "Gold", value: "#ffd700" },
    { name: "Crimson", value: "#dc143c" },
    { name: "Salmon", value: "#fa8072" },
    { name: "Tomato", value: "#ff6347" },
    { name: "Coral", value: "#ff7f50" },
    { name: "Dark Orange", value: "#ff8c00" },
    { name: "Khaki", value: "#f0e68c" },
    { name: "Beige", value: "#f5f5dc" },
    { name: "Mint", value: "#98ff98" },
    { name: "Sea Green", value: "#2e8b57" },
    { name: "Forest Green", value: "#228b22" },
    { name: "Light Sky Blue", value: "#87cefa" },
    { name: "Steel Blue", value: "#4682b4" },
    { name: "Royal Blue", value: "#4169e1" },
    { name: "Slate Blue", value: "#6a5acd" },
    { name: "Lavender", value: "#e6e6fa" },
    { name: "Plum", value: "#dda0dd" },
    { name: "Orchid", value: "#da70d6" },
    { name: "Hot Pink", value: "#ff69b4" },
    { name: "Deep Pink", value: "#ff1493" },
    { name: "Chocolate", value: "#d2691e" },
];

const COLORS: TagColorOption[] = BASE_COLORS.map((color) => ({
    ...color,
    textColor: getContrastTextColor(color.value),
}));

type ColorPickerMenuProps = {
    onSelectColor: (color: TagColorOption) => void;
};

export const ColorPickerMenu: React.FC<ColorPickerMenuProps> = ({ onSelectColor }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (color: TagColorOption) => {
        onSelectColor(color);
        handleClose();
    };

    return (
        <>
            <IconButton
                color="neutral"
                size="sm"
                sx={{ ml: "5px" }}
                variant="outlined"
                onClick={handleOpen}
            >
                <PaletteIcon />
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                className="custom-scrollbar"
                open={Boolean(anchorEl)}
                placement="bottom-start"
                sx={{ zIndex: 10010, maxHeight: "300px", overflowY: "scroll" }}
                onBlur={handleClose}
                onClose={handleClose}
            >
                {COLORS.map((color) => (
                    <MenuItem key={color.value} onClick={() => handleSelect(color)}>
                        <ListItemDecorator>
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "16px",
                                    height: "16px",
                                    borderRadius: "50%",
                                    backgroundColor: color.value,
                                    border: "1px solid #ccc",
                                }}
                            />
                        </ListItemDecorator>
                        {color.name}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};
