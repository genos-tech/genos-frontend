import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Avatar from '@mui/joy/Avatar';
import { GridColDef, GridRenderCellParams, GridRenderEditCellParams } from '@mui/x-data-grid';
import { randomCreatedDate, randomUpdatedDate } from '@mui/x-data-grid-generator';
import { Select, MenuItem, Chip } from "@mui/material";
import dayjs from "dayjs";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

const hmlOptions = [
    { label: "High", value: "high", color: "#ff2e2e" },
    { label: "Medium", value: "medium", color: "#e58700" },
    { label: "Low", value: "low", color: "#2bc8ff" },
];
const getHMLOption = (value: string) => hmlOptions.find((option) => option.value === value);

const statusOptions = [
    { label: "Open", value: "open", color: "#2bc8ff", icon: <CheckCircleOutlineIcon style={{ color: "#2bc8ff" }} /> },
    { label: "WIP", value: "wip", color: "#e58700", icon: <AutorenewIcon style={{ color: "#e58700" }} /> },
    { label: "Closed", value: "closed", color: "#0adc00", icon: <CheckCircleOutlineIcon style={{ color: "#0adc00" }} /> },
    { label: "Deleted", value: "deleted", color: "#ff2e2e", icon: <HighlightOffIcon style={{ color: "#ff2e2e" }} /> },
];
const getStatusOption = (value: string) => statusOptions.find((option) => option.value === value);

const customTagOptions = [
    { label: "Backend", color: "#aaaaaa" },
    { label: "Frontend", color: "#ff2e2e" },
    { label: "Infra", color: "#e58700" }
];
const getCustomTagOption = (label: string) => customTagOptions.find((option) => option.label === label);

export const taskColumns: GridColDef<(typeof taskRows)[number]>[] = [
    {
        field: 'id',
        headerName: 'ID',
        headerClassName: 'task-col--header',
        width: 50,
    },
    {
        field: 'title',
        headerName: 'Title',
        headerClassName: 'task-col--header',
        width: 300,
        editable: true,
        headerAlign: 'center',
    },
    {
        field: 'assignee',
        headerName: 'Assignee',
        headerClassName: 'task-col--header',
        editable: false,
        sortable: false,
        width: 170,
        renderCell: (params) => (
            <Box
                textAlign='left'
                sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Avatar size="sm">{params.row.assigneeName[0]}</Avatar>
                <div>
                    <Typography level="body-xs">{params.row.assigneeName} | {params.row.assigneeEmail}</Typography>
                </div>
            </Box>
        ),
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
            return option ? <Chip
                label={option.label}
                variant="outlined"
                sx={{ color: color, opacity: 0.95 }} /> : null;
        },
        renderEditCell: (params: GridRenderEditCellParams) => (
            <Select
                value={params.value}
                onChange={(event) =>
                    params.api.setEditCellValue({ id: params.id, field: params.field, value: event.target.value })
                }
                fullWidth
            >
                {hmlOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        <Chip
                            label={option.label}
                            variant="outlined"
                            sx={{
                                color: option.color,
                                fontWeight: 'bold',
                                backgroundColor: 'transparent'
                            }} />
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
            return option ? <Chip
                label={option.label}
                variant="outlined"
                sx={{ color: color, opacity: 0.95 }} /> : null;
        },
        renderEditCell: (params: GridRenderEditCellParams) => (
            <Select
                value={params.value}
                onChange={(event) =>
                    params.api.setEditCellValue({ id: params.id, field: params.field, value: event.target.value })
                }
                fullWidth
            >
                {hmlOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        <Chip
                            label={option.label}
                            variant="outlined"
                            sx={{
                                color: option.color,
                                fontWeight: 'bold',
                                backgroundColor: 'transparent'
                            }} />
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
            return option ? <Chip
                icon={option.icon}
                label={option.label}
                variant="outlined"
                sx={{ color: color, opacity: 0.95 }} /> : null;
        },
        renderEditCell: (params: GridRenderEditCellParams) => (
            <Select
                value={params.value}
                onChange={(event) =>
                    params.api.setEditCellValue({ id: params.id, field: params.field, value: event.target.value })
                }
                fullWidth
            >
                {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        <Chip
                            icon={option.icon}
                            label={option.label}
                            variant="outlined"
                            sx={{
                                color: option.color,
                                fontWeight: 'bold',
                                backgroundColor: 'transparent'
                            }} />
                    </MenuItem>
                ))}
            </Select>
        ),
    },
    {
        field: 'createdDate',
        headerName: 'Created On',
        headerClassName: 'task-col--header',
        type: 'date',
        width: 100,
        align: 'center',
        headerAlign: 'center',
        valueFormatter: (params) => dayjs(params).format("YYYY-MM-DD"),
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
        valueFormatter: (params) => dayjs(params).format("YYYY-MM-DD"),
    },
    {
        field: 'daysLeft',
        headerName: 'Days Left',
        headerClassName: 'task-col--header',
        type: 'number',
        width: 100,
        align: 'center',
        headerAlign: 'center',
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
    // {
    //     field: 'tags',
    //     headerName: 'Tag',
    //     headerClassName: 'task-col--header',
    //     width: 300,
    //     editable: true,
    //     align: 'center',
    //     headerAlign: 'center',
    //     renderCell: (params: GridRenderCellParams) => {
    //         return (
    //             <>
    //                 {params.value.map((tag: { tag: string, color: string }, index: number) => {
    //                     const option = getCustomTagOption(tag.tag);
    //                     const color = option?.color;
    //                     return option ? (
    //                         <Chip
    //                             key={index}
    //                             label={option.label}
    //                             variant="filled"
    //                             color='success'
    //                             sx={{ mr: 0.5 }}
    //                         />
    //                     ) : null;
    //                 })}
    //             </>
    //         );
    //     },
    //     renderEditCell: (params: GridRenderEditCellParams) => (
    //         <Select
    //             value={params.value}
    //             onChange={(event) =>
    //                 params.api.setEditCellValue({ id: params.id, field: params.field, value: event.target.value })
    //             }
    //             fullWidth
    //         >
    //             {customTagOptions.map((option) => (
    //                 <MenuItem key={option.label} value={option.label}>
    //                     <Chip
    //                         label={option.label}
    //                         variant="outlined"
    //                         sx={{
    //                             color: option.color,
    //                             fontWeight: 'bold',
    //                             backgroundColor: 'transparent'
    //                         }} />
    //                 </MenuItem>
    //             ))}
    //         </Select>
    //     ),
    // },
];

export const taskRows = [
    {
        id: 'INV-1234',
        title: '/Users/kamikenpro/git/chat-app-prototype/frontend/weikiy/src/tasks/taskMain.tsx',
        priority: 'high',
        effortLevel: 'medium',
        createdDate: "2025-04-01",
        dueDate: "2025-04-05",
        daysLeft: '2',
        status: 'deleted',
        assigneeEmail: 'O',
        assigneeName: 'Olivia Ryhe',
        parentTaskId: "",
        tags: [
            {
                tag: "Backend",
                color: 'red',
            }, {
                tag: "Frontend",
                color: 'red',
            }
        ]
    },
];
