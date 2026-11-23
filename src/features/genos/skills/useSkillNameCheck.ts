import { useEffect, useState } from "react";

import { useAuth } from "../../../context/authState";
import { fetchNameCheck, type NameCheck } from "./skillsApi";

/** How long the name must sit still before the server is asked (one question, not one per key). */
export const NAME_CHECK_DELAY_MS = 400;

type Query = {
    teamId: string;
    skillId: string;
    slug: string;
    visibility: "private" | "team" | "specific" | "public";
};

const keyOf = (q: Query) => `${q.teamId}|${q.skillId}|${q.visibility}|${q.slug}`;

/**
 * The live "is this name free?" check of the skill editor (MIP-2210). A name is unique among your
 * own skills, among the team's shared skills when it is shared with the team, and among all public
 * skills when it is public; the server knows which, and words the answer.
 *
 * Returns the server's answer for exactly what is typed now, or `null` while nothing applies yet:
 * `query` is `null` (the name is unchanged, locked or badly formed, which the form already says),
 * the question is still waiting out the typing pause or in flight, or the request failed. A failed
 * check says nothing: saving is checked by the server again, so the person is never blocked by it.
 */
export const useSkillNameCheck = (query: Query | null): NameCheck | null => {
    const { accessToken } = useAuth();
    const [answer, setAnswer] = useState<{ key: string; check: NameCheck } | null>(null);
    const key = query ? keyOf(query) : null;
    // `query` is rebuilt on every render; the key is what identifies the question.
    const { teamId, skillId, slug, visibility } = query ?? {
        teamId: "",
        skillId: "",
        slug: "",
        visibility: "private" as const,
    };

    useEffect(() => {
        if (!key || !accessToken) return;
        let live = true;
        const timer = window.setTimeout(() => {
            void fetchNameCheck(accessToken, {
                teamId,
                skillId,
                slug: slug.trim().toLowerCase(),
                visibility,
            }).then((res) => {
                if (live && res.ok) setAnswer({ key, check: res.data });
            });
        }, NAME_CHECK_DELAY_MS);
        return () => {
            live = false;
            window.clearTimeout(timer);
        };
    }, [accessToken, key, teamId, skillId, slug, visibility]);

    return key && answer?.key === key ? answer.check : null;
};
