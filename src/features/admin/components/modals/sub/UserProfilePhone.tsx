import { useEffect, useState } from "react";
import LocalPhoneRoundedIcon from "@mui/icons-material/LocalPhoneRounded";
import { Button, Input, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

// Matches `CustomUser.phone_number`. Enforced here so the user hears
// about it while typing rather than through a silent failed PUT.
const MAX_LENGTH = 20;

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};

/**
 * The phone row. Optional, self-editable, and absent for everyone else
 * when unset.
 *
 * Free text rather than a formatted input on purpose: the useful contents
 * of this field include extensions, a country code the user writes their
 * own way, and "Signal only". A phone widget that insists on E.164 would
 * reject most of that and buy nothing — nothing dials from this string,
 * it gets read by a human.
 *
 * The field can also be missing entirely rather than empty: the server
 * omits `phoneNumber` from roster rows built for someone outside the team
 * (see `_without_phone`), so a guest gets `undefined` here and this
 * renders nothing at all — the same as for a colleague who never set one.
 */
export const UserProfilePhone = ({ myself, setMyself, user }: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const isSelfView = myself.userId === user?.userId;
    const phone = (isSelfView ? myself.phoneNumber : user?.phoneNumber) ?? "";

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(phone);
    const [saving, setSaving] = useState(false);

    // Re-seed the draft when the modal is pointed at someone else, so a
    // half-typed number can't follow the view to another profile.
    useEffect(() => {
        if (!editing) setDraft(phone);
    }, [phone, editing]);

    const handleSave = async () => {
        const next = draft.trim();
        if (next === phone) {
            setEditing(false);
            return;
        }
        setSaving(true);
        const result = await updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            phoneNumber: next,
        });
        setSaving(false);
        if (!result) return;
        setMyself({ ...myself, phoneNumber: next });
        localStorage.setItem("phoneNumber", next);
        setEditing(false);
    };

    if (editing) {
        return (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Input
                    disabled={saving}
                    placeholder={t.admin.userProfile.phonePlaceholder}
                    size="sm"
                    slotProps={{ input: { maxLength: MAX_LENGTH } }}
                    sx={{ maxWidth: 260 }}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSave();
                        if (e.key === "Escape") {
                            setDraft(phone);
                            setEditing(false);
                        }
                    }}
                />
                <Button
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
                        setDraft(phone);
                        setEditing(false);
                    }}
                >
                    {t.common.profileEdit.cancel}
                </Button>
            </Stack>
        );
    }

    // Nothing to show and nothing they can do about it — someone else's
    // blank phone row is just an empty label taking up space.
    if (!phone && !isSelfView) return null;

    return (
        <Typography
            component={isSelfView ? "button" : "span"}
            startDecorator={
                <LocalPhoneRoundedIcon fontSize="small" sx={{ color: styles.accentColor }} />
            }
            sx={{
                userSelect: "text",
                color: phone ? styles.valueColor : styles.labelColor,
                fontSize: "14px",
                background: "none",
                border: "none",
                p: 0,
                textAlign: "left",
                cursor: isSelfView ? "pointer" : "default",
                "&:hover": isSelfView ? { color: styles.accentColor } : undefined,
            }}
            onClick={isSelfView ? () => setEditing(true) : undefined}
        >
            {phone || t.admin.userProfile.phoneNotSet}
        </Typography>
    );
};
