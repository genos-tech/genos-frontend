import { useDemoWorkspaceSetup } from "../../hooks/common/useDemoWorkspaceSetup";
import { useTranslation } from "../../i18n";
import { Toast } from "../ui/feedback/Toast";

/**
 * "Setting up your sample workspace…" (MIP-1879).
 *
 * The demo sign-in returns before the sample workspace content is built. This light, non-blocking
 * banner stays at the top while the app asks the api whether it is ready (it reloads once when
 * it is), and offers a retry if the build failed or took too long. Nothing renders for a real
 * user or a demo visitor whose workspace was ready at sign-in.
 */
export const DemoWorkspaceSetupBanner = ({
    accessToken,
}: {
    accessToken: string | null | undefined;
}) => {
    const { t } = useTranslation();
    const { state, retry } = useDemoWorkspaceSetup(accessToken);
    const s = t.common.feedback.demoSetup;
    return (
        <Toast
            action={state === "failed" ? { label: s.retry, onClick: retry } : undefined}
            duration={null}
            open={state !== "idle"}
            placement="top"
            tone={state === "failed" ? "warning" : "neutral"}
        >
            {state === "failed" ? s.failed : s.preparing}
        </Toast>
    );
};
