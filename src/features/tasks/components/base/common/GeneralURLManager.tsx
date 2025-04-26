import { useState } from "react";
import { Input, Snackbar, Button, Stack, Typography, IconButton } from "@mui/joy";
import EditIcon from '@mui/icons-material/Edit';
import { CustomLinkIcon } from '../../../../../assets/CustomLinkIcon';
import { TaskProps } from '../../../../../types/tasks';

type GeneralURLManagerProps = {
    generalLink: { url: string, title: string },
    taskContents?: TaskProps,
    setTaskContents?: (value: TaskProps) => void,
    isPreviewMode: boolean,
}
export const GeneralURLManager = (props: GeneralURLManagerProps) => {
    const { generalLink, taskContents, setTaskContents, isPreviewMode } = props;

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
    const handleSave = () => {
        if (taskContents && setTaskContents) {
            if (!title.trim()) {
                setErrorOpen(true);
                setError("Title cannot be empty!");
                return;
            }
            if (isValidUrl(url)) {
                setTaskContents({
                    ...taskContents,
                    generalLink: { url: url, title: title }
                });
                setError("");
            } else {
                setErrorOpen(true);
                setError("Please enter a valid URL.");
            }
        }
    };
    const [errorOpen, setErrorOpen] = useState(false);

    return (
        <div>
            {(!generalLink?.url || generalLink.url === "") && (
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <CustomLinkIcon />
                    <Input
                        key={'title'}
                        size='sm'
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        sx={{ width: '150px', height: '30px' }}
                    />
                    <Input
                        key={'url'}
                        size='sm'
                        placeholder="URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        type="url"
                        sx={{ width: '150px', height: '30px' }}
                    />
                    {error && <Snackbar
                        autoHideDuration={5000}
                        open={errorOpen}
                        variant='soft'
                        color='danger'
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        onClose={(event, reason) => {
                            if (reason === 'clickaway') {
                                return;
                            }
                            setErrorOpen(false);
                        }}
                    >
                        {error}
                    </Snackbar>}
                    <Button
                        component='a'
                        variant="outlined"
                        color="neutral"
                        size='sm'
                        onClick={handleSave}>
                        Set
                    </Button>
                </Stack>
            )}

            {generalLink?.url && (
                isPreviewMode
                    ? <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                        <Typography>
                            <a href={generalLink.url} target="_blank" rel="noopener noreferrer">
                                {generalLink.title}
                            </a>
                        </Typography>
                        <IconButton
                            component='p'
                            variant="outlined"
                            color="neutral"
                            size='sm'
                            onClick={() => { console.log("Edit general link") }}
                        >
                            <EditIcon />
                        </IconButton>
                    </Stack>
                    : <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                        <CustomLinkIcon />
                        <Typography>
                            <a href={generalLink.url} target="_blank" rel="noopener noreferrer">
                                {generalLink.title}
                            </a>
                        </Typography>
                    </Stack>
            )}
        </div>
    )
}