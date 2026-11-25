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
        skillTags: s.tagChips.length > 0 ? s.tagChips : undefined,
    };
};

/**
 * The skills the `/` menu of Spotlight and the Genos page offers (MIP-2042): what this member may
 * run in their team, asked when the input mounts and again whenever the window regains focus (the
 * Genos page stays mounted for hours; a skill made or shared meanwhile must show up).
 *
 * `undefined` means there is no `/` menu: Skills is switched off on the server (its 404), the
 * request failed, or it has not answered yet. A failure never breaks the input, it just leaves `/`
 * as the plain character it always was. `[]` is a workspace with Skills and nothing to run yet.
 * A different team or account never sees the previous one's list: it is dropped before the new
 * one is asked for.
 */
export const useRunnableSkills = (enabled = true): AgentMentionCandidate[] | undefined => {
    const rows = useRunnableSkillRows(enabled);
    return useMemo(() => (enabled ? rows?.map(toCandidate) : undefined), [enabled, rows]);
};

/** The same list as rows, for a surface that draws its own choice (the schedule form's skill
 *  picker, MIP-2045). Same rules: `undefined` while it loads, when Skills is off, or on a failure. */
export const useRunnableSkillRows = (enabled = true): RunnableSkill[] | undefined => {
    const accessToken = useOptionalAccessToken();
    const teamId = useHashMentionData().myself?.teamId;
    const [rows, setRows] = useState<RunnableSkill[] | undefined>(undefined);

    useEffect(() => {
        setRows(undefined);
        if (!enabled || !accessToken || !teamId) return;
        let live = true;
        const load = () => {
            void fetchRunnableSkills(accessToken, String(teamId)).then((res) => {
                if (live) setRows(res.ok ? res.data : undefined);
            });
        };
        load();
        window.addEventListener("focus", load);
        return () => {
            live = false;
            window.removeEventListener("focus", load);
        };
    }, [enabled, accessToken, teamId]);

    return enabled ? rows : undefined;
};
