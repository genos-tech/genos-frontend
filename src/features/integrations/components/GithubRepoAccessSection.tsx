import { useCallback, useEffect, useState } from "react";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    Typography,
} from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import {
    GithubAccessibleReposResponse,
    GithubRepoOwner,
    listAccessibleRepos,
} from "../services/github";
import { redirectToOAuthConnect } from "../services/oauth";

/**
 * "Repository access" — which GitHub accounts and organizations Genos can
 * currently reach, and how to add one that's missing.
 *
 * There is deliberately no repo PICKER here, because the integration
 * can't have one: it's a classic OAuth App holding the account-wide
 * `repo` scope, not a GitHub App with per-repo installation. The
 * consequences that actually matter to a user are:
 *
 *   - A repo created in their own account is reachable immediately —
 *     nothing to configure, which is why "I can't add repos later" is
 *     usually a false alarm for personal repos.
 *   - An ORGANIZATION's repos are reachable only once that org has
 *     granted the OAuth App access. That grant lives on GitHub, and for
 *     orgs with third-party application restrictions an owner has to
 *     approve the request.
 *
 * So this panel shows what's visible (an ungranted org is conspicuous by
 * its absence) and links to the two places that change it: GitHub's
 * per-application settings page, and a re-authorize round trip that
 * refreshes the token's grants.
 */
export const GithubRepoAccessSection = ({ accessToken }: { accessToken: string }) => {
    const [data, setData] = useState<GithubAccessibleReposResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const res = await listAccessibleRepos(accessToken, setError);
        setLoading(false);
        if (!res || res === "github_not_connected") return;
        setData(res);
    }, [accessToken]);

    useEffect(() => {
        void load();
    }, [load]);

    const ownerIcon = (owner: GithubRepoOwner) =>
        owner.type === "Organization" ? (
            <ApartmentRoundedIcon sx={{ fontSize: 18, color: "primary.500" }} />
        ) : (
            <PersonRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        );

    return (
        <Card sx={{ p: 2 }} variant="outlined">
            <Stack spacing={1.5}>
                <Stack alignItems="center" direction="row" spacing={1}>
                    <FolderRoundedIcon sx={{ color: "primary.500" }} />
                    <Typography level="title-sm">Repository access</Typography>
                    <Box sx={{ flex: 1 }} />
                    <AppTooltip size="sm" title="Refresh">
                        <Button
                            disabled={loading}
                            size="sm"
                            startDecorator={<RefreshRoundedIcon />}
                            variant="plain"
                            onClick={() => void load()}
                        >
                            Refresh
                        </Button>
                    </AppTooltip>
                </Stack>

                <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    Genos reaches GitHub with your account&apos;s permissions, so a repo you create
                    in your own account works straight away. An <strong>organization</strong> has
                    to grant access once — if one is missing below, add it from the buttons at the
                    bottom.
                </Typography>

                {error && <Alert color="danger">{error}</Alert>}

                {loading ? (
                    <Stack alignItems="center" sx={{ py: 3 }}>
                        <CircularProgress size="sm" />
                    </Stack>
                ) : !data || data.owners.length === 0 ? (
                    <Alert color="neutral">
                        No repositories are visible yet. If you expect some, re-authorize below.
                    </Alert>
                ) : (
                    <Stack spacing={0.5}>
                        {data.owners.map((owner) => {
                            const isOpen = expandedOwner === owner.login;
                            const ownerRepos = data.repos.filter((r) => r.owner === owner.login);
                            return (
                                <Box key={owner.login}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        spacing={1}
                                        sx={{
                                            py: 0.75,
                                            px: 1,
                                            borderRadius: "sm",
                                            cursor: "pointer",
                                            "&:hover": { bgcolor: "background.level1" },
                                        }}
                                        onClick={() =>
                                            setExpandedOwner(isOpen ? null : owner.login)
                                        }
                                    >
                                        {ownerIcon(owner)}
                                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                            {owner.login}
                                        </Typography>
                                        {owner.type === "Organization" && (
                                            <Chip color="primary" size="sm" variant="soft">
                                                Org
                                            </Chip>
                                        )}
                                        <Box sx={{ flex: 1 }} />
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {owner.repo_count}{" "}
                                            {owner.repo_count === 1 ? "repo" : "repos"}
                                        </Typography>
                                        {isOpen ? (
                                            <ExpandLessRoundedIcon sx={{ fontSize: 18 }} />
                                        ) : (
                                            <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
                                        )}
                                    </Stack>
                                    {isOpen && (
                                        <Stack spacing={0.25} sx={{ pl: 4, pb: 0.75 }}>
                                            {ownerRepos.map((repo) => (
                                                <Stack
                                                    key={repo.full_name}
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={0.75}
                                                >
                                                    <Typography
                                                        component="a"
                                                        href={repo.html_url}
                                                        level="body-xs"
                                                        rel="noreferrer"
                                                        target="_blank"
                                                        sx={{
                                                            color: "text.secondary",
                                                            textDecoration: "none",
                                                            "&:hover": {
                                                                textDecoration: "underline",
                                                            },
                                                        }}
                                                    >
                                                        {repo.name}
                                                    </Typography>
                                                    {repo.private && (
                                                        <LockRoundedIcon
                                                            sx={{
                                                                fontSize: 12,
                                                                color: "text.tertiary",
                                                            }}
                                                        />
                                                    )}
                                                </Stack>
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            );
                        })}
                        {data.truncated && (
                            <Typography
                                level="body-xs"
                                sx={{ color: "text.tertiary", pt: 0.5, px: 1 }}
                            >
                                Showing the 100 most recently updated repositories.
                            </Typography>
                        )}
                    </Stack>
                )}

                <Divider />

                <Box>
                    <Typography level="body-xs" sx={{ color: "text.secondary", mb: 1 }}>
                        Missing an organization? Grant it on GitHub — for orgs that restrict
                        third-party apps an owner has to approve the request — then re-authorize
                        here so the new access takes effect.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                        {data?.manage_url && (
                            <Button
                                component="a"
                                endDecorator={<OpenInNewRoundedIcon />}
                                href={data.manage_url}
                                rel="noreferrer"
                                size="sm"
                                target="_blank"
                                variant="outlined"
                            >
                                Manage access on GitHub
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="soft"
                            onClick={() => {
                                void redirectToOAuthConnect(
                                    "github",
                                    accessToken,
                                    undefined,
                                    setError
                                );
                            }}
                        >
                            Re-authorize GitHub
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        </Card>
    );
};
