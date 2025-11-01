import { useEffect, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Button, IconButton, Input, Snackbar, Stack, Typography } from "@mui/joy";

import { GitHubIcon } from "../../../../../../assets/GithubIcon";
import { TaskProps } from "../../../../../../types/tasks";
import { getPageTitle } from "../../../../utils/getPageTitle";

type GitHubURLManagerProps = {
    githubLink: { url: string; title: string };
    taskContent?: TaskProps;
    setTaskContent?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const GitHubURLManager = (props: GitHubURLManagerProps) => {
    const { githubLink, taskContent, setTaskContent, setTaskUpdated } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [prUrl, setPRUrl] = useState("");
    const [prTitle, setPRTitle] = useState("");
    const [prError, setPRError] = useState("");
    const isValidGitHubPR = (url: string) => {
        // return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url);
        return /^https:\/\/github\.com\/.+/.test(url);
    };
    const handlePRSave = async () => {
        if (taskContent && setTaskContent) {
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
                setTaskContent({
                    ...taskContent,
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
    }, [taskContent]);

    return (
        <div>
            {(!githubLink?.url ||
                githubLink.url === null ||
                githubLink.url === "" ||
                isEditing === true) && (
                <Stack alignItems="center" direction="row" justifyContent="center" spacing={1}>
                    <GitHubIcon />
                    <Box>
                        <Typography>GitHub</Typography>
                    </Box>
                    <Input
                        key={"url"}
                        placeholder="Paste GitHub PR URL"
                        size="sm"
                        sx={{ width: "200px", height: "30px" }}
                        type="url"
                        value={prUrl}
                        onChange={(e) => setPRUrl(e.target.value)}
                    />
                    {taskContent && (prTitle !== "" || isEditing === true) && (
                        <>
                            <Box>
                                <Typography>Title:</Typography>
                            </Box>
                            <Input
                                key={"title"}
                                placeholder="Title"
                                size="sm"
                                sx={{ width: "200px", height: "30px" }}
                                value={prTitle}
                                onChange={(e) => setPRTitle(e.target.value)}
                            />
                        </>
                    )}
                    {prError && (
                        <Snackbar
                            anchorOrigin={{ vertical: "top", horizontal: "right" }}
                            autoHideDuration={5000}
                            color="danger"
                            open={prErrorOpen}
                            variant="soft"
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
                        color="neutral"
                        component="a"
                        size="sm"
                        variant="outlined"
                        onClick={handlePRSave}
                    >
                        Set
                    </Button>
                </Stack>
            )}

            {isEditing === false && githubLink?.url && (
                <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5}>
                    <GitHubIcon />
                    <Typography
                        sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "500px",
                        }}
                    >
                        <a href={githubLink.url} rel="noopener noreferrer" target="_blank">
                            {prTitle}
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
