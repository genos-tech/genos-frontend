import { Stack, Switch, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};

/**
 * The location-sharing opt-out toggle.
 *
 * Split out of `UserProfileLocation` so it can sit to the RIGHT of the
 * local-time chip rather than beneath the location row — the three read
 * as one line ("<Location> <Time> <Toggle>"). The flag governs what YOUR
 * row discloses, so it only appears on your own card; the server rejects
 * the write for anyone else, and it would be meaningless on their card
 * anyway (their sharing preference isn't yours to set).
 */
export const UserProfileLocationShare = ({ myself, setMyself, user }: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    const isSelfView = myself.userId === user?.userId;
    if (!isSelfView) return null;

    // Absent means shared (server default), so only an explicit `false` is off.
    const isShared = myself.locationShared !== false;

    // Flip the opt-out. Persists to the server (which re-gates every roster
    // row for this user) and mirrors into localStorage so the toggle keeps
    // its state across a reload without a round-trip.
    const persistSharing = (nextShared: boolean) => {
        updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            locationShared: nextShared,
        });
        setMyself({ ...myself, locationShared: nextShared });
        localStorage.setItem("locationShared", nextShared ? "true" : "false");
    };

    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
            title={t.admin.userProfile.locationShareHint}
        >
            <Switch
                checked={isShared}
                size="sm"
                onChange={(e) => persistSharing(e.target.checked)}
            />
            <Typography sx={{ color: styles.labelColor, fontSize: "12px" }}>
                {isShared
                    ? t.admin.userProfile.locationShared
                    : t.admin.userProfile.locationHidden}
            </Typography>
        </Stack>
    );
};
