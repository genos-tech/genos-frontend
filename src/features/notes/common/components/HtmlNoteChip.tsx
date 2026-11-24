import WebRoundedIcon from "@mui/icons-material/WebRounded";
import { Chip } from "@mui/joy";

import { useHashMentionData } from "../../../../context/HashMentionDataContext";
import { useTranslation } from "../../../../i18n";
import { isHtmlNote } from "../utils/htmlNote";

type HtmlNoteChipProps = {
    /** Chip height: `sm` on list rows, tabs and links; `md` beside a pane or modal title. */
    size?: "sm" | "md";
};

/**
 * The mark of an HTML note (MIP-2316): the page icon and the word "HTML", the same chip wherever a
 * note is listed or linked, so "this is an HTML page" is read at a glance. The visible "HTML" is the
 * format's name and is not translated; the accessible name is (`notes.htmlNote.kindLabel`).
 *
 * It never shrinks (`flexShrink: 0`): a long title truncates before the chip does.
 */
export const HtmlNoteChip = ({ size = "sm" }: HtmlNoteChipProps) => {
    const { t } = useTranslation();
    return (
        <Chip
            aria-label={t.notes.htmlNote.kindLabel}
            color="primary"
            data-html-note-chip=""
            size={size}
            startDecorator={
                <WebRoundedIcon aria-hidden sx={{ fontSize: size === "sm" ? 12 : 14 }} />
            }
            variant="soft"
            sx={{
                flexShrink: 0,
                fontSize: size === "sm" ? "0.65rem" : "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                "--Chip-gap": "2px",
                "--Chip-minHeight": size === "sm" ? "16px" : "20px",
                verticalAlign: "middle",
            }}
        >
            HTML
        </Chip>
    );
};

/** The chip for a note whose format is known to be HTML, nothing for any other note. */
export const HtmlNoteChipFor = ({
    note,
    size,
}: {
    note: { bodyFormat?: string | null } | null | undefined;
    size?: "sm" | "md";
}) => (isHtmlNote(note) ? <HtmlNoteChip size={size} /> : null);

const PERSONAL_KINDS = new Set(["my", "shared", "team"]);

/**
 * The chip for a `#note` link in a message, task, comment or note (MIP-2316). The link stores only
 * the note's id and title, so the format is looked up in the note lists the app already holds
 * (the same ones the `#` menu uses); a note that is not in them gets no chip rather than a request.
 */
export const HashNoteHtmlMark = ({ noteKind, noteId }: { noteKind: string; noteId: number }) => {
    const { notes } = useHashMentionData();
    const family = (k: string) => (PERSONAL_KINDS.has(k) ? "personal" : k);
    const entry = notes.find(
        (n) => Number(n.noteId) === Number(noteId) && family(n.kind) === family(noteKind)
    );
    if (!isHtmlNote(entry)) return null;
    return (
        <span style={{ display: "inline-flex", marginInlineStart: 4, verticalAlign: "middle" }}>
            <HtmlNoteChip />
        </span>
    );
};
