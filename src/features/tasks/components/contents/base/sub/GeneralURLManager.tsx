import { useEffect, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, IconButton, Input, Snackbar, Stack, Typography } from "@mui/joy";

import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type GeneralURLManagerProps = {
    generalLink: { url: string; title: string };
    taskContents?: TaskProps;
    setTaskContents?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const GeneralURLManager = (props: GeneralURLManagerProps) => {
    const { generalLink, taskContents, setTaskContents, setTaskUpdated } = props;
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
                <Stack alignItems="center" direction="row" justifyContent="center" spacing={1}>
                    <LinkIcon />
                    <Box>
                        <Typography>General Link</Typography>
                    </Box>
                    <Input
                        key={"url"}
                        placeholder="Paste General Link"
                        size="sm"
                        sx={{ width: "200px", height: "30px" }}
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                    {taskContents && (title !== "" || isEditing === true) && (
                        <>
                            <Box>
                                <Typography>Title:</Typography>
                            </Box>
                            <Input
                                key={"title"}
                                placeholder="Title"
                                size="sm"
                                sx={{ width: "200px", height: "30px" }}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </>
                    )}
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
                    <Button
                        color="neutral"
                        component="a"
                        size="sm"
                        variant="outlined"
                        onClick={handleSave}
                    >
                        Set
                    </Button>
                </Stack>
            )}

            {isEditing === false && generalLink?.url && (
                <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5}>
                    <LinkIcon />
                    <Typography
                        sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "500px",
                        }}
                    >
                        <a href={generalLink.url} rel="noopener noreferrer" target="_blank">
                            {title}
                        </a>
                    </Typography>
                    <IconButton
                        color="neutral"
                        component="p"
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
