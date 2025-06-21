import { alpha } from '@mui/system';
import { Box, Typography, Avatar } from '@mui/joy';
import { useColorScheme } from '@mui/joy/styles';
import { GridColDef, GridRenderCellParams, GridRenderEditCellParams } from '@mui/x-data-grid';
import { Select, MenuItem, Chip } from "@mui/material";
import dayjs from "dayjs";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PendingIcon from '@mui/icons-material/Pending';

import { UserProps } from '../../../../types/admin';


const hmlOptions = [
    { label: "Low", value: "Low", color: "#0044c2", textColor: 'white' },
    { label: "Medium", value: "Medium", color: "#1dc200", textColor: 'white' },
    { label: "High", value: "High", color: "#ff2323", textColor: 'white' },
];
const getHMLOption = (value: string) => hmlOptions.find((option) => option.value === value);

const statusOptions = [
    {
        label: "Open",
        value: "Open",
        color: "#0044c2",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />
    },
    {
        label: "WIP",
        value: "WIP",
        color: "#ffff23",
        textColor: "purple",
        icon: <AutorenewIcon style={{ color: "purple" }} />
    },
    {
        label: "Pending",
        value: "Pending",
        color: "#b900ff",
        textColor: "white",
        icon: <PendingIcon style={{ color: "white" }} />
    },
    {
        label: "Closed",
        value: "Closed",
        color: "#1dc200",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />
    },
    {
        label: "Deleted",
        value: "Deleted",
        color: "#ff2323",
        textColor: "white",
        icon: <HighlightOffIcon style={{ color: "white" }} />
    },
];
const getStatusOption = (value: string) => statusOptions.find((option) => option.value === value);

type getTaskColumns = {
    myself: UserProps;
    accessToken: string | null;
    teamMembers: UserProps[];
}

export const getTaskColumns = (props: getTaskColumns): GridColDef[] => {
    const { mode } = useColorScheme();

    return ([
        {
            field: 'id',
            headerName: 'ID',
            headerClassName: 'task-col--header',
            width: 70,
        },
        {
            field: 'title',
            headerName: 'Title',
            headerClassName: 'task-col--header',
            width: 200,
            editable: true,
            headerAlign: 'left',
        },
        {
            field: 'assignee',
            headerName: 'Assignee',
            headerClassName: 'task-col--header',
            editable: true,
            sortable: false,
            width: 250,
            renderCell: (params) => {
                return (
                    <Box
                        textAlign='left'
                        sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Avatar size="sm" src={params.row.assigneeImgPath}>
                            {params.row.assigneeName[0]}
                        </Avatar>
                        <div>
                            <Typography level="body-xs">{params.row.assigneeName} | {params.row.assigneeEmail}</Typography>
                        </div>
                    </Box>
                )
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value}
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue({
                            id: params.id,
                            field: params.field,
                            value: value,
                        }, event);

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                    fullWidth
                >
                    {props.teamMembers.map((option) => (
                        <MenuItem key={option.userId} value={option.userEmail}>
                            {option.userName} | {option.userEmail}
                        </MenuItem>
                    ))}
                </Select>
            )
        },
        {
            field: 'tags',
            headerName: 'Tags',
            headerClassName: 'task-col--header',
            width: 110,
            editable: false,
            align: 'left',
            headerAlign: 'left',
            renderCell: (params: GridRenderCellParams) => {
                return (
                    <>
                        {params.value.map((tag: { tagName: string, tagColor: string, tagTextColor: string }, index: number) => {
                            return (
                                <Chip
                                    key={index}
                                    label={tag.tagName}
                                    variant="outlined"
                                    sx={{
                                        backgroundColor: alpha(tag.tagColor || '#ff2323', mode === 'dark' ? 0.5 : 0.75),
                                        color: tag.tagTextColor,
                                        fontWeight: 'bold',
                                        borderRadius: '7px',
                                        ml: 0.5
                                    }}
                                    size='small'
                                />
                            )
                        })}
                    </>
                );
            },
        },
        {
            field: 'priority',
            headerName: 'Priority',
            headerClassName: 'task-col--header',
            width: 100,
            editable: true,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => {
                const option = getHMLOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? <Chip
                    label={option.label}
                    variant="outlined"
                    sx={{
                        backgroundColor: alpha(color || '#ff2323', mode === 'dark' ? 0.5 : 0.75),
                        color: textColor,
                        fontWeight: 'bold',
                        borderRadius: '7px',
                    }}
                    size='small'
                /> : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value}
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue({
                            id: params.id,
                            field: params.field,
                            value: value,
                        }, event);

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                    fullWidth
                >
                    {hmlOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Chip
                                label={option.label}
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || '#ff2323', 0.75),
                                    color: option.textColor,
                                    fontWeight: 'bold',
                                    borderRadius: '7px',
                                }}
                                size='small'
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: 'effortLevel',
            headerName: 'Effort Level',
            headerClassName: 'task-col--header',
            width: 100,
            editable: true,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => {
                const option = getHMLOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? <Chip
                    label={option.label}
                    variant="outlined"
                    sx={{
                        backgroundColor: alpha(color || '#ff2323', mode === 'dark' ? 0.5 : 0.75),
                        color: textColor,
                        fontWeight: 'bold',
                        borderRadius: '7px',
                    }}
                    size='small'
                /> : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value}
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue({
                            id: params.id,
                            field: params.field,
                            value: value,
                        }, event);

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                    fullWidth
                >
                    {hmlOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Chip
                                label={option.label}
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || '#ff2323', 0.75),
                                    color: option.textColor,
                                    fontWeight: 'bold',
                                    borderRadius: '7px',
                                }}
                                size='small'
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            headerClassName: 'task-col--header',
            width: 120,
            editable: true,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => {
                const option = getStatusOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? <Chip
                    icon={option.icon}
                    label={option.label}
                    variant="outlined"
                    sx={{
                        backgroundColor: alpha(color || '#ff2323', mode === 'dark' ? 0.5 : 0.75),
                        color: textColor,
                        fontWeight: 'bold',
                        borderRadius: '7px',
                    }}
                    size='small'
                /> : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value}
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue({
                            id: params.id,
                            field: params.field,
                            value: value,
                        }, event);

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                    fullWidth
                >
                    {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Chip
                                label={option.label}
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || '#ff2323', 0.75),
                                    color: option.textColor,
                                    fontWeight: 'bold',
                                    borderRadius: '7px',
                                }}
                                size='small'
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: 'dueDate',
            headerName: 'Due Date',
            headerClassName: 'task-col--header',
            type: 'date',
            editable: true,
            width: 100,
            align: 'center',
            headerAlign: 'center',
            valueFormatter: (params) => params ? dayjs(params).format("YYYY-MM-DD") : params,
        },
        {
            field: 'daysLeft',
            headerName: 'Days Left',
            headerClassName: 'task-col--header',
            type: 'number',
            width: 100,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => {
                return params.value === -1 ? <Chip
                    label={'Expired'}
                    variant="outlined"
                    size='small'
                    sx={{
                        backgroundColor: alpha('#ff2323', mode === 'dark' ? 0.5 : 0.75),
                        color: 'white',
                        fontWeight: 'bold',
                        borderRadius: '7px',
                    }}
                /> : params.value;
            },
        },
        {
            field: 'threadId',
            headerName: 'Thread ID',
            headerClassName: 'task-col--header',
            width: 120,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'parentTaskId',
            headerName: 'Parent Task ID',
            headerClassName: 'task-col--header',
            width: 150,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'createdDate',
            headerName: 'Created On',
            headerClassName: 'task-col--header',
            type: 'date',
            width: 150,
            align: 'left',
            headerAlign: 'left',
            valueFormatter: (params) => dayjs(params).format("YYYY-MM-DD"),
        },
        {
            field: 'concatTags',
            headerName: 'Concat Tags',
            headerClassName: 'task-col--header',
        },
    ])
};
