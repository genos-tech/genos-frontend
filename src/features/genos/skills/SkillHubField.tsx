import { Box, Button, Chip, FormControl, FormHelperText, FormLabel, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { StarButton } from "./SkillHub";
import type { SkillRow } from "./skillsApi";

type FieldProps = {
    skill: SkillRow;
    /** Opens the "Publish to the Hub" dialog. */
    onPublish: () => void;
    /** Opens the "Stop sharing publicly" confirmation. */
    onUnpublish: () => void;
    busy: boolean;
};

/**
 * Who can use the skill beyond the team (MIP-2047): "Publish to the Hub" for the owner of a skill
 * that is not public, and the way back for one that is. Drawn under the visibility toggle, only for
 * the owner and only while the server's `GENOS_SKILLS_PUBLIC` switch is on.
 */
export const SkillHubField = ({ skill, onPublish, onUnpublish, busy }: FieldProps) => {
    const { t } = useTranslation();
    const h = t.settings.genosSkills.hub;
    const isPublic = skill.visibility === "public";
    return (
        <FormControl>
            <FormLabel>{h.field.label}</FormLabel>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                {isPublic ? (
                    <>
                        <Chip color="success" size="sm" variant="soft">
                            {h.field.public}
                        </Chip>
                        <Button disabled={busy} size="sm" variant="outlined" onClick={onUnpublish}>
                            {h.field.unpublish}
                        </Button>
                    </>
                ) : (
                    <Button disabled={busy} size="sm" variant="outlined" onClick={onPublish}>
                        {h.field.publish}
                    </Button>
                )}
            </Box>
            <FormHelperText>{isPublic ? h.field.publicHelp : h.field.publishHelp}</FormHelperText>
        </FormControl>
    );
};

type StripProps = {
    skill: SkillRow;
    onStar: () => void;
};

/**
 * What a public skill's page says about it before the text (MIP-2047): who wrote it, which version
 * is shown, how many stars, uses and copies, and the star. Plain text for the numbers: they are
 * read, not controlled.
 */
export const SkillHubStrip = ({ skill, onStar }: StripProps) => {
    const { t } = useTranslation();
    const h = t.settings.genosSkills.hub;
    const byline = skill.isOfficial
        ? h.official
        : skill.author
          ? fmt(h.byHandle, { handle: skill.author.handle })
          : "";
    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
            }}
        >
            <Typography
                level="body-sm"
                sx={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}
            >
                {[
                    byline,
                    skill.author?.displayName ?? "",
                    fmt(h.version, { n: skill.publishedVersionNo }),
                    fmt(h.uses, { n: skill.runCount30d }),
                    fmt(h.copies, { n: skill.copyCount }),
                ]
                    .filter(Boolean)
                    .join(" · ")}
            </Typography>
            {skill.mine ? (
                <Typography level="body-sm">{fmt(h.starsOwn, { n: skill.starCount })}</Typography>
            ) : (
                <StarButton skill={skill} onStar={onStar} />
            )}
        </Box>
    );
};
