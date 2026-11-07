import { ReactNode, useId, useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Input } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import { ModalFrame, ModalFrameSize } from "./ModalFrame";

/**
 * The one confirmation dialog (MIP-1125). Every delete, leave and
 * "are you sure" in the app goes through this, so they all look, focus and
 * dismiss the same way. Built on `ModalFrame` (flat surface, host-derived
 * stacking, events fenced at the portal).
 *
 * Destructive: the confirm button is a flat `danger.solid` (the brand
 * gradient belongs to the primary action only) and focus starts on Cancel,
 * so an Enter pressed by reflex keeps the data. A non-destructive dialog
 * focuses its confirm button. With `confirmPhrase` the confirm button stays
 * disabled until the exact phrase is typed, and focus starts in that field,
 * since the person must type there before anything else.
 *
 * While the action runs the dialog is "busy": confirm shows progress and is
 * disabled, Cancel is disabled, and Esc, the backdrop and a second Enter do
 * nothing, so a half-finished delete cannot be dismissed out of sight.
 *
 * Who closes it is the caller's choice. By default `onConfirm` is just run:
 * most delete flows close themselves at the point that fits them (some close
 * first and delete optimistically). Set `closeOnConfirm` and the dialog calls
 * `onClose` once `onConfirm` settles; a `false` result or a throw keeps it
 * open, and a throw shows its message.
 */

type Props = {
    open: boolean;
    title: string;
    /** Under the title. A node, so a name can be bold inside the sentence. */
    description?: ReactNode;
    /** The thing acted on (a task's title, say), set apart under the description. */
    entityName?: string;
    /** Extra content under the description (a warning list, a checkbox). */
    children?: ReactNode;
    icon?: ReactNode;
    confirmLabel: string;
    cancelLabel: string;
    /** Red confirm, focus on Cancel. For anything that removes data. */
    destructive?: boolean;
    /** The exact text to type before Confirm enables. */
    confirmPhrase?: string;
    /** Names the field; falls back to the phrase itself. Pass it localized. */
    confirmPhraseLabel?: string;
    /** Caller-owned in-flight flag (the caller runs the action itself). */
    busy?: boolean;
    /** Caller-owned error (the caller catches its own failures). */
    error?: string | null;
    /** Disable Confirm for a caller-owned reason (an unticked checkbox). */
    confirmDisabled?: boolean;
    /** See the component note. Default false: the caller closes. */
    closeOnConfirm?: boolean;
    /** Runs on Confirm. May be async; a throw shows its message in the dialog. */
    onConfirm: () => Promise<unknown> | unknown;
    onClose: () => void;
    zIndex?: number;
    hostZIndex?: number;
    size?: ModalFrameSize;
    /** Overrides the default (alertdialog when destructive, else dialog). */
    role?: "dialog" | "alertdialog";
    /** Marker on the dialog element, e.g. "brand" / "danger". */
    tone?: string;
};

export const ConfirmDialog = ({
    open,
    title,
    description,
    entityName,
    children,
    icon,
    confirmLabel,
    cancelLabel,
    destructive = false,
    confirmPhrase,
    confirmPhraseLabel,
    busy: busyProp = false,
    error: errorProp = null,
    confirmDisabled = false,
    closeOnConfirm = false,
    onConfirm,
    onClose,
    zIndex,
    hostZIndex,
    size = "sm",
    role,
    tone,
}: Props) => {
    const { t } = useTranslation();
    const [running, setRunning] = useState(false);
    const [thrown, setThrown] = useState<string | null>(null);
    const [typed, setTyped] = useState("");
    const phraseId = useId();

    const busy = busyProp || running;
    const error = errorProp ?? thrown;
    const phraseOk = confirmPhrase == null || typed.trim() === confirmPhrase.trim();

    const close = () => {
        if (busy) return;
        setThrown(null);
        setTyped("");
        onClose();
    };

    const confirm = async () => {
        // The button is disabled, but Enter on a focused field and stray
        // events reach this handler too.
        if (busy || confirmDisabled || !phraseOk) return;
        setRunning(true);
        setThrown(null);
        try {
            const result = await onConfirm();
            setRunning(false);
            if (closeOnConfirm && result !== false) {
                setTyped("");
                onClose();
            }
        } catch (err) {
            setRunning(false);
            setThrown(err instanceof Error && err.message ? err.message : t.common.errors.generic);
        }
    };

    return (
        <ModalFrame
            closable={false}
            description={description}
            dismissible={!busy}
            hostZIndex={hostZIndex}
            icon={icon}
            open={open}
            role={role ?? (destructive ? "alertdialog" : "dialog")}
            size={size}
            title={title}
            tone={tone ?? (destructive ? "danger" : "brand")}
            zIndex={zIndex}
            actions={
                <>
                    <Button
                        autoFocus={destructive && confirmPhrase == null}
                        color="neutral"
                        disabled={busy}
                        size="md"
                        variant="outlined"
                        sx={{
                            borderColor: g.border.default,
                            "&:focus-visible": focusRing,
                        }}
                        onClick={close}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        autoFocus={!destructive && confirmPhrase == null}
                        color={destructive ? "danger" : "primary"}
                        disabled={confirmDisabled || !phraseOk}
                        loading={busy}
                        size="md"
                        variant="solid"
                        sx={{
                            fontWeight: 500,
                            "&:focus-visible": focusRing,
                            ...(destructive && {
                                // Flat, real red. Never the brand gradient.
                                background: g.danger.solid,
                                color: g.danger.solidFg,
                                "&:not(.Mui-disabled):not(.MuiButton-loading):hover": {
                                    background: g.danger.solid,
                                    filter: "brightness(0.94)",
                                },
                            }),
                        }}
                        onClick={confirm}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
            onClose={close}
        >
            {entityName && (
                <Box
                    sx={{
                        ...type("title-sm"),
                        mb: 1,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: g.radius.md,
                        background: g.hover,
                        color: g.text.primary,
                        overflowWrap: "anywhere",
                    }}
                >
                    {entityName}
                </Box>
            )}
            {children}
            {confirmPhrase != null && (
                <Box sx={{ mt: 1 }}>
                    <Box
                        component="label"
                        htmlFor={phraseId}
                        sx={{
                            ...type("body-sm"),
                            display: "block",
                            mb: 0.5,
                            color: g.text.secondary,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {confirmPhraseLabel ?? confirmPhrase}
                    </Box>
                    <Input
                        autoComplete="off"
                        disabled={busy}
                        id={phraseId}
                        name="confirm-phrase"
                        slotProps={{ input: { spellCheck: false, autoCapitalize: "off" } }}
                        value={typed}
                        autoFocus
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void confirm();
                            }
                        }}
                    />
                </Box>
            )}
            {error && (
                <Alert
                    color="danger"
                    size="sm"
                    startDecorator={<WarningAmberIcon />}
                    sx={{ mt: 1.5, overflowWrap: "anywhere" }}
                >
                    {error}
                </Alert>
            )}
        </ModalFrame>
    );
};
