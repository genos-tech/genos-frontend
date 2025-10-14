import { useEffect, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Button, IconButton, Input, Snackbar, Stack, Typography } from "@mui/joy";

import { GitHubIcon } from "../../../../../../assets/GithubIcon";
import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type GitHubURLManagerProps = {
    githubLink: { url: string; title: string };
    taskContents?: TaskProps;
    setTaskContents?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const GitHubURLManager = (props: GitHubURLManagerProps) => {
    const { githubLink, taskContents, setTaskContents, setTaskUpdated } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [prUrl, setPRUrl] = useState("");
    const [prTitle, setPRTitle] = useState("");
    const [prError, setPRError] = useState("");
    const isValidGitHubPR = (url: string) => {
        // return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url);
        return /^https:\/\/github\.com\/.+/.test(url);
    };
    const handlePRSave = async () => {
        if (taskContents && setTaskContents) {
            if (isValidGitHubPR(prUrl)) {
                let pageTitle: string;
                if (prTitle === "") {
                    pageTitle = await getPageTitle(prUrl);
                    if (!pageTitle) {
                        pageTitle = prUrl;
                    }
                } else {
                    pageTitle = prTitle;
                }

                setPRTitle(pageTitle);
                setPRError("");
                setTaskContents({
                    ...taskContents,
                    githubLink: { url: prUrl, title: pageTitle },
                });
                setIsEditing(false);
                if (setTaskUpdated) {
                    setTaskUpdated(true);
                }
            } else {
                setPRErrorOpen(true);
                setPRError("Please enter a valid GitHub PR URL.");
            }
        }
    };
    const [prErrorOpen, setPRErrorOpen] = useState(false);

    useEffect(() => {
        if (githubLink) {
            if (githubLink.url === null || githubLink.url === "" || isEditing === true) {
                setPRUrl("");
                setPRTitle("");
            } else {
                setPRUrl(githubLink.url);
                setPRTitle(githubLink.title);
            }
        } else {
            setPRUrl("");
            setPRTitle("");
        }
    }, [taskContents]);

    return (
        <div>
            {(!githubLink?.url ||
                githubLink.url === null ||
                githubLink.url === "" ||
                isEditing === true) && (
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                    <GitHubIcon />
                    <Box>
                        <Typography>GitHub</Typography>
                    </Box>
                    <Input
                        key={"url"}
                        size="sm"
                        placeholder="Paste GitHub PR URL"
                        value={prUrl}
                        onChange={(e) => setPRUrl(e.target.value)}
                        type="url"
                        sx={{ width: "200px", height: "30px" }}
                    />
                    {taskContents && (prTitle !== "" || isEditing === true) && (
                        <>
                            <Box>
                                <Typography>Title:</Typography>
                            </Box>
                            <Input
                                key={"title"}
                                size="sm"
                                placeholder="Title"
                                value={prTitle}
                                onChange={(e) => setPRTitle(e.target.value)}
                                sx={{ width: "200px", height: "30px" }}
                            />
                        </>
                    )}
                    {prError && (
                        <Snackbar
                            autoHideDuration={5000}
                            open={prErrorOpen}
                            variant="soft"
                            color="danger"
                            anchorOrigin={{ vertical: "top", horizontal: "right" }}
                            onClose={(event, reason) => {
                                if (reason === "clickaway") {
                                    return;
                                }
                                setPRErrorOpen(false);
                            }}
                        >
                            {prError}
                        </Snackbar>
                    )}
                    <Button
                        component="a"
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        onClick={handlePRSave}
                    >
                        Set
                    </Button>
                </Stack>
            )}

            {isEditing === false && githubLink?.url && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <GitHubIcon />
                    <Typography
                        sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "500px",
                        }}
                    >
                        <a href={githubLink.url} target="_blank" rel="noopener noreferrer">
                            {prTitle}
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
