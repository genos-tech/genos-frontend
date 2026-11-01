import { useCallback, useEffect, useState } from "react";
import AddLinkRoundedIcon from "@mui/icons-material/AddLinkRounded";
import { Alert, Box, Button, Card, FormControl, Input, Sheet, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../i18n";
import {
    listUnregisteredRepos,
    parseRepoInput,
    registerGithubRepo,
    UnregisteredRepo,
} from "../services/github";

/**
 * "Register a repository" (MIP-755).
 *
 * A webhook added by hand in GitHub's settings answers 200 and links nothing:
 * Genos only writes PRs into a team's tasks for a repo it holds a
 * registration for. Auto-registration happens when someone links a PR, but
 * that is invisible, and the manual steps used to stop at "paste the URL".
 * This makes it explicit: name a repo and register it with your own GitHub
 * connection (it takes over a hook already there), and see the repos that are
 * sending events Genos can't use yet. The server only lists the ones your own
 * GitHub account can read.
 */
export const GithubRepoRegistration = ({ accessToken }: { accessToken: string }) => {
    const { t } = useTranslation();
    const r = t.integrations.github.register;
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
        null
    );
    const [unknown, setUnknown] = useState<UnregisteredRepo[]>([]);

    const refresh = useCallback(async () => {
        const res = await listUnregisteredRepos(accessToken);
        setUnknown(res?.repos ?? []);
    }, [accessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const register = async (owner: string, repo: string) => {
        const full = `${owner}/${repo}`;
        setBusy(full);
        setMessage(null);
        const res = await registerGithubRepo(accessToken, owner, repo);
        setBusy(null);
        if (res.ok) {
            const success = r.success as Record<string, string>;
            setMessage({
                kind: "success",
                text: fmt(success[res.reason] ?? success.created, { repo: full }),
            });
            setInput("");
        } else {
            const reasons = r.reasons as Record<string, string>;
            setMessage({ kind: "error", text: reasons[res.reason] ?? reasons.request_failed });
        }
        await refresh();
    };

    const typed = parseRepoInput(input);
    const typedFull = typed ? `${typed[0]}/${typed[1]}` : null;

    const submit = () => {
        if (!typed) {
            setMessage({ kind: "error", text: r.invalid });
            return;
        }
        void register(typed[0], typed[1]);
    };

    return (
        <Card sx={{ p: 2 }} variant="outlined">
            <Stack spacing={1.5}>
                <Stack alignItems="center" direction="row" spacing={1}>
                    <AddLinkRoundedIcon sx={{ color: "primary.500" }} />
                    <Typography level="title-sm">{r.title}</Typography>
                </Stack>
                <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {r.intro}
                </Typography>

                <Stack direction="row" spacing={1}>
                    <FormControl sx={{ flex: 1 }}>
                        <Input
                            disabled={busy != null}
                            placeholder={r.placeholder}
                            size="sm"
                            slotProps={{ input: { "aria-label": r.title } }}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submit();
                            }}
                        />
                    </FormControl>
                    <Button
                        disabled={!input.trim() || busy != null}
                        loading={busy != null && busy === typedFull}
                        size="sm"
                        onClick={submit}
                    >
                        {r.button}
                    </Button>
                </Stack>

                {message && (
                    <Alert color={message.kind === "success" ? "success" : "danger"} size="sm">
                        {message.text}
                    </Alert>
                )}

                {unknown.length > 0 && (
                    <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {r.unknownTitle}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "text.secondary", mb: 1 }}>
                            {r.unknownIntro}
                        </Typography>
                        <Stack spacing={0.75}>
                            {unknown.map((u) => {
                                const full = `${u.owner}/${u.repo}`;
                                return (
                                    <Sheet
                                        key={full}
                                        sx={{ p: 1, borderRadius: "md" }}
                                        variant="soft"
                                    >
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            justifyContent="space-between"
                                            spacing={1}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography level="body-sm" noWrap>
                                                    {full}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: "text.secondary" }}
                                                >
                                                    {fmt(r.events, { count: u.event_count })}
                                                    {u.last_event
                                                        ? ` · ${fmt(r.lastEvent, { event: u.last_event })}`
                                                        : ""}
                                                </Typography>
                                            </Box>
                                            <AppTooltip
                                                disableHoverListener={u.can_admin}
                                                size="sm"
                                                title={u.can_admin ? "" : r.needsAdmin}
                                            >
                                                <span>
                                                    <Button
                                                        disabled={!u.can_admin || busy != null}
                                                        loading={busy === full}
                                                        size="sm"
                                                        variant="outlined"
                                                        onClick={() =>
                                                            void register(u.owner, u.repo)
                                                        }
                                                    >
                                                        {r.button}
                                                    </Button>
                                                </span>
                                            </AppTooltip>
                                        </Stack>
                                    </Sheet>
                                );
                            })}
                        </Stack>
                    </Box>
                )}
            </Stack>
        </Card>
    );
};
