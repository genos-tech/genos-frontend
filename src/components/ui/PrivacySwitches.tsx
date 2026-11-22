import { Box, FormControl, FormLabel, Switch, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";

interface PrivacySwitchesProps {
    isPrivate: boolean;
    isHidden: boolean;
    /** Who may switch: the project owner, or a group's owner or editor. Others see the state only. */
    canEdit: boolean;
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
                        {copy.privateHint}
                    </Typography>
                </Box>
                <Switch
                    checked={isPrivate}
                    disabled={!canEdit || busy}
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
                        {isPrivate ? copy.hiddenHint : copy.hiddenNeedsPrivate}
                    </Typography>
                </Box>
                <Switch
                    checked={isHidden && isPrivate}
                    disabled={!canEdit || busy || !isPrivate}
                    slotProps={{ input: { "aria-label": copy.hiddenLabel } }}
                    onChange={(e) => onChange({ isPrivate, isHidden: e.target.checked })}
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
