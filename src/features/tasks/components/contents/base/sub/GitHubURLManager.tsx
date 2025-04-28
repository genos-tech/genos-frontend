import { useEffect, useState } from "react";
import { Input, Snackbar, Button, Stack, Typography, IconButton } from "@mui/joy";
import EditIcon from '@mui/icons-material/Edit';

import { GitHubIcon } from '../../../../../../assets/GithubIcon';
import { TaskProps } from '../../../../../../types/tasks';
import { getDomainFromUrl } from '../../../../../../utils/urlHandler';

type GitHubURLManagerProps = {
    githubLink: { url: string, title: string },
    taskContents?: TaskProps,
    setTaskContents?: (value: TaskProps) => void,
    isPreviewMode: boolean,
    setTaskUpdated?: (value: boolean) => void,
}
export const GitHubURLManager = (props: GitHubURLManagerProps) => {
    const { githubLink, taskContents, setTaskContents, isPreviewMode, setTaskUpdated } = props;
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
                if (prTitle === "") {
                    setPRTitle(getDomainFromUrl(prUrl))
                }
                setTaskContents({
                    ...taskContents,
                    githubLink: { url: prUrl, title: prTitle }
                });
                setPRTitle(prTitle);
                setPRError("");
                setIsEditing(false)
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
                setPRUrl("")
                setPRTitle("")
            } else {
                setPRUrl(githubLink.url)
                setPRTitle(githubLink.title)
            }
        }
    }, [taskContents])

    return (
        <div>
            {(!githubLink?.url || githubLink.url === null || githubLink.url === "" || isEditing === true) && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <GitHubIcon />
                    <Input
                        key={'prUrl'}
                        size='sm'
                        placeholder="PR URL"
                        value={prUrl}
                        onChange={(e) => setPRUrl(e.target.value)}
                        type="url"
                        sx={{ width: '150px', height: '30px' }}
                    />
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

            {isEditing === false && githubLink?.url && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <GitHubIcon />
                    <Typography>
                        <a href={githubLink.url} target="_blank" rel="noopener noreferrer">
                            {prTitle}
                        </a>
                    </Typography>
                    <IconButton
                        component='p'
                        color="neutral"
                        size='sm'
                        onClick={() => { setIsEditing(true) }}
                    >
                        <EditIcon />
                    </IconButton>
                </Stack>
            )}
        </div>
    )
}