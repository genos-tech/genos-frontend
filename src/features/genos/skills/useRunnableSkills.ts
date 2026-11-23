import { useEffect, useMemo, useState } from "react";

import { useOptionalAccessToken } from "../../../context/authState";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { mentionKey, type AgentMentionCandidate } from "../../agentQA/mentions/types";
import { fetchRunnableSkills, type RunnableSkill } from "./skillsApi";

const toCandidate = (s: RunnableSkill): AgentMentionCandidate => {
    const ref = { kind: "skill", skillId: s.id, label: s.slug } as const;
    return {
        ref,
        trigger: "/",
        key: mentionKey(ref),
        description: s.description || undefined,
        skillGroup: s.group,
        skillOwner: s.ownerName || undefined,
        skillTitle: s.title,
    };
};

/**
 * The skills the `/` menu of Spotlight and the Genos page offers (MIP-2042): what this member may
 * run in their team, asked once when the input mounts.
 *
 * `undefined` means there is no `/` menu: Skills is switched off on the server (its 404), the
 * request failed, or it has not answered yet. A failure never breaks the input, it just leaves `/`
 * as the plain character it always was. `[]` is a workspace with Skills and nothing to run yet.
 */
export const useRunnableSkills = (enabled = true): AgentMentionCandidate[] | undefined => {
    const accessToken = useOptionalAccessToken();
    const teamId = useHashMentionData().myself?.teamId;
    const [rows, setRows] = useState<RunnableSkill[] | undefined>(undefined);

    useEffect(() => {
        if (!enabled || !accessToken || !teamId) return;
        let live = true;
        void fetchRunnableSkills(accessToken, String(teamId)).then((res) => {
            if (live) setRows(res.ok ? res.data : undefined);
        });
        return () => {
            live = false;
        };
    }, [enabled, accessToken, teamId]);

    return useMemo(() => (enabled ? rows?.map(toCandidate) : undefined), [enabled, rows]);
};
