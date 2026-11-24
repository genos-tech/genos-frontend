import { ReactElement, useCallback, useRef, useState } from "react";
import { FormControl, FormLabel, Input } from "@mui/joy";

import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import { confirmPassword, getRecentAuthToken } from "../../../services/recentAuth";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * "Enter your password again" before an API key, a webhook or an AI-app connection is made
 * (MIP-2240). The one `ConfirmDialog` with a password field in it, so it looks, focuses and
 * dismisses like every other confirmation.
 *
 * `run(token)` is the creating call. It first runs with the token still inside its window (or
 * none); when the server refuses with "enter your password" (`isRefused`), the dialog asks, and
 * the call runs once more with the new token. Cancelling returns the refused result, so the
 * caller does what it does for any refusal (nothing, for these three).
 *
 *     const { guard, dialog } = useRecentAuthPrompt();
 *     const res = await guard((token) => createApiKey(accessToken, { ...input, recentAuthToken: token }),
 *                             (r) => r.status === "recent_auth");
 *     ...
 *     return <>{page}{dialog}</>;
 */
export const useRecentAuthPrompt = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const m = t.common.recentAuth;
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const settle = useRef<((token: string | null) => void) | null>(null);

    const finish = useCallback((token: string | null) => {
        setOpen(false);
        setPassword("");
        setError(null);
        const resolve = settle.current;
        settle.current = null;
        resolve?.(token);
    }, []);

    const ask = useCallback(
        () =>
            new Promise<string | null>((resolve) => {
                // A second ask while one is open ends the first as cancelled.
                settle.current?.(null);
                settle.current = resolve;
                setPassword("");
                setError(null);
                setOpen(true);
            }),
        []
    );

    const submit = async () => {
        if (busy || !password) return;
        setBusy(true);
        setError(null);
        const res = await confirmPassword(accessToken, password);
        setBusy(false);
        if (res.status === "ok") return finish(res.token);
        // Nothing to ask for this account: the server will not have refused it, so this is
        // only reached on a race; let the caller try again without a token.
        if (res.status === "not_required") return finish("");
        setError(
            res.status === "wrong" ? m.wrong : res.status === "throttled" ? m.tooMany : m.failed
        );
    };

    const guard = useCallback(
        async <R,>(
            run: (token: string | undefined) => Promise<R>,
            isRefused: (r: R) => boolean
        ) => {
            const first = await run(getRecentAuthToken() ?? undefined);
            if (!isRefused(first)) return first;
            const token = await ask();
            if (token === null) return first;
            return run(token || undefined);
        },
        [ask]
    );

    const dialog: ReactElement = (
        <ConfirmDialog
            busy={busy}
            cancelLabel={m.cancel}
            confirmDisabled={!password}
            confirmLabel={m.confirm}
            description={m.description}
            error={error}
            open={open}
            title={m.title}
            onClose={() => finish(null)}
            onConfirm={submit}
        >
            <FormControl sx={{ mt: 1 }}>
                <FormLabel>{m.passwordLabel}</FormLabel>
                <Input
                    autoComplete="current-password"
                    disabled={busy}
                    name="current-password"
                    type="password"
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                />
            </FormControl>
        </ConfirmDialog>
    );

    return { guard, dialog };
};
