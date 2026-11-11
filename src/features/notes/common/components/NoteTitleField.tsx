import type { Ref } from "react";
import { FormControl } from "@mui/joy";

import { InlineTitleEdit } from "../../../../components/ui/fields/InlineTitleEdit";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { useTranslation } from "../../../../i18n";

type Props = {
    value: string;
    inputRef: Ref<HTMLInputElement>;
    /** The pending title, live as the user types. */
    onDraftChange: (draft: string) => void;
    /** Enter or blur: the edit is over. */
    onCommit: () => void;
};

/**
 * The title of a note (MIP-1381), the same in every kind of note (my, team, chat, task): the
 * three note editors each carried a copy of this block, pinned to the top-left at a fixed 30% of
 * the width, so a long title was cut off at 400px of a 1440px window with 500px of empty row
 * beside it.
 *
 * It does not size itself. `GenosNoteEditor` puts it in one flex row with the wrap toggles and
 * the Saved chip, so it takes whatever the controls leave (the window, and the comments sidebar
 * being open, decide), and that row starts where the body text starts (`--note-body-start`).
 * 24px (`h2`) on a desktop, so the title reads as the title: it used to be smaller than the first
 * heading in the body. 20px on a phone, which has 390px to share with the controls.
 */
export const NoteTitleField = ({ value, inputRef, onDraftChange, onCommit }: Props) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    return (
        <FormControl sx={{ flex: 1, minWidth: 0, justifyContent: "center" }} required>
            <InlineTitleEdit
                ariaLabel={t.notes.editor.titlePlaceholder}
                inputRef={inputRef}
                level={isMobile ? "h3" : "h2"}
                placeholder={t.notes.editor.titlePlaceholder}
                value={value}
                variant="field"
                onCommit={onCommit}
                onDraftChange={onDraftChange}
            />
        </FormControl>
    );
};
