import { useCallback, useEffect, useRef, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Box, Button, Chip, Input, Option, Select, Typography } from "@mui/joy";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { toast } from "../../../components/ui/feedback/toastStore";
import { MoreMenu } from "../../../components/ui/MoreMenu";
import { PlainButton } from "../../../components/ui/PlainButton";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { relativeTimeLabel } from "../../spotlight/SpotlightContent";
import { ProjectTagChip } from "../../tasks/components/ProjectTagChip";
import {
    chipsOf,
    fetchHub,
    fetchHubTags,
    setSkillStar,
    type HubSort,
    type HubTag,
    type SkillRow,
} from "./skillsApi";

/** How long the search waits for the next keystroke before it asks the server. */
export const HUB_SEARCH_DEBOUNCE_MS = 300;
const PAGE = 24;

type Props = {
    onOpen: (skill: SkillRow) => void;
    onCopy: (skill: SkillRow) => void;
    onReport: (skill: SkillRow) => void;
};

type Page =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "ready"; skills: SkillRow[]; hasMore: boolean; more: "idle" | "loading" };

/**
 * The "Genos Hub" tab of the Skills page (MIP-2047): the public skills of every team, searched by
 * words and by tag, sorted by stars, by when the newest version was published, or by how many
 * different people ran them. One request per search, sort or tag change and one per "Show more":
 * the server answers a page in a fixed number of queries.
 */
export const SkillHub = ({ onOpen, onCopy, onReport }: Props) => {
    const { t, locale } = useTranslation();
    const h = t.settings.genosSkills.hub;
    const { accessToken } = useAuth();
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<HubSort>("stars");
    const [tag, setTag] = useState("");
    const [tags, setTags] = useState<HubTag[]>([]);
    const [page, setPage] = useState<Page>({ status: "loading" });

    // What the search box says reaches the server a moment after the last keystroke.
    useEffect(() => {
        const timer = window.setTimeout(() => setQuery(text.trim()), HUB_SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [text]);

    useEffect(() => {
        let live = true;
        void fetchHubTags(accessToken).then((res) => {
            if (live && res.ok) setTags(res.data.slice(0, 12));
        });
        return () => {
            live = false;
        };
    }, [accessToken]);

    // Only the newest request may set the page: a slow answer for a search already replaced must
    // not be drawn under the new one.
    const latest = useRef(0);
    const load = useCallback(async () => {
        const mine = ++latest.current;
        setPage({ status: "loading" });
        const res = await fetchHub(accessToken, { q: query, tag, sort, limit: PAGE });
        if (mine !== latest.current) return;
        setPage(
            res.ok
                ? {
                      status: "ready",
                      skills: res.data.skills,
                      hasMore: res.data.hasMore,
                      more: "idle",
                  }
                : { status: "failed" }
        );
    }, [accessToken, query, tag, sort]);

    useEffect(() => {
        // The directory is a fetch whose answer sets the state; the first render has nothing to draw.
        void load();
    }, [load]);

    const showMore = async () => {
        if (page.status !== "ready" || page.more === "loading") return;
        const mine = ++latest.current;
        const shown = page.skills.length;
        setPage({ ...page, more: "loading" });
        const res = await fetchHub(accessToken, {
            q: query,
            tag,
            sort,
            limit: PAGE,
            offset: shown,
        });
        if (mine !== latest.current) return;
        if (!res.ok) {
            toast.error(res.message || h.loadFailed);
            setPage({ ...page, more: "idle" });
            return;
        }
        const seen = new Set(page.skills.map((s) => s.id));
        setPage({
            status: "ready",
            skills: [...page.skills, ...res.data.skills.filter((s) => !seen.has(s.id))],
            hasMore: res.data.hasMore,
            more: "idle",
        });
    };

    const star = async (skill: SkillRow) => {
        const next = !skill.starred;
        const apply = (starred: boolean, delta: number) =>
            setPage((prev) =>
                prev.status === "ready"
                    ? {
                          ...prev,
                          skills: prev.skills.map((s) =>
                              s.id === skill.id
                                  ? { ...s, starred, starCount: Math.max(0, s.starCount + delta) }
                                  : s
                          ),
                      }
                    : prev
            );
        // The star shows at once and is taken back if the server refuses (a daily limit, a skill
        // that was just taken down).
        apply(next, 0);
        const res = await setSkillStar(accessToken, skill.id, next);
        if (!res.ok) {
            apply(!next, 0);
            toast.error(res.message || h.starFailed);
            return;
        }
        // The total moves only for an account that counts: read it from the server next time.
        void load();
    };

    const filtered = text.trim() !== "" || tag !== "";
    return (
        <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
                <Input
                    aria-label={h.searchLabel}
                    placeholder={h.searchPlaceholder}
                    size="sm"
                    slotProps={{ input: { maxLength: 80, type: "search" } }}
                    startDecorator={<SearchRoundedIcon />}
                    sx={{ flex: "1 1 220px", minWidth: 0 }}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                />
                <Select
                    aria-label={h.sortLabel}
                    size="sm"
                    slotProps={{ button: { "aria-label": h.sortLabel } }}
                    sx={{ flex: "0 1 180px", minWidth: 0 }}
                    value={sort}
                    onChange={(_e, value) => value && setSort(value)}
                >
                    <Option value="stars">{h.sort.stars}</Option>
                    <Option value="recent">{h.sort.recent}</Option>
                    <Option value="uses">{h.sort.uses}</Option>
                </Select>
            </Box>

            {tags.length > 0 && (
                <Box
                    aria-label={h.tagsLabel}
                    role="group"
                    sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                >
                    {tags.map((entry) => (
                        <Chip
                            key={entry.tag}
                            color={tag === entry.tag ? "primary" : "neutral"}
                            size="sm"
                            slotProps={{ action: { "aria-pressed": tag === entry.tag } }}
                            variant={tag === entry.tag ? "solid" : "outlined"}
                            onClick={() => setTag(tag === entry.tag ? "" : entry.tag)}
                        >
                            {entry.tag}
                        </Chip>
                    ))}
                </Box>
            )}

            {page.status === "loading" ? (
                <SkeletonRows count={3} label={h.loading} />
            ) : page.status === "failed" ? (
                <ErrorState
                    data-error="genos-skills-hub"
                    size="sm"
                    title={h.loadFailed}
                    onRetry={() => void load()}
                />
            ) : page.skills.length === 0 ? (
                <EmptyState
                    body={filtered ? h.emptyFilteredBody : h.emptyBody}
                    data-empty="genos-skills-hub"
                    size="sm"
                    title={filtered ? h.emptyFilteredTitle : h.emptyTitle}
                />
            ) : (
                <>
                    <Box
                        component="ul"
                        sx={{
                            listStyle: "none",
                            m: 0,
                            p: 0,
                            minWidth: 0,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: "lg",
                        }}
                    >
                        {page.skills.map((skill) => (
                            <HubRow
                                key={skill.id}
                                skill={skill}
                                when={
                                    skill.publishedAt
                                        ? relativeTimeLabel(skill.publishedAt, t.spotlight, locale)
                                        : ""
                                }
                                onCopy={() => onCopy(skill)}
                                onOpen={() => onOpen(skill)}
                                onReport={() => onReport(skill)}
                                onStar={() => void star(skill)}
                            />
                        ))}
                    </Box>
                    {page.hasMore && (
                        <Button
                            loading={page.more === "loading"}
                            size="sm"
                            sx={{ alignSelf: "center" }}
                            variant="outlined"
                            onClick={() => void showMore()}
                        >
                            {h.showMore}
                        </Button>
                    )}
                </>
            )}
        </Box>
    );
};

type RowProps = {
    skill: SkillRow;
    when: string;
    onOpen: () => void;
    onCopy: () => void;
    onReport: () => void;
    onStar: () => void;
};

const HubRow = ({ skill, when, onOpen, onCopy, onReport, onStar }: RowProps) => {
    const { t } = useTranslation();
    const l = t.settings.genosSkills.list;
    const h = t.settings.genosSkills.hub;
    const name = skill.title || t.settings.genosSkills.untitled;
    const byline = skill.isOfficial
        ? h.official
        : skill.author
          ? fmt(h.byHandle, { handle: skill.author.handle })
          : "";
    const meta = [
        byline,
        fmt(h.uses, { n: skill.runCount30d }),
        fmt(h.copies, { n: skill.copyCount }),
        skill.publishedVersionNo > 0 ? fmt(l.version, { n: skill.publishedVersionNo }) : "",
        when ? fmt(h.published, { when }) : "",
    ]
        .filter(Boolean)
        .join(" · ");
    const items = [
        {
            id: "open",
            label: l.view,
            icon: <VisibilityOutlinedIcon />,
            onClick: onOpen,
        },
        {
            id: "copy",
            kind: "copyLink" as const,
            label: l.copy,
            icon: <ContentCopyRoundedIcon />,
            onClick: onCopy,
            visible: !skill.mine,
        },
        {
            id: "report",
            label: l.report,
            icon: <FlagOutlinedIcon />,
            onClick: onReport,
            visible: !skill.mine,
        },
    ];
    return (
        <Box
            component="li"
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.5,
                minWidth: 0,
                borderTop: "1px solid",
                borderColor: "divider",
                "&:first-of-type": { borderTop: "none" },
            }}
        >
            <PlainButton
                aria-label={name}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "block",
                    textAlign: "start",
                    p: 1.5,
                    borderRadius: "lg",
                }}
                onClick={onOpen}
            >
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                    {skill.icon && <span aria-hidden>{skill.icon}</span>}
                    <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
                        {name}
                    </Typography>
                    <Typography
                        level="body-xs"
                        sx={{ color: "text.tertiary", fontFamily: "monospace" }}
                    >
                        /{skill.slug}
                    </Typography>
                    {skill.isOfficial && (
                        <Chip color="primary" size="sm" variant="soft">
                            {h.official}
                        </Chip>
                    )}
                    {skill.toolLevel === "act" && (
                        <Chip size="sm" variant="outlined">
                            {h.proposesChanges}
                        </Chip>
                    )}
                </Box>
                {skill.description && (
                    <Typography
                        level="body-sm"
                        sx={{
                            mt: 0.5,
                            overflowWrap: "anywhere",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {skill.description}
                    </Typography>
                )}
                {skill.tags.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                        {chipsOf(skill).map((chip) => (
                            <ProjectTagChip
                                key={chip.name}
                                label={chip.name}
                                tagColor={chip.color}
                            />
                        ))}
                    </Box>
                )}
                <Typography level="body-xs" sx={{ mt: 0.75, color: "text.tertiary" }}>
                    {meta}
                </Typography>
            </PlainButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, p: 1, flexShrink: 0 }}>
                <StarButton skill={skill} onStar={onStar} />
                <MoreMenu
                    ariaLabel={fmt(l.actionsAria, { name })}
                    items={items}
                    placement="bottom-end"
                    triggerSize={32}
                />
            </Box>
        </Box>
    );
};

/** The star and its total: one tap to star, one to take it back. */
export const StarButton = ({
    skill,
    onStar,
}: {
    skill: Pick<SkillRow, "starred" | "starCount" | "title">;
    onStar: () => void;
}) => {
    const { t } = useTranslation();
    const h = t.settings.genosSkills.hub;
    return (
        <Button
            aria-label={fmt(skill.starred ? h.unstarAria : h.starAria, { name: skill.title })}
            aria-pressed={skill.starred}
            color={skill.starred ? "warning" : "neutral"}
            size="sm"
            startDecorator={skill.starred ? <StarRoundedIcon /> : <StarBorderRoundedIcon />}
            sx={{ minHeight: 32, px: 1 }}
            variant="plain"
            onClick={onStar}
        >
            {skill.starCount}
        </Button>
    );
};
