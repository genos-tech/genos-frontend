import { useState } from "react";
import { Input, Snackbar, Button, Stack, Typography, IconButton } from "@mui/joy";
import EditIcon from '@mui/icons-material/Edit';

import { GitHubIcon } from '../../../../../assets/GithubIcon';
import { TaskProps } from '../../../../../types/tasks';

type GitHubURLManagerProps = {
    githubLink: { url: string, title: string },
    taskContents?: TaskProps,
    setTaskContents?: (value: TaskProps) => void,
    isPreviewMode: boolean,
}
export const GitHubURLManager = (props: GitHubURLManagerProps) => {
    const { githubLink, taskContents, setTaskContents, isPreviewMode } = props;

    const [prUrl, setPRUrl] = useState("");
    const [prTitle, setPRTitle] = useState("");
    const [prError, setPRError] = useState("");
    const isValidGitHubPR = (url: string) => {
        // return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url);
        return /^https:\/\/github\.com\/.+/.test(url);
    };
    const handlePRSave = () => {
        if (taskContents && setTaskContents) {
            if (!prTitle.trim()) {
                setPRErrorOpen(true);
                setPRError("PR title cannot be empty!");
                return;
            }
            if (isValidGitHubPR(prUrl)) {
                setTaskContents({
                    ...taskContents,
                    githubLink: { url: prUrl, title: prTitle }
                });
                setPRTitle(prTitle);
                setPRError("");
            } else {
                setPRErrorOpen(true);
                setPRError("Please enter a valid GitHub PR URL.");
            }
        }
    };
    const [prErrorOpen, setPRErrorOpen] = useState(false);

    return (
        <div>
            {(!githubLink?.url || githubLink.url === "") && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <GitHubIcon />
                    <Input
                        key={'prTitle'}
                        size='sm'
                        placeholder="PR Title"
                        value={prTitle}
                        onChange={(e) => {
                            setPRTitle(e.target.value)
                        }}
                        sx={{ width: '150px', height: '30px' }}
                    />
                    <Input
                        key={'prUrl'}
                        size='sm'
                        placeholder="PR URL"
                        value={prUrl}
                        onChange={(e) => setPRUrl(e.target.value)}
                        type="url"
                        sx={{ width: '150px', height: '30px' }}
                    />
                    {prError && <Snackbar
                        autoHideDuration={5000}
                        open={prErrorOpen}
                        variant='soft'
                        color='danger'
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        onClose={(event, reason) => {
                            if (reason === 'clickaway') {
                                return;
                            }
                            setPRErrorOpen(false);
                        }}
                    >
                        {prError}
                    </Snackbar>}
                    <Button
                        component='a'
                        variant="outlined"
                        color="neutral"
                        size='sm'
                        onClick={handlePRSave}>
                        Set
                    </Button>
                </Stack>
            )}

            {githubLink?.url && (
                isPreviewMode
                    ? <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                        <Typography>
                            <a href={githubLink.url} target="_blank" rel="noopener noreferrer">
                                {prTitle}
                            </a>
                        </Typography>
                        <IconButton
                            component='p'
                            variant="outlined"
                            color="neutral"
                            size='sm'
                            onClick={() => { console.log("Edit pr link") }}
                        >
                            <EditIcon />
                        </IconButton>
                    </Stack>
                    : <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                        <GitHubIcon />
                        <Typography>
                            <a href={githubLink.url} target="_blank" rel="noopener noreferrer">
                                {prTitle}
                            </a>
                        </Typography>
                    </Stack>
            )}
        </div>
    )
}