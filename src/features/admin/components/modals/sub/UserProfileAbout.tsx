import { useEffect, useState } from "react";
import { Box, Button, FormHelperText, Stack, Textarea, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileMarkdown } from "../../../../../components/ui/misc/ProfileMarkdown";
import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

// Mirrors `ABOUT_ME_MAX_LENGTH` in the API's user serializer. Duplicated
// rather than fetched: the point of the client-side copy is that the
// counter can be wrong-by-being-stricter and still be useful, whereas a
// round-trip to learn the limit would show the user a rejection after
// they'd finished writing.
const MAX_LENGTH = 500;

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};

/**
 * The self-introduction: free text, rendered as restricted markdown.
 *
 * Awaits the save and only commits locally on success, like the display-
 * name editor and unlike the fire-and-forget status / role pickers. The
 * difference is what's at stake in a failure: re-picking a role off a
 * list costs a click, whereas silently dropping a paragraph someone wrote
 * loses the writing.
 */
export const UserProfileAbout = ({ myself, setMyself, user }: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const isSelfView = myself.userId === user?.userId;
    const about = (isSelfView ? myself.aboutMe : user?.aboutMe) ?? "";

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(about);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editing) setDraft(about);
    }, [about, editing]);

    const trimmed = draft.trim();
    const tooLong = trimmed.length > MAX_LENGTH;

    const handleSave = async () => {
        if (tooLong) return;
        if (trimmed === about) {
            setEditing(false);
            return;
        }
        setSaving(true);
        setError(null);
        const result = await updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            aboutMe: trimmed,
        });
        setSaving(false);
        if (!result) {
            setError(t.admin.userProfile.aboutSaveError);
            return;
        }
        setMyself({ ...myself, aboutMe: trimmed });
        localStorage.setItem("aboutMe", trimmed);
        setEditing(false);
    };

    if (editing) {
        return (
            <Stack spacing={1}>
                <Textarea
                    disabled={saving}
                    error={tooLong}
                    maxRows={8}
                    minRows={3}
                    placeholder={t.admin.userProfile.aboutPlaceholder}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                />
                <FormHelperText
                    sx={{ color: tooLong ? "var(--joy-palette-danger-500)" : styles.labelColor }}
                >
                    {fmt(t.admin.userProfile.aboutCounter, {
                        count: trimmed.length,
                        max: MAX_LENGTH,
                    })}
                </FormHelperText>
                {error && (
                    <FormHelperText sx={{ color: "var(--joy-palette-danger-500)" }}>
                        {error}
                    </FormHelperText>
                )}
                <Stack direction="row" spacing={0.5}>
                    <Button
                        disabled={tooLong}
                        loading={saving}
                        size="sm"
                        variant="soft"
                        onClick={() => void handleSave()}
                    >
                        {t.common.profileEdit.save}
                    </Button>
                    <Button
                        color="neutral"
                        disabled={saving}
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            setDraft(about);
                            setError(null);
                            setEditing(false);
                        }}
                    >
                        {t.common.profileEdit.cancel}
                    </Button>
                </Stack>
            </Stack>
        );
    }

    if (!about && !isSelfView) return null;

    return (
        <Box
            component={isSelfView ? "button" : "div"}
            sx={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                p: 0,
                cursor: isSelfView ? "pointer" : "default",
            }}
            onClick={isSelfView ? () => setEditing(true) : undefined}
        >
            {about ? (
                <ProfileMarkdown isDark={isDark} text={about} />
            ) : (
                <Typography sx={{ color: styles.labelColor, fontSize: "14px" }}>
                    {t.admin.userProfile.aboutNotSet}
                </Typography>
            )}
        </Box>
    );
};
