import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { Chip, Tooltip } from "@mui/joy";

type ExternalChipProps = {
    /** What to show. The other team's name where we know it, otherwise a
     *  word like "External" — never nothing, because a bare icon in a row
     *  of rows is decoration people stop seeing. */
    label: string;
    /** Longer explanation on hover. Omit only where the label is already
     *  the whole story. */
    hint?: string;
    /** Chip height. `sm` on list rows, `md` beside a modal or pane title. */
    size?: "sm" | "md";
    /** Cap for a long team name. Defaults to 120px. */
    maxWidth?: number;
};

/**
 * "This belongs to / involves another team."
 *
 * One component for every surface that has to say it — chat rows and pane
 * headers, note folders, the GM profile, a person's profile — because the
 * mark has to be recognizable as the SAME mark wherever it appears. Four
 * separately-styled badges are four things to learn, and a reader who has
 * to learn them checks none of them.
 *
 * The icon is what carries the meaning, so it renders even when the label
 * is a team name: on the guest side the chip reads as the owning team's
 * name, and a team name alone does not say a wall is being crossed.
 */
export const ExternalChip = ({ label, hint, size = "sm", maxWidth = 120 }: ExternalChipProps) => {
    const chip = (
        <Chip
            color="warning"
            size={size}
            startDecorator={<ShareRoundedIcon sx={{ fontSize: size === "sm" ? 12 : 14 }} />}
            variant="soft"
            sx={{
                flexShrink: 0,
                fontSize: size === "sm" ? "0.65rem" : "0.7rem",
                maxWidth,
                "--Chip-gap": "2px",
            }}
        >
            {label}
        </Chip>
    );
    if (!hint) return chip;
    return (
        <Tooltip size="sm" title={hint} variant="outlined">
            {chip}
        </Tooltip>
    );
};
