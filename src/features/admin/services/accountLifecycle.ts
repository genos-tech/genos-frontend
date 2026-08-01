// Account erasure + export (GDPR). Thin wrappers over
// `/user/account/` and `/user/account/export/`; the real rules live
// server-side in `services/account_deletion.py` / `account_export.py`.

import { authApi } from "../../../services/api";

export interface BlockingTeam {
    teamId: string;
    teamName: string;
}

export interface AccountDeletionStatus {
    canDelete: boolean;
    /** OAuth-only accounts have no usable password, so the form must
     *  not demand one they can never satisfy. */
    requiresPassword: boolean;
    blockingTeams: BlockingTeam[];
}

interface StatusWire {
    can_delete: boolean;
    requires_password: boolean;
    blocking_teams: BlockingTeam[];
}

export const getAccountDeletionStatus = async (
    accessToken: string | null
): Promise<AccountDeletionStatus | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<StatusWire>("/user/account/");
        return {
            canDelete: res.data.can_delete,
            requiresPassword: res.data.requires_password,
            blockingTeams: res.data.blocking_teams ?? [],
        };
    } catch {
        // Unknown state — the panel keeps the destructive action
        // disabled rather than guessing it's safe.
        return null;
    }
};

export type DeleteAccountResult =
    | { status: "deleted" }
    | { status: "ownership_required"; teams: BlockingTeam[] }
    | { status: "bad_password" }
    | { status: "error" };

export const deleteAccount = async (
    accessToken: string | null,
    password: string
): Promise<DeleteAccountResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
    try {
        // The backend requires the literal confirmation string; the UI's
        // typed confirmation is checked there too, not just here.
        await api.delete("/user/account/", {
            data: { confirm: "DELETE", ...(password ? { password } : {}) },
        });
        return { status: "deleted" };
    } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: unknown } })?.response
            ?.status;
        if (status === 409) {
            const data = (err as { response?: { data?: { blocking_teams?: BlockingTeam[] } } })
                .response?.data;
            return { status: "ownership_required", teams: data?.blocking_teams ?? [] };
        }
        if (status === 403) return { status: "bad_password" };
        return { status: "error" };
    }
};

/** Download the export as a JSON file. Returns false on failure. */
export const downloadAccountExport = async (accessToken: string | null): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        // Blob, not JSON: the server sets Content-Disposition and we
        // hand the bytes straight to a download without re-serializing
        // (which would risk mangling the note bodies).
        const res = await api.get("/user/account/export/", { responseType: "blob" });
        const url = URL.createObjectURL(new Blob([res.data], { type: "application/json" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `genos-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return true;
    } catch {
        return false;
    }
};
