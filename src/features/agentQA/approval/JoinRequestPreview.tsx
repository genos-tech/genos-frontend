// Structured previews for answering a request to join a project:
//
//   approve_join_request  adds the person who asked to the project and tells
//                         them. They can then see and edit the project, which
//                         is why the card says so plainly.
//   decline_join_request  closes the request and tells them no.
//
// The only argument is `inbox_item_id`. The backend turns it into
// "<requester> → <project>" when the caller may read both, from its own rows
// (never from what the requester wrote into the request). Anything it cannot
// resolve stays the number. The card prints a string as it came, and a number,
// or a string of digits, as "join request #N".

import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation, type Messages } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString } from "./previewHelpers";

/** "join request: Sam → Website Redesign", "join request #12", or "join request". */
const requestPhrase = (raw: unknown, t: Messages): string => {
    const text = asString(raw)?.trim();
    if (!text) return t.agentApproval.joinRequest;
    if (/^\d+$/.test(text)) return fmt(t.agentApproval.joinRequestWithId, { id: text });
    return fmt(t.agentApproval.joinRequestNamed, { request: text });
};

export const ApproveJoinRequestPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <PersonAddAltRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.approveJoinRequest, {
                        request: requestPhrase(args.inbox_item_id, t),
                    })}
                </Typography>
            </Box>
            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                {t.agentApproval.approveJoinRequestEffect}
            </Typography>
        </Box>
    );
};

export const DeclineJoinRequestPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <PersonOffRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.declineJoinRequest, {
                        request: requestPhrase(args.inbox_item_id, t),
                    })}
                </Typography>
            </Box>
            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                {t.agentApproval.declineJoinRequestEffect}
            </Typography>
        </Box>
    );
};
