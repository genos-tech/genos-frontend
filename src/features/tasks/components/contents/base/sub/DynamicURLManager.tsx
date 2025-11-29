import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, IconButton, Input, Snackbar, Stack, Tooltip, Typography } from "@mui/joy";
import { useEffect, useState } from "react";

import { GitHubIcon } from "../../../../../../assets/GithubIcon";
import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type LinkItem = {
    id: string;
    url: string;
    title: string;
    isGitHub: boolean;
};

type DynamicURLManagerProps = {
    taskContent?: TaskProps;
    setTaskContent?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};

export const DynamicURLManager = (props: DynamicURLManagerProps) => {
    const { taskContent, setTaskContent, setTaskUpdated } = props;
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

    // Initialize links from taskContent
    useEffect(() => {
        const initialLinks: LinkItem[] = [];

        // Load existing GitHub link
        if (taskContent?.links) {
            initialLinks.push(
                ...taskContent.links.map((link) => ({
                    id: `link-${link.id}`,
                    url: link.url,
                    title: link.title,
                    isGitHub: isGitHubURL(link.url),
                }))
            );
        }

        setLinks(initialLinks);
    }, [taskContent?.links]);

    // Handle adding a new link
    const handleAddLink = async () => {
        if (!isValidUrl(newUrl)) {
            setErrorOpen(true);
            setError("Please enter a valid URL.");
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
            setError("Please enter a valid URL.");
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
                        placeholder="Paste URL"
                        size="sm"
                        sx={{ width: "250px", height: "30px" }}
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <Input
                        placeholder="Title (optional)"
                        size="sm"
                        sx={{ width: "200px", height: "30px" }}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                    />
                    <Button color="primary" size="sm" variant="outlined" onClick={handleAddLink}>
                        Add
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
                        Cancel
                    </Button>
                </Stack>
            ) : (
                <Button
                    color="neutral"
                    size="sm"
                    startDecorator={<AddIcon />}
                    variant="plain"
                    onClick={() => setIsAddingNew(true)}
                >
                    Add Link
                </Button>
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
                    placeholder="Paste URL"
                    size="sm"
                    sx={{ width: "250px", height: "30px" }}
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                />
                <Input
                    placeholder="Title"
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
                    Save
                </Button>
                <Button color="neutral" size="sm" variant="plain" onClick={() => onEdit(null)}>
                    Cancel
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
            <Tooltip size="sm" title="Edit" variant="outlined">
                <IconButton color="neutral" size="sm" onClick={() => onEdit(link.id)}>
                    <EditIcon />
                </IconButton>
            </Tooltip>
            <Tooltip size="sm" title="Delete" variant="outlined">
                <IconButton color="danger" size="sm" onClick={() => onDelete(link.id)}>
                    <DeleteIcon />
                </IconButton>
            </Tooltip>
        </Stack>
    );
};
