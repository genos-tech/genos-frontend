import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../i18n";

/** The API said 404: the note was deleted. No Retry, it could never succeed (MIP-1307). */
export const NoteGoneState = () => {
    const { t } = useTranslation();
    return (
        <EmptyState
            body={t.notes.placeholder.noteNotFoundBody}
            data-empty="note-gone"
            icon={<DescriptionOutlinedIcon />}
            title={t.notes.placeholder.noteNotFoundTitle}
            fill
        />
    );
};
