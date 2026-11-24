import { useCallback, useEffect, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";

import {
    confirmMfaSetup,
    disableMfa,
    getMfaStatus,
    lockMinutes,
    MfaRefusal,
    MfaSetup,
    MfaStatus,
    newRecoveryCodes,
    startMfaSetup,
} from "./services/mfa";

import { ModalFrame } from "../../components/ui/modal/ModalFrame";
import { useAuth } from "../../context/authState";
import { fmt, useTranslation } from "../../i18n";
import { groupKey } from "./groupKey";
import { QrCode } from "./QrCode";

type Step = "closed" | "password" | "scan" | "recovery";
type Confirm = "closed" | "disable" | "newCodes";

// The file name is not wording, so it is not in the catalogs.
const RECOVERY_FILE_NAME = "genos-recovery-codes.txt";

// Fewer than this and the person is told to get a new set before they need one.
const LOW_RECOVERY = 3;

/**
 * Settings > Security: two-step verification with an authenticator app (MIP-2239).
 *
 * Opt-in, for password sign-ins. Turning it on is three steps in one dialog (password, scan and
 * first code, recovery codes); turning it off and getting new recovery codes each ask for the
 * password again, so a session someone else is using cannot change it. The secret and the
 * recovery codes live only in this component's state and are dropped when the dialog closes.
 */
export const TwoFactorSection = () => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const m = t.security;

    const [status, setStatus] = useState<MfaStatus | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    const [step, setStep] = useState<Step>("closed");
    const [confirm, setConfirm] = useState<Confirm>("closed");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [setup, setSetup] = useState<MfaSetup | null>(null);
    const [codes, setCodes] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<"key" | "codes" | null>(null);

    const refresh = useCallback(async () => {
        const next = await getMfaStatus(accessToken);
        setLoadFailed(next === null);
        if (next) setStatus(next);
    }, [accessToken]);

    useEffect(() => {
        let cancelled = false;
        void getMfaStatus(accessToken).then((next) => {
            if (cancelled) return;
            setLoadFailed(next === null);
            if (next) setStatus(next);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const wording = (refusal: MfaRefusal, retryAfterSeconds?: number): string => {
        switch (refusal) {
            case "bad_password":
                return m.errors.badPassword;
            case "invalid_code":
                return m.errors.invalidCode;
            case "mfa_locked":
                return fmt(m.errors.locked, { minutes: lockMinutes(retryAfterSeconds) });
            case "throttled":
                return m.errors.throttled;
            case "already_enabled":
                return m.errors.alreadyEnabled;
            case "no_setup":
                return m.errors.noSetup;
            case "network":
                return m.errors.network;
            default:
                return m.errors.generic;
        }
    };

    const reset = () => {
        setStep("closed");
        setConfirm("closed");
        setPassword("");
        setCode("");
        setSetup(null);
        setCodes([]);
        setSaved(false);
        setBusy(false);
        setError(null);
        setCopied(null);
    };

    const closeSetup = () => {
        // Recovery codes are shown once: closing before "I have saved" is allowed (the person
        // may have written them down) but the section then offers a new set.
        reset();
        void refresh();
    };

    const startSetup = async () => {
        setBusy(true);
        setError(null);
        const res = await startMfaSetup(accessToken, password);
        setBusy(false);
        if (!res.ok) {
            if (res.code === "already_enabled") void refresh();
            setError(wording(res.code, res.retryAfterSeconds));
            return;
        }
        setPassword("");
        setSetup(res.data);
        setStep("scan");
    };

    const finishSetup = async () => {
        setBusy(true);
        setError(null);
        const res = await confirmMfaSetup(accessToken, code);
        setBusy(false);
        if (!res.ok) {
            setCode("");
            setError(wording(res.code, res.retryAfterSeconds));
            return;
        }
        setSetup(null);
        setCode("");
        setCodes(res.data);
        setStep("recovery");
    };

    const runConfirm = async () => {
        setBusy(true);
        setError(null);
        if (confirm === "disable") {
            const res = await disableMfa(accessToken, password);
            setBusy(false);
            if (!res.ok) {
                setError(wording(res.code, res.retryAfterSeconds));
                return;
            }
            reset();
            void refresh();
            return;
        }
        const res = await newRecoveryCodes(accessToken, password);
        setBusy(false);
        if (!res.ok) {
            setError(wording(res.code, res.retryAfterSeconds));
            return;
        }
        setPassword("");
        setConfirm("closed");
        setCodes(res.data);
        setStep("recovery");
    };

    const copy = async (text: string, what: "key" | "codes") => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what);
        } catch {
            setCopied(null);
        }
    };

    const download = () => {
        const body = `${m.setup.downloadHeader}\n\n${codes.join("\n")}\n`;
        const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = RECOVERY_FILE_NAME;
        a.click();
        URL.revokeObjectURL(url);
    };

    const passwordField = (label: string, onEnter: () => void) => (
        <FormControl error={!!error} required>
            <FormLabel>{label}</FormLabel>
            <Input
                autoComplete="current-password"
                type="password"
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && password && !busy) {
                        e.preventDefault();
                        onEnter();
                    }
                }}
            />
        </FormControl>
    );

    const errorAlert = error && (
        <Alert color="danger" role="alert" size="sm">
            {error}
        </Alert>
    );

    // ── The panel ────────────────────────────────────────────────────────────────────────
    let body;
    if (loadFailed && !status) {
        body = (
            <Alert
                color="danger"
                size="sm"
                endDecorator={
                    <Button color="danger" size="sm" variant="soft" onClick={() => void refresh()}>
                        {m.twoFactor.retry}
                    </Button>
                }
            >
                {m.twoFactor.loadFailed}
            </Alert>
        );
    } else if (!status) {
        body = (
            <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                …
            </Typography>
        );
    } else if (!status.eligible) {
        body = (
            <Alert color="neutral" size="sm" variant="soft">
                {m.twoFactor.providerNote}
            </Alert>
        );
    } else if (!status.enabled) {
        body = (
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <Typography level="body-xs">{m.twoFactor.scopeNote}</Typography>
                <Button
                    size="sm"
                    startDecorator={<ShieldRoundedIcon />}
                    onClick={() => {
                        reset();
                        setStep("password");
                    }}
                >
                    {m.twoFactor.turnOn}
                </Button>
            </Stack>
        );
    } else {
        const low = status.recoveryCodesRemaining < LOW_RECOVERY;
        body = (
            <Stack spacing={1.5}>
                <Stack spacing={0.25}>
                    {status.enabledAt && (
                        <Typography level="body-sm">
                            {fmt(m.twoFactor.onSince, {
                                date: new Date(status.enabledAt).toLocaleDateString(locale),
                            })}
                        </Typography>
                    )}
                    <Typography level="body-sm">
                        {fmt(m.twoFactor.recoveryLeft, { count: status.recoveryCodesRemaining })}
                    </Typography>
                </Stack>
                {low && (
                    <Alert color="warning" size="sm">
                        {m.twoFactor.recoveryLow}
                    </Alert>
                )}
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    <Button
                        size="sm"
                        variant="soft"
                        onClick={() => {
                            reset();
                            setConfirm("newCodes");
                        }}
                    >
                        {m.twoFactor.newCodes}
                    </Button>
                    <Button
                        color="danger"
                        size="sm"
                        variant="soft"
                        onClick={() => {
                            reset();
                            setConfirm("disable");
                        }}
                    >
                        {m.twoFactor.turnOff}
                    </Button>
                </Stack>
            </Stack>
        );
    }

    const setupTitle = step === "recovery" ? m.setup.recoveryTitle : m.setup.title;

    return (
        <Box data-testid="two-factor-section">
            <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
            >
                <Typography level="title-sm">{m.twoFactor.title}</Typography>
                {status?.eligible && (
                    <Chip color={status.enabled ? "success" : "neutral"} size="sm" variant="soft">
                        {status.enabled ? m.twoFactor.statusOn : m.twoFactor.statusOff}
                    </Chip>
                )}
            </Stack>
            <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                {m.twoFactor.description}
            </Typography>
            {body}

            {/* Turn on: password, then scan + first code, then the recovery codes. */}
            <ModalFrame
                open={step !== "closed"}
                size="md"
                title={setupTitle}
                actions={
                    step === "password" ? (
                        <>
                            <Button color="neutral" variant="plain" onClick={closeSetup}>
                                {m.setup.cancel}
                            </Button>
                            <Button
                                disabled={!password}
                                loading={busy}
                                onClick={() => void startSetup()}
                            >
                                {m.setup.continue}
                            </Button>
                        </>
                    ) : step === "scan" ? (
                        <>
                            <Button color="neutral" variant="plain" onClick={closeSetup}>
                                {m.setup.cancel}
                            </Button>
                            <Button
                                disabled={code.replace(/\s/g, "").length !== 6}
                                loading={busy}
                                onClick={() => void finishSetup()}
                            >
                                {m.setup.verify}
                            </Button>
                        </>
                    ) : (
                        <Button disabled={!saved} onClick={closeSetup}>
                            {m.setup.done}
                        </Button>
                    )
                }
                description={
                    step === "password"
                        ? m.setup.passwordIntro
                        : step === "scan"
                          ? m.setup.scanBody
                          : step === "recovery"
                            ? m.setup.recoveryBody
                            : undefined
                }
                onClose={closeSetup}
            >
                {step === "password" && (
                    <Stack spacing={1.5}>
                        {passwordField(m.setup.passwordLabel, () => void startSetup())}
                        {errorAlert}
                    </Stack>
                )}

                {step === "scan" && setup && (
                    <Stack spacing={2}>
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                            <QrCode label={m.setup.qrAlt} value={setup.otpauthUri} />
                        </Box>
                        <Sheet sx={{ borderRadius: "md", px: 1.5, py: 1 }} variant="soft">
                            <Typography level="body-xs">{m.setup.manualTitle}</Typography>
                            <Typography
                                aria-label={m.setup.keyLabel}
                                data-testid="mfa-key"
                                dir="ltr"
                                level="title-sm"
                                sx={{
                                    fontFamily: "monospace",
                                    letterSpacing: "0.08em",
                                    mt: 0.5,
                                    overflowWrap: "anywhere",
                                    userSelect: "all",
                                }}
                            >
                                {groupKey(setup.secret)}
                            </Typography>
                            <Stack
                                direction="row"
                                spacing={0.5}
                                sx={{ flexWrap: "wrap", mt: 0.5, ms: -1 }}
                            >
                                <Button
                                    size="sm"
                                    startDecorator={<ContentCopyRoundedIcon />}
                                    variant="plain"
                                    onClick={() => void copy(setup.secret, "key")}
                                >
                                    {copied === "key" ? m.setup.copied : m.setup.copyKey}
                                </Button>
                                <Button
                                    component="a"
                                    href={setup.otpauthUri}
                                    size="sm"
                                    startDecorator={<PhoneIphoneRoundedIcon />}
                                    variant="plain"
                                >
                                    {m.setup.openInApp}
                                </Button>
                            </Stack>
                        </Sheet>
                        <FormControl error={!!error}>
                            <FormLabel>{m.setup.codeLabel}</FormLabel>
                            <Input
                                autoComplete="one-time-code"
                                sx={{ fontFamily: "monospace", letterSpacing: "0.3em" }}
                                value={code}
                                slotProps={{
                                    input: {
                                        inputMode: "numeric",
                                        maxLength: 7,
                                        pattern: "[0-9 ]*",
                                    },
                                }}
                                autoFocus
                                onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                                onKeyDown={(e) => {
                                    if (
                                        e.key === "Enter" &&
                                        code.replace(/\s/g, "").length === 6 &&
                                        !busy
                                    ) {
                                        e.preventDefault();
                                        void finishSetup();
                                    }
                                }}
                            />
                            <FormHelperText>{m.setup.codeHelp}</FormHelperText>
                        </FormControl>
                        {errorAlert}
                    </Stack>
                )}

                {step === "recovery" && (
                    <Stack spacing={2}>
                        <Sheet
                            data-testid="mfa-recovery-codes"
                            dir="ltr"
                            variant="soft"
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr" },
                                gap: 1,
                                borderRadius: "md",
                                p: 1.5,
                            }}
                        >
                            {codes.map((c) => (
                                <Typography
                                    key={c}
                                    level="title-sm"
                                    sx={{
                                        fontFamily: "monospace",
                                        letterSpacing: "0.06em",
                                        userSelect: "all",
                                    }}
                                >
                                    {c}
                                </Typography>
                            ))}
                        </Sheet>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                            <Button
                                size="sm"
                                startDecorator={<ContentCopyRoundedIcon />}
                                variant="soft"
                                onClick={() => void copy(codes.join("\n"), "codes")}
                            >
                                {copied === "codes" ? m.setup.copied : m.setup.copyAll}
                            </Button>
                            <Button
                                size="sm"
                                startDecorator={<DownloadRoundedIcon />}
                                variant="soft"
                                onClick={download}
                            >
                                {m.setup.download}
                            </Button>
                        </Stack>
                        <Checkbox
                            checked={saved}
                            label={m.setup.savedConfirm}
                            onChange={(e) => setSaved(e.target.checked)}
                        />
                    </Stack>
                )}
            </ModalFrame>

            {/* Turn off / new recovery codes: both need the password again. */}
            <ModalFrame
                open={confirm !== "closed"}
                size="sm"
                title={confirm === "disable" ? m.confirm.disableTitle : m.confirm.newCodesTitle}
                actions={
                    <>
                        <Button color="neutral" variant="plain" onClick={reset}>
                            {m.confirm.cancel}
                        </Button>
                        <Button
                            color={confirm === "disable" ? "danger" : "primary"}
                            disabled={!password}
                            loading={busy}
                            onClick={() => void runConfirm()}
                        >
                            {confirm === "disable"
                                ? m.confirm.disableAction
                                : m.confirm.newCodesAction}
                        </Button>
                    </>
                }
                description={
                    confirm === "disable" ? m.confirm.disableBody : m.confirm.newCodesBody
                }
                onClose={reset}
            >
                <Stack spacing={1.5}>
                    {passwordField(m.confirm.passwordLabel, () => void runConfirm())}
                    {errorAlert}
                </Stack>
            </ModalFrame>
        </Box>
    );
};
