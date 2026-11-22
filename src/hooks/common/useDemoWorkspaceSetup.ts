import { useCallback, useEffect, useRef, useState } from "react";

import { postDemoWorkspaceStatus } from "../../features/admin/services/demoSignin";

/**
 * Where the demo sign-in leaves the "the sample workspace is still being built" note (MIP-1879).
 * Session storage, not local: it must not outlive the tab, and only the demo sign-in sets it.
 */
export const DEMO_WORKSPACE_PENDING_KEY = "demoWorkspacePending";

const POLL_MS = 1500;
const GIVE_UP_MS = 90_000;

export type DemoSetupState = "idle" | "pending" | "failed";

const flagged = (): boolean => {
    try {
        return window.sessionStorage.getItem(DEMO_WORKSPACE_PENDING_KEY) === "1";
    } catch {
        return false;
    }
};

const clearFlag = () => {
    try {
        window.sessionStorage.removeItem(DEMO_WORKSPACE_PENDING_KEY);
    } catch {
        /* storage unavailable: nothing to clear */
    }
};

/**
 * After a demo sign-in the api returns at once and builds the sample workspace in the background.
 * While the sign-in left its flag, ask `POST /user/demo/workspace/` every 1.5 s. `pending` shows a
 * light banner; `ready` clears the flag and reloads once (the seeded chats and projects are not
 * pushed over the socket, so one reload is the plain way to show them all); `failed` (the api's
 * word, or 90 s without an answer) offers a retry. A real user, or a demo visitor whose workspace
 * was ready at sign-in, never has the flag: `idle`, no request.
 */
export const useDemoWorkspaceSetup = (accessToken: string | null | undefined) => {
    const [state, setState] = useState<DemoSetupState>(() => (flagged() ? "pending" : "idle"));
    const [attempt, setAttempt] = useState(0);
    const startedAt = useRef(0);

    useEffect(() => {
        if (!accessToken || state === "idle" || state === "failed") return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (startedAt.current === 0) startedAt.current = Date.now();

        const tick = async () => {
            const status = await postDemoWorkspaceStatus(accessToken);
            if (cancelled) return;
            if (status === "ready" || status === "gone") {
                clearFlag();
                if (status === "ready") window.location.reload();
                else setState("idle");
                return;
            }
            if (status === "failed" || Date.now() - startedAt.current > GIVE_UP_MS) {
                setState("failed");
                return;
            }
            timer = setTimeout(() => void tick(), POLL_MS);
        };
        void tick();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [accessToken, state, attempt]);

    const retry = useCallback(() => {
        startedAt.current = 0;
        setState("pending");
        setAttempt((n) => n + 1);
    }, []);

    return { state, retry };
};
