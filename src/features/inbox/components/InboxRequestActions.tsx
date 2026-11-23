import { useEffect, useRef } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Button, Stack, Typography } from "@mui/joy";

import { invisibleHitAreaSx } from "../../../components/ui/touchTargets";
import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";

type Props = {
    status: "pending" | "approved" | "rejected";
    onApprove: () => void;
    onReject: () => void;
    /** Why the answer did not go through (HTTP paths only). */
    error: string | null;
};

/**
 * Answer a request, next to the text it is about: Approve is the one solid button, Reject is
 * quiet. Once answered, the buttons give way to a quiet status line, so a settled request reads
 * as history, not as a disabled control. Both stay left-aligned with the text and wrap on a phone.
 */
export const InboxRequestActions = ({ status, onApprove, onReject, error }: Props) => {
    const { t } = useTranslation();
    const handled = status === "approved" || status === "rejected";
    const approved = status === "approved";
    // Answering removes the button that has focus: hand focus to the status that replaces it, so
    // a keyboard user is not dropped to the top of the page. Only on the change, not for a row
    // that was already settled when it appeared.
    const statusRef = useRef<HTMLElement>(null);
    const wasHandled = useRef(handled);
    useEffect(() => {
        if (handled && !wasHandled.current) statusRef.current?.focus();
        wasHandled.current = handled;
    }, [handled]);
    return (
        // Answering is not opening the card.
        <Box sx={{ mt: 1 }} onClick={(event) => event.stopPropagation()}>
            {error && (
                <Typography color="danger" level="body-xs" sx={{ mb: 0.75 }}>
                    {error}
                </Typography>
            )}
            {handled ? (
                <Typography
                    ref={statusRef}
                    aria-live="polite"
                    data-testid="inbox-request-status"
                    level="body-xs"
                    tabIndex={-1}
                    sx={{
                        color: g.text.secondary,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        "&:focus": { outline: "none" },
                    }}
                >
                    {approved ? (
                        <CheckRoundedIcon sx={{ fontSize: 16, color: g.success.text }} />
                    ) : (
                        <CloseRoundedIcon sx={{ fontSize: 16, color: g.text.tertiary }} />
                    )}
                    {approved ? t.inbox.bubble.approved : t.inbox.bubble.rejected}
                </Typography>
            ) : (
                <Stack
                    alignItems="center"
                    direction="row"
                    sx={{
                        columnGap: 1,
                        rowGap: 1,
                        flexWrap: "wrap",
                        ...invisibleHitAreaSx("& .MuiButton-root"),
                    }}
                >
                    <Button
                        size="sm"
                        startDecorator={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={onApprove}
                    >
                        {t.inbox.bubble.approve}
                    </Button>
                    <Button
                        color="neutral"
                        size="sm"
                        startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="plain"
                        sx={{
                            color: g.text.secondary,
                            "&:hover": { bgcolor: g.hover, color: g.text.primary },
                        }}
                        onClick={onReject}
                    >
                        {t.inbox.bubble.reject}
                    </Button>
                </Stack>
            )}
        </Box>
    );
};
