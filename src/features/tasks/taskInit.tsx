import { useState } from "react";
import Card from '@mui/joy/Card';
import CardActions from '@mui/joy/CardActions';
import CardContent from '@mui/joy/CardContent';
import FormControl from '@mui/joy/FormControl';
import Input from '@mui/joy/Input';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Box from '@mui/joy/Box';
import { Alert } from "@mui/joy";
import { UserProps, ProjectProps } from "../../types";
import { useAuth } from "../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;

type TaskInitProps = {
    myself: UserProps,
    setCurrentProject: (value: ProjectProps) => void;
}

export default function TaskInit(props: TaskInitProps) {
    const { myself, setCurrentProject } = props;
    const { accessToken } = useAuth();
    const [projectName, setProjectName] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function createProject(): Promise<void> {

        try {
            const createProjectResponse = await fetch(`${base_url}/project/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team: myself.teamId,
                    project_name: projectName,
                    owner: myself.userId
                }),
            });

            const createProjectData = await createProjectResponse.json();

            if (!createProjectResponse.ok) {
                throw new Error('Project Creation Failed');
            } else {
                console.log("Task created:", createProjectData)
                setCurrentProject(
                    {
                        projectId: createProjectData.project_id,
                        projectName: createProjectData.project_name
                    }
                )
            }
        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <Box
            sx={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden', // prevents scrollbars during resize
            }}
        >
            <Card
                variant="outlined"
                sx={{
                    width: 400, // or any fixed width you want
                    overflow: 'auto',
                    resize: 'horizontal',
                }}
            >
                <Typography level="title-lg">
                    Create your first project
                </Typography>
                {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
                <CardContent
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(80px, 1fr))',
                        gap: 1.5,
                    }}
                >
                    <FormControl sx={{ gridColumn: '1/-1' }}>
                        <Input
                            placeholder="Project Name"
                            onChange={(e) => { setProjectName(e.target.value); }}
                        />
                    </FormControl>
                    <CardActions sx={{ gridColumn: '1/-1' }}>
                        <Button component='p' variant="outlined" color="primary" onClick={() => {
                            if (projectName !== "") {
                                createProject()
                            } else {
                                setErrorMessage("Project name is empty !!!")
                            }
                        }}>
                            Create
                        </Button>
                    </CardActions>
                </CardContent>
            </Card>
        </Box>
    );
}
