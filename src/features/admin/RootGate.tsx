import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { resolveLoggedInLandingPath } from "../../utils/lastWorkspacePath";

/**
 * The address `/` (MIP-1747).
 *
 * A signed-out visitor sees the public home page, so the address people paste, link to
 * and type has a page a crawler and a link preview can read. Someone still signed in goes
 * where they always went: their last workspace page, or the team picker.
 *
 * It reads the same flag `GuestGuard` reads, straight from storage, and mounts no auth
 * provider: the marketing pages stay isolated from the auth stack.
 */
export const RootGate = ({ children }: { children: ReactNode }) =>
    localStorage.getItem("isSigningIn") === "yes" ? (
        <Navigate to={resolveLoggedInLandingPath()} replace />
    ) : (
        <>{children}</>
    );
