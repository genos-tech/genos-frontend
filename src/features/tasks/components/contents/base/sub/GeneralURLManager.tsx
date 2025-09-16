import { useEffect, useState } from "react";
import { Input, Snackbar, Button, Stack, Typography, IconButton } from "@mui/joy";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";

import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type GeneralURLManagerProps = {
    generalLink: { url: string; title: string };
    taskContents?: TaskProps;
    setTaskContents?: (value: TaskProps) => void;
    isPreviewMode: boolean;
    setTaskUpdated?: (value: boolean) => void;
};
export const GeneralURLManager = (props: GeneralURLManagerProps) => {
    const { generalLink, taskContents, setTaskContents, isPreviewMode, setTaskUpdated } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [error, setError] = useState("");
    const isValidUrl = (inputUrl: string) => {
        try {
            new URL(inputUrl);
            return true;
        } catch {
            return false;
        }
    };
    const handleSave = async () => {
        if (taskContents && setTaskContents) {
            if (isValidUrl(url)) {
                let pageTitle: string;
                if (title === "") {
                    pageTitle = await getPageTitle(url);
                    if (!pageTitle) {
                        pageTitle = url;
                    }
                } else {
                    pageTitle = title;
                }

                setTitle(pageTitle);
                setError("");
                setTaskContents({
                    ...taskContents,
                    generalLink: { url: url, title: pageTitle },
                });
                setIsEditing(false);
                if (setTaskUpdated) {
                    setTaskUpdated(true);
                }
            } else {
                setErrorOpen(true);
                setError("Please enter a valid URL.");
            }
        }
    };
    const [errorOpen, setErrorOpen] = useState(false);

    useEffect(() => {
        if (generalLink) {
            if (generalLink.url === null || generalLink.url === "" || isEditing === true) {
                setUrl("");
                setTitle("");
            } else {
                setUrl(generalLink.url);
                setTitle(generalLink.title);
            }
        } else {
            setUrl("");
            setTitle("");
        }
    }, [taskContents]);

    return (
        <div>
            {(!generalLink?.url ||
                generalLink.url === null ||
                generalLink.url === "" ||
                isEditing === true) && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <LinkIcon />
                    <Input
                        key={"url"}
                        size="sm"
                        placeholder="URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        type="url"
                        sx={{ width: "150px", height: "30px" }}
                    />
                    {taskContents && (title !== "" || isEditing === true) && (
                        <Input
                            key={"title"}
                            size="sm"
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            sx={{ width: "150px", height: "30px" }}
                        />
                    )}
                    {error && (
                        <Snackbar
                            autoHideDuration={5000}
                            open={errorOpen}
                            variant="soft"
                            color="danger"
                            anchorOrigin={{ vertical: "top", horizontal: "right" }}
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
                    <Button
                        component="a"
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        onClick={handleSave}
                    >
                        Set
                    </Button>
                </Stack>
            )}

            {isEditing === false && generalLink?.url && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <LinkIcon />
                    <Typography>
                        <a href={generalLink.url} target="_blank" rel="noopener noreferrer">
                            {title}
                        </a>
                    </Typography>
                    <IconButton
                        component="p"
                        color="neutral"
                        size="sm"
                        onClick={() => {
                            setIsEditing(true);
                        }}
                    >
                        <EditIcon />
                    </IconButton>
                </Stack>
            )}
        </div>
    );
};
