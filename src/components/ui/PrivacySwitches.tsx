import { Box, FormControl, FormLabel, Switch, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";

interface PrivacySwitchesProps {
    isPrivate: boolean;
    isHidden: boolean;
    /** Who may switch: the project owner, or a group's owner or editor. Others see the state only. */
    canEdit: boolean;
    /** A cross-team group must stay private (the server refuses otherwise): Private is shown on and
     *  cannot be switched off, while Hidden stays switchable (MIP-1949). */
    privateLocked?: boolean;
    busy?: boolean;
    errorMessage?: string | null;
    /** Called with the NEXT pair. Making the item public clears Hidden, as the server does. */
    onChange: (next: { isPrivate: boolean; isHidden: boolean }) => void;
}

/** The two separate switches of a project or group chat (MIP-1699): Private (join by request)
 *  and Hidden (name not visible to non-members, invitation only). Hidden needs Private. */
export function PrivacySwitches({
    isPrivate,
    isHidden,
    canEdit,
    privateLocked = false,
    busy = false,
    errorMessage,
    onChange,
}: PrivacySwitchesProps) {
    const { t } = useTranslation();
    const copy = t.common.privacy;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
            <FormControl orientation="horizontal" sx={{ gap: 1.5, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FormLabel sx={{ color: g.text.primary, fontWeight: 600 }}>
                        {copy.privateLabel}
                    </FormLabel>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {privateLocked ? copy.privateLockedHint : copy.privateHint}
                    </Typography>
                </Box>
                <Switch
                    checked={isPrivate || privateLocked}
                    disabled={!canEdit || busy || privateLocked}
                    slotProps={{ input: { "aria-label": copy.privateLabel } }}
                    onChange={(e) =>
                        onChange({
                            isPrivate: e.target.checked,
                            isHidden: e.target.checked ? isHidden : false,
                        })
                    }
                />
            </FormControl>
            <FormControl orientation="horizontal" sx={{ gap: 1.5, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FormLabel sx={{ color: g.text.primary, fontWeight: 600 }}>
                        {copy.hiddenLabel}
                    </FormLabel>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {isPrivate || privateLocked ? copy.hiddenHint : copy.hiddenNeedsPrivate}
                    </Typography>
                </Box>
                <Switch
                    checked={isHidden && (isPrivate || privateLocked)}
                    disabled={!canEdit || busy || !(isPrivate || privateLocked)}
                    slotProps={{ input: { "aria-label": copy.hiddenLabel } }}
                    onChange={(e) =>
                        onChange({
                            isPrivate: isPrivate || privateLocked,
                            isHidden: e.target.checked,
                        })
                    }
                />
            </FormControl>
            {errorMessage && (
                <Typography level="body-xs" role="alert" sx={{ color: g.danger.text }}>
                    {errorMessage}
                </Typography>
            )}
        </Box>
    );
}
