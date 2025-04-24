import React, { useState } from 'react';
import { Menu, MenuItem, IconButton, ListItemDecorator } from '@mui/joy';
import PaletteIcon from '@mui/icons-material/Palette';

import { TagColorOption } from '../../../types/tasks';


const COLORS: TagColorOption[] = [
    { name: 'Red', value: '#ff2323', textColor: 'white' },
    { name: 'Green', value: '#1dc200', textColor: 'white' },
    { name: 'Blue', value: '#0044c2', textColor: 'white' },
    { name: 'Yellow', value: '#ffff23', textColor: 'black' },
    { name: 'Orange', value: '#ffa823', textColor: 'black' },
    { name: 'Purple', value: '#8e23ff', textColor: 'white' },
    { name: 'Pink', value: '#ff238a', textColor: 'white' },
    { name: 'Black', value: '#000000', textColor: 'white' },
    { name: 'White', value: '#ffffff', textColor: 'black' },
];

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
            <IconButton size='sm' onClick={handleOpen} variant="outlined" color="neutral" sx={{ ml: '5px' }}>
                <PaletteIcon />
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                onBlur={handleClose}
                placement="bottom-start"
                sx={{ zIndex: 10010 }}
            >
                {COLORS.map((color) => (
                    <MenuItem key={color.value} onClick={() => handleSelect(color)}>
                        <ListItemDecorator>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: color.value,
                                    border: '1px solid #ccc',
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
