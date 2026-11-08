import { useMemo, useState } from "react";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, ListItemButton, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { BaseAvatar } from "../avatars/BaseAvatar";
import { SearchField } from "../fields/SearchField";
import { ModalFrame } from "../modal/ModalFrame";

export type TransferOwnerCandidate = {
    userId: string;
    userName: string;
    userEmail: string;
    avatarImgPath?: string;
};

type Props = {
    open: boolean;
    title: string;
    description: string;
    candidates: TransferOwnerCandidate[];
    onConfirm: (newOwnerId: string) => Promise<boolean>;
    onCancel: () => void;
};

export const ModalTransferOwner = ({
    open,
    title,
    description,
    candidates,
    onConfirm,
    onCancel,
}: Props) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (!query.trim()) return candidates;
        const q = query.toLowerCase();
        return candidates.filter(
            (m) => m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q)
        );
    }, [candidates, query]);

    const handleClose = () => {
        if (submitting) return;
        setQuery("");
        setSelectedId(null);
        setErrorMessage(null);
        onCancel();
    };

    const handleConfirm = async () => {
        if (submitting || !selectedId) return;
        setSubmitting(true);
        setErrorMessage(null);
        try {
            const ok = await onConfirm(selectedId);
            if (!ok) {
                setErrorMessage(t.common.profileEdit.transferError);
            } else {
                setQuery("");
                setSelectedId(null);
            }
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : t.common.profileEdit.transferError
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalFrame
            description={description}
            dismissible={!submitting}
            icon={<SwapHorizRoundedIcon sx={{ color: g.danger.text }} />}
            open={open}
            size="md"
            title={title}
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        disabled={submitting}
                        variant="plain"
                        onClick={handleClose}
                    >
                        {t.common.profileEdit.cancel}
                    </Button>
                    <Button
                        color="danger"
                        disabled={!selectedId || candidates.length === 0}
                        loading={submitting}
                        onClick={handleConfirm}
                    >
                        {t.common.profileEdit.transferConfirm}
                    </Button>
                </>
            }
            onClose={handleClose}
        >
            {candidates.length === 0 ? (
                <Alert color="neutral">{t.common.profileEdit.noOtherMembers}</Alert>
            ) : (
                <>
                    <SearchField
                        placeholder={t.common.profileEdit.transferPickMember}
                        sx={{ mb: 1.5 }}
                        value={query}
                        onChange={setQuery}
                    />
                    <Box
                        sx={{
                            maxHeight: 240,
                            overflow: "auto",
                            borderRadius: g.radius.md,
                            border: `1px solid ${g.border.default}`,
                            p: 0.5,
                            mb: 1,
                        }}
                    >
                        {filtered.length === 0 ? (
                            <Box sx={{ p: 2, textAlign: "center" }}>
                                <Typography level="body-sm" sx={{ color: g.text.tertiary }}>
                                    {t.common.empty.noResults}
                                </Typography>
                            </Box>
                        ) : (
                            filtered.map((m) => (
                                <ListItemButton
                                    key={`transfer-owner-${m.userId}`}
                                    selected={selectedId === m.userId}
                                    sx={{
                                        borderRadius: g.radius.sm,
                                        my: 0.25,
                                        px: 1.25,
                                        py: 0.75,
                                    }}
                                    onClick={() => setSelectedId(m.userId)}
                                >
                                    <Stack alignItems="center" direction="row" spacing={1.25}>
                                        <BaseAvatar name={m.userName} />
                                        <Stack spacing={0} sx={{ minWidth: 0 }}>
                                            <Typography
                                                level="body-sm"
                                                sx={{ fontWeight: 600, color: g.text.primary }}
                                                noWrap
                                            >
                                                {m.userName}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: g.text.tertiary }}
                                                noWrap
                                            >
                                                {m.userEmail}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </ListItemButton>
                            ))
                        )}
                    </Box>
                </>
            )}

            {errorMessage && (
                <Alert color="danger" startDecorator={<WarningAmberIcon />} sx={{ mt: 1 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
