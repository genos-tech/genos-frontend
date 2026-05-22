import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, IconButton, Input, Snackbar, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { GitHubIcon } from "../../../../../../assets/GithubIcon";
import { useTranslation } from "../../../../../../i18n";
import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type LinkItem = {
    id: string;
    url: string;
    title: string;
    isGitHub: boolean;
    // Carried through from `task.links` so saves preserve the flag.
    // Without this, the initial mapping below would strip it and every
    // save would wipe `isAutoLinked` from every link, breaking the
    // PR-column persistence path (Source 2 in `pulls-for-task`).
    isAutoLinked?: boolean;
};

type DynamicURLManagerProps = {
    taskContent?: TaskProps;
    setTaskContent?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};

export const DynamicURLManager = (props: DynamicURLManagerProps) => {
    const { taskContent, setTaskContent, setTaskUpdated } = props;
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newUrl, setNewUrl] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [error, setError] = useState("");
    const [errorOpen, setErrorOpen] = useState(false);

    // Check if URL is a GitHub link
    const isGitHubURL = (url: string): boolean => {
        return /^https:\/\/github\.com\/.+/.test(url);
    };

    // Validate URL
    const isValidUrl = (inputUrl: string): boolean => {
        try {
            new URL(inputUrl);
            return true;
        } catch {
            return false;
        }
    };

    // Initialize links from taskContent. We use `link.id` as-is rather
    // than re-prefixing it — earlier this re-mapped to `link-${link.id}`
    // which (a) wrote prefixed ids back into `taskContent.links` and
    // (b) re-prefixed them on every render, so the local-state id and
    // the persisted id drifted apart over time. With ids stable, the
    // delete handler's filter matches reliably and the save round-trip
    // preserves the same id end-to-end.
    useEffect(() => {
        const initialLinks: LinkItem[] = [];
        if (taskContent?.links) {
            initialLinks.push(
                ...taskContent.links.map((link) => ({
                    id: link.id,
                    url: link.url,
                    title: link.title,
                    isGitHub: isGitHubURL(link.url),
                    isAutoLinked: link.isAutoLinked,
                }))
            );
        }
        setLinks(initialLinks);
    }, [taskContent?.links]);

    // Handle adding a new link
    const handleAddLink = async () => {
        if (!isValidUrl(newUrl)) {
            setErrorOpen(true);
            setError(t.tasks.dynamicUrl.invalidUrl);
            return;
        }

        let pageTitle: string = newTitle;
        if (pageTitle === "") {
            pageTitle = await getPageTitle(newUrl);
            if (!pageTitle) {
                pageTitle = newUrl;
            }
        }

        const isGitHub = isGitHubURL(newUrl);
        const newLink: LinkItem = {
            id: `link-${Date.now()}`,
            url: newUrl,
            title: pageTitle,
            isGitHub,
        };

        const updatedLinks = [...links, newLink];
        setLinks(updatedLinks);
        updateTaskContent(updatedLinks);

        // Reset form
        setNewUrl("");
        setNewTitle("");
        setIsAddingNew(false);
        setError("");
    };

    // Handle editing a link
    const handleEditLink = async (id: string, url: string, title: string) => {
        if (!isValidUrl(url)) {
            setErrorOpen(true);
            setError(t.tasks.dynamicUrl.invalidUrl);
            return;
        }

        let pageTitle: string = title;
        if (pageTitle === "") {
            pageTitle = await getPageTitle(url);
            if (!pageTitle) {
                pageTitle = url;
            }
        }

        const isGitHub = isGitHubURL(url);
        const updatedLinks = links.map((link) =>
            link.id === id ? { ...link, url, title: pageTitle, isGitHub } : link
        );

        setLinks(updatedLinks);
        updateTaskContent(updatedLinks);
        setEditingId(null);
        setError("");
    };

    // Handle deleting a link
    const handleDeleteLink = (id: string) => {
        const updatedLinks = links.filter((link) => link.id !== id);
        setLinks(updatedLinks);
        updateTaskContent(updatedLinks);
    };

    // Update task content with new links
    const updateTaskContent = (updatedLinks: LinkItem[]) => {
        if (taskContent && setTaskContent) {
            setTaskContent({
                ...taskContent,
                links: updatedLinks,
            });

            if (setTaskUpdated) {
                setTaskUpdated(true);
            }
        }
    };

    return (
        <Box sx={{ width: "100%" }}>
            {/* Display existing links */}
            {links.map((link) => (
                <LinkDisplay
                    key={link.id}
                    editingId={editingId}
                    link={link}
                    onDelete={handleDeleteLink}
                    onEdit={setEditingId}
                    onSave={handleEditLink}
                />
            ))}

            {/* Add new link form */}
            {isAddingNew ? (
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="flex-start"
                    spacing={1}
                    sx={{ mt: 1 }}
                >
                    <LinkIcon sx={{ color: "text.secondary" }} />
                    <Input
                        placeholder={t.tasks.dynamicUrl.urlPlaceholder}
                        size="sm"
                        sx={{ width: "250px", height: "30px" }}
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <Input
                        placeholder={t.tasks.dynamicUrl.titlePlaceholder}
                        size="sm"
                        sx={{ width: "200px", height: "30px" }}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                    />
                    <Button color="primary" size="sm" variant="outlined" onClick={handleAddLink}>
                        {t.tasks.dynamicUrl.addButton}
                    </Button>
                    <Button
                        color="neutral"
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            setIsAddingNew(false);
                            setNewUrl("");
                            setNewTitle("");
                            setError("");
                        }}
                    >
                        {t.tasks.dynamicUrl.cancelButton}
                    </Button>
                </Stack>
            ) : (
                // Inline CTA pill, matching the "Add dependencies"
                // empty-state in `TaskDependenciesBlock` so the two
                // metadata-panel call-to-actions read as a single
                // visual system rather than competing button styles.
                <Box
                    sx={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.6,
                        p: 0.6,
                        px: 1.4,
                        borderRadius: "8px",
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.6)",
                        transition: "background 0.15s ease, color 0.15s ease",
                        "&:hover": {
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)",
                        },
                    }}
                    onClick={() => setIsAddingNew(true)}
                >
                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                        {t.tasks.dynamicUrl.addLinkButton}
                    </Typography>
                </Box>
            )}

            {/* Error Snackbar */}
            {error && (
                <Snackbar
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    autoHideDuration={5000}
                    color="danger"
                    open={errorOpen}
                    variant="soft"
                    onClose={(event, reason) => {
                        if (reason === "clickaway") {
                            return;
                        }
                        setErrorOpen(false);
                    }}
                >
                    {error}
                </Snackbar>
            )}
        </Box>
    );
};

// Link display component
type LinkDisplayProps = {
    link: LinkItem;
    editingId: string | null;
    onEdit: (id: string | null) => void;
    onSave: (id: string, url: string, title: string) => void;
    onDelete: (id: string) => void;
};

const LinkDisplay = ({ link, editingId, onEdit, onSave, onDelete }: LinkDisplayProps) => {
    const { t } = useTranslation();
    const [editUrl, setEditUrl] = useState(link.url);
    const [editTitle, setEditTitle] = useState(link.title);

    useEffect(() => {
        if (editingId !== link.id) {
            setEditUrl(link.url);
            setEditTitle(link.title);
        }
    }, [editingId, link]);

    const LinkIconComponent = link.isGitHub ? GitHubIcon : LinkIcon;

    if (editingId === link.id) {
        return (
            <Stack
                alignItems="center"
                direction="row"
                justifyContent="flex-start"
                spacing={1}
                sx={{ mt: 1 }}
            >
                <LinkIconComponent sx={{ color: "text.secondary" }} />
                <Input
                    placeholder={t.tasks.dynamicUrl.urlPlaceholder}
                    size="sm"
                    sx={{ width: "250px", height: "30px" }}
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                />
                <Input
                    placeholder={t.tasks.dynamicUrl.titlePlaceholderShort}
                    size="sm"
                    sx={{ width: "200px", height: "30px" }}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                />
                <Button
                    color="primary"
                    size="sm"
                    variant="outlined"
                    onClick={() => onSave(link.id, editUrl, editTitle)}
                >
                    {t.tasks.dynamicUrl.saveButton}
                </Button>
                <Button color="neutral" size="sm" variant="plain" onClick={() => onEdit(null)}>
                    {t.tasks.dynamicUrl.cancelButton}
                </Button>
            </Stack>
        );
    }

    return (
        <Stack alignItems="center" direction="row" justifyContent="flex-start">
            <LinkIconComponent sx={{ color: "text.secondary" }} />
            <Typography
                sx={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "500px",
                    marginLeft: "10px",
                }}
            >
                <a href={link.url} rel="noopener noreferrer" target="_blank">
                    {link.title}
                </a>
            </Typography>
            {/* Edit / Delete buttons are hidden for auto-linked entries:
                Source 2 in `pulls-for-task` uses the `isAutoLinked` flag
                for PR-column persistence, and those entries are owned by
                the auto-discovery effect in TaskMainBlock. Editing or
                deleting one by hand would either get reintroduced on the
                next discovery pass or break the column. */}
            {!link.isAutoLinked && (
                <>
                    <Tooltip size="sm" title={t.tasks.dynamicUrl.editTooltip} variant="outlined">
                        <IconButton color="neutral" size="sm" onClick={() => onEdit(link.id)}>
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip size="sm" title={t.tasks.dynamicUrl.deleteTooltip} variant="outlined">
                        <IconButton color="danger" size="sm" onClick={() => onDelete(link.id)}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </>
            )}
        </Stack>
    );
};
