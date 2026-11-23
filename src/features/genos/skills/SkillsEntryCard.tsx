import { useEffect, useState } from "react";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import { Button, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { fetchSkills, type SkillList } from "./skillsApi";

type Props = {
    teamId: string;
    onOpen: () => void;
};

/**
 * The card in Settings > Genos that opens the Skills page.
 *
 * It asks the list once and draws nothing until the answer is a list. The skills API answers
 * 404 while the server's switch is off (and any failure reads the same: no card), so a
 * workspace that does not have Skills never sees a dead entry, and one that does sees how many
 * of the plan's skills are used.
 */
export const SkillsEntryCard = ({ teamId, onOpen }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosSkills.entry;
    const { accessToken } = useAuth();
    const [list, setList] = useState<SkillList | null>(null);

    useEffect(() => {
        if (!accessToken || !teamId) return;
        let live = true;
        void fetchSkills(accessToken, teamId, "mine").then((res) => {
            if (live && res.ok) setList(res.data);
        });
        return () => {
            live = false;
        };
    }, [accessToken, teamId]);

    if (!list) return null;
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <AutoStoriesOutlinedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {m.description}
            </Typography>
            <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1.5}>
                <Button size="sm" variant="outlined" onClick={onOpen}>
                    {m.open}
                </Button>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {list.limit === null
                        ? fmt(m.usageUnlimited, { used: list.used })
                        : fmt(m.usage, { used: list.used, limit: list.limit })}
                </Typography>
            </Stack>
        </Sheet>
    );
};
