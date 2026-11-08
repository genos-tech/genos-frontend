import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Dropdown, IconButton, MenuButton } from "@mui/joy";

import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { fmt, useTranslation } from "../../../../i18n";

// (22px box + 7px each side = 36px tall hit area)
const TOUCH_OVERHANG = "-7px";

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
                sx={{
                    "--IconButton-size": "22px",
                    minHeight: 22,
                    minWidth: 22,
                    position: "relative",
                    // A fingertip needs more than 22px (it measured 24x22 at 390 wide). The
                    // hit area grows, the box does not: the chip row keeps its height, so
                    // the message list does not reflow on a phone.
                    "@media (pointer: coarse)": {
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            insetBlock: TOUCH_OVERHANG,
                            insetInline: "-4px",
                        },
                    },
                }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <MenuSurface placement="bottom-end">
                <MenuRow onClick={onDownload}>{t.common.actions.download}</MenuRow>
                <MenuRow onClick={onImportAsNote}>{t.notes.importMd.importAsNote}</MenuRow>
            </MenuSurface>
        </Dropdown>
    );
};
