import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Dropdown, IconButton, Menu, MenuButton, MenuItem } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";

interface Props {
    /** File name, for the trigger's accessible label. */
    name: string;
    onDownload: () => void;
    onImportAsNote: () => void;
    disabled?: boolean;
}

/**
 * "Download / Import as note" menu for a markdown or text attachment.
 *
 * It sits BESIDE the attachment, not on it: clicking the attachment itself
 * still downloads, as people expect. Only offered for files that
 * `isImportableTextFile` accepts.
 */
export const AttachmentActionsMenu = ({ name, onDownload, onImportAsNote, disabled }: Props) => {
    const { t } = useTranslation();
    return (
        <Dropdown>
            <MenuButton
                aria-label={fmt(t.notes.importMd.fileActionsAria, { name })}
                disabled={disabled}
                size="sm"
                slotProps={{ root: { variant: "plain", color: "neutral" } }}
                slots={{ root: IconButton }}
                sx={{ "--IconButton-size": "22px", minHeight: 22, minWidth: 22 }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <Menu placement="bottom-end" size="sm">
                <MenuItem onClick={onDownload}>{t.common.actions.download}</MenuItem>
                <MenuItem onClick={onImportAsNote}>{t.notes.importMd.importAsNote}</MenuItem>
            </Menu>
        </Dropdown>
    );
};
