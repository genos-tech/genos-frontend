import { useMemo, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    Alert,
    Avatar,
    Box,
    Button,
    IconButton,
    Input,
    ListItemButton,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={handleClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(232,121,195,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(232,121,195,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "480px" },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 3 },
                }}
            >
                <Box sx={{ textAlign: "center" }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 56,
                            height: 56,
                            borderRadius: "14px",
                            background:
                                "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
                            border: "1px solid rgba(232,121,195,0.25)",
                            mx: "auto",
                            mb: 2,
                        }}
                    >
                        <SwapHorizRoundedIcon
                            sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 1 }}
                    >
                        {title}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.6)", mb: 2 }}>
                        {description}
                    </Typography>
                </Box>

                {candidates.length === 0 ? (
                    <Alert
                        color="neutral"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(255,255,255,0.04)",
                        }}
                    >
                        {t.common.profileEdit.noOtherMembers}
                    </Alert>
                ) : (
                    <>
                        <Input
                            placeholder={t.common.profileEdit.transferPickMember}
                            value={query}
                            endDecorator={
                                query && (
                                    <IconButton
                                        size="sm"
                                        sx={{ minWidth: 24, minHeight: 24, borderRadius: "50%" }}
                                        variant="plain"
                                        onClick={() => setQuery("")}
                                    >
                                        <CloseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )
                            }
                            startDecorator={
                                <SearchIcon
                                    sx={{ fontSize: 18, color: "rgba(232,121,195,0.8)" }}
                                />
                            }
                            sx={{
                                mb: 1.5,
                                "--Input-radius": "10px",
                                background: "rgba(0,0,0,0.3)",
                                border: "1px solid rgba(232,121,195,0.25)",
                                fontSize: "14px",
                            }}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <Box
                            sx={{
                                maxHeight: 240,
                                overflow: "auto",
                                borderRadius: "10px",
                                border: "1px solid rgba(232,121,195,0.2)",
                                background: "rgba(0,0,0,0.15)",
                                p: 0.5,
                                mb: 2,
                            }}
                        >
                            {filtered.length === 0 ? (
                                <Box sx={{ p: 2, textAlign: "center" }}>
                                    <Typography
                                        level="body-sm"
                                        sx={{ color: "rgba(255,255,255,0.5)" }}
                                    >
                                        {t.common.empty.noResults}
                                    </Typography>
                                </Box>
                            ) : (
                                filtered.map((m) => (
                                    <ListItemButton
                                        key={`transfer-owner-${m.userId}`}
                                        selected={selectedId === m.userId}
                                        sx={{
                                            borderRadius: "8px",
                                            my: 0.25,
                                            px: 1.25,
                                            py: 0.75,
                                            // This dialog is dark in BOTH colour schemes (its
                                            // background and text are hardcoded), so the row
                                            // states have to be pinned too — left to Joy they
                                            // resolve from the active palette and light mode
                                            // painted an off-white row under white text.
                                            //
                                            // Set via Joy's own CSS variables rather than an
                                            // `&:hover` block: Joy applies hover as
                                            // `&:not(.Mui-selected, [aria-selected="true"]):hover`
                                            // — specificity (0,3,0) — which outranks a plain
                                            // `&:hover` from sx (0,2,0) whatever the source
                                            // order. That's why the override here never took
                                            // effect. Feeding the variables makes Joy's own
                                            // rule paint these colours, so there's no
                                            // specificity fight to lose.
                                            "--variant-plainHoverBg": "rgba(255,255,255,0.08)",
                                            "--variant-plainHoverColor": "rgba(255,255,255,0.9)",
                                            "--variant-plainActiveBg": "rgba(232,121,195,0.18)",
                                            "--variant-plainActiveColor": "rgba(255,255,255,0.9)",
                                            // `selected` renders through the plainActive
                                            // variant, hence the pink above; this keeps the
                                            // hover-while-selected tint distinct from it.
                                            "&.Mui-selected:hover": {
                                                background: "rgba(232,121,195,0.22)",
                                            },
                                        }}
                                        onClick={() => setSelectedId(m.userId)}
                                    >
                                        <Stack alignItems="center" direction="row" spacing={1.25}>
                                            <Avatar size="sm">{m.userName?.[0] ?? "?"}</Avatar>
                                            <Stack spacing={0} sx={{ minWidth: 0 }}>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: "rgba(255,255,255,0.9)",
                                                    }}
                                                    noWrap
                                                >
                                                    {m.userName}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: "rgba(255,255,255,0.5)" }}
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
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        disabled={submitting}
                        variant="plain"
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 3,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                        onClick={handleClose}
                    >
                        {t.common.profileEdit.cancel}
                    </Button>
                    <Button
                        disabled={!selectedId || candidates.length === 0}
                        loading={submitting}
                        sx={{
                            background: "linear-gradient(135deg, #c026a8 0%, #9d2386 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                        }}
                        onClick={handleConfirm}
                    >
                        {t.common.profileEdit.transferConfirm}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
