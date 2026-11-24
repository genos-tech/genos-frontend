import { useEffect } from "react";

import { SkillRunCardDialog } from "./SkillRunCardDialog";
import {
    registerSkillRunCardHost,
    settleSkillRunConfirmation,
    useSkillRunRequest,
} from "./skillRunCardStore";

/**
 * The one place the first-run card is drawn (MIP-2192): idle until the ask flow calls
 * `requestSkillRunConfirmation`. Mounted once in `App`; it draws nothing of its own while no
 * request is open (a closed dialog renders no DOM).
 */
export const SkillRunCardHost = () => {
    const request = useSkillRunRequest();
    useEffect(() => registerSkillRunCardHost(), []);
    return (
        <SkillRunCardDialog
            request={request}
            onResolve={(confirmed) => {
                if (request) settleSkillRunConfirmation(request, confirmed);
            }}
        />
    );
};
