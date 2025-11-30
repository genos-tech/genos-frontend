import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PendingIcon from "@mui/icons-material/Pending";
import { Avatar, Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Chip, IconButton, MenuItem, Select } from "@mui/material";
import { alpha } from "@mui/system";
import { GridColDef, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import dayjs from "dayjs";

import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { effortLevels, priorities } from "../../utils/taskMeta";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

const getPriorityOption = (value: string) =>
    priorities.find((option) => option.priority === value);

const getEffortLevelOption = (value: string) =>
    effortLevels.find((option) => option.level === value);

const statusOptions = [
    {
        label: "Open",
        value: "Open",
        color: "#0044c2",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "WIP",
        value: "WIP",
        color: "#ff8c00ff",
        textColor: "white",
        icon: <AutorenewIcon style={{ color: "white" }} />,
    },
    {
        label: "Pending",
        value: "Pending",
        color: "#b900ff",
        textColor: "white",
        icon: <PendingIcon style={{ color: "white" }} />,
    },
    {
        label: "Closed",
        value: "Closed",
        color: "#1dc200",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "Deleted",
        value: "Deleted",
        color: "#ff2323",
        textColor: "white",
        icon: <HighlightOffIcon style={{ color: "white" }} />,
    },
];
const getStatusOption = (value: string) => statusOptions.find((option) => option.value === value);

type getTaskColumnsProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    accessToken: string | null;
    teamMembers: UserProps[];
    useTM: TaskManagementState;
};

export const getTaskColumns = (props: getTaskColumnsProps): GridColDef[] => {
    const { myself, teamMembers, useTM } = props;
    const { mode } = useColorScheme();

    return [
        {
            field: "id",
            headerName: "ID",
            headerClassName: "task-col--header",
            width: 85,
            align: "center",
            headerAlign: "center",
            sortable: false,
            renderCell: (params: GridRenderCellParams) => {
                return (
                    <IconButton
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            useTM.setIsTaskPreviewVisible(true);
                            useTM.setCurrentPreviewTaskId(Number(params.id));
                        }}
                        sx={{
                            color: mode === "dark" ? "#fff" : "#000",
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(255, 255, 255, 0.1)"
                                        : "rgba(0, 0, 0, 0.04)",
                            },
                        }}
                    >
                        <Typography fontSize="16px">{params.id}</Typography>
                        <OpenInNewIcon fontSize="small" sx={{ ml: 0.5 }} />
                    </IconButton>
                );
            },
        },
        {
            field: "status",
            headerName: "Status",
            headerClassName: "task-col--header",
            width: 105,
            editable: true,
            align: "center",
            headerAlign: "center",
            renderCell: (params: GridRenderCellParams) => {
                const option = getStatusOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? (
                    <Chip
                        icon={option.icon}
                        label={option.label}
                        size="small"
                        variant="outlined"
                        sx={{
                            backgroundColor: alpha(
                                color || "#ff2323",
                                mode === "dark" ? 0.5 : 0.75
                            ),
                            color: textColor,
                            fontWeight: "bold",
                            borderRadius: "5px",
                        }}
                    />
                ) : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value || ""}
                    fullWidth
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue(
                            {
                                id: params.id,
                                field: params.field,
                                value: value,
                            },
                            event
                        );

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                >
                    {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Chip
                                label={option.label}
                                size="small"
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || "#ff2323", 0.75),
                                    color: option.textColor,
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                }}
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: "tags",
            headerName: "Tags",
            headerClassName: "task-col--header",
            width: 110,
            editable: false,
            align: "center",
            headerAlign: "center",
            renderCell: (params: GridRenderCellParams) => {
                return (
                    <>
                        {params.value.map(
                            (
                                tag: {
                                    tagName: string;
                                    tagColor: string;
                                    tagTextColor: string;
                                },
                                index: number
                            ) => {
                                return (
                                    <Chip
                                        key={index}
                                        label={tag.tagName}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            color: mode === "dark" ? "white" : "black",
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            borderWidth: "3px",
                                            borderColor: alpha(
                                                tag.tagColor,
                                                mode === "dark" ? 0.5 : 0.75
                                            ),
                                            ml: 0.5,
                                        }}
                                    />
                                );
                            }
                        )}
                    </>
                );
            },
        },
        {
            field: "title",
            headerName: "Title",
            headerClassName: "task-col--header",
            width: 300,
            editable: true,
            headerAlign: "left",
        },
        {
            field: "assigneeId",
            headerName: "Assignee",
            headerClassName: "task-col--header",
            editable: true,
            sortable: false,
            width: 250,
            renderCell: (params) => {
                return (
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }} textAlign="left">
                        <Avatar
                            size="sm"
                            src={
                                params.row.assigneeId === myself.userId
                                    ? `${media_url}/${myself.avatarImgPath}`
                                    : `${media_url}/${params.row.assigneeImgPath}`
                            }
                        >
                            {params.row.assigneeName[0].toUpperCase()}
                        </Avatar>
                        <Box position="absolute" sx={{ pl: "20px", pt: "20px" }}>
                            <PulseDot
                                color={
                                    myself.userId === params.row?.assigneeId
                                        ? myself?.isOfflineForced !== "true"
                                            ? "#4caf50"
                                            : "#999"
                                        : params.row?.isOnline === true &&
                                            params.row?.isOfflineForced === "true"
                                          ? "#4caf50"
                                          : "#999"
                                }
                            />
                        </Box>
                        <div>
                            <Typography level="body-xs">
                                {params.row.assigneeName} | {params.row.assigneeEmail}
                            </Typography>
                        </div>
                    </Box>
                );
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.row.assigneeId || params.value || ""}
                    fullWidth
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue(
                            {
                                id: params.id,
                                field: params.field,
                                value: value,
                            },
                            event
                        );

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                >
                    {teamMembers.map((option) => (
                        <MenuItem key={option.userId} value={option.userId}>
                            <Box
                                sx={{ display: "flex", gap: 2, alignItems: "center" }}
                                textAlign="left"
                            >
                                <Avatar
                                    size="sm"
                                    src={
                                        option.userId === myself.userId
                                            ? `${media_url}/${myself.avatarImgPath}`
                                            : `${media_url}/${option.avatarImgPath}`
                                    }
                                >
                                    {option.userName[0].toUpperCase()}
                                </Avatar>
                                <Box position="absolute" sx={{ pl: "20px", pt: "20px" }}>
                                    <PulseDot
                                        color={
                                            myself.userId === option?.userId
                                                ? myself?.isOfflineForced !== "true"
                                                    ? "#4caf50"
                                                    : "#999"
                                                : option?.isOnline === true &&
                                                    option?.isOfflineForced === "true"
                                                  ? "#4caf50"
                                                  : "#999"
                                        }
                                    />
                                </Box>
                                <div>
                                    <Typography level="body-xs">
                                        {option.userName} | {option.userEmail}
                                    </Typography>
                                </div>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: "priority",
            headerName: "Priority",
            headerClassName: "task-col--header",
            width: 100,
            editable: true,
            align: "center",
            headerAlign: "center",
            renderCell: (params: GridRenderCellParams) => {
                const option = getPriorityOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? (
                    <Chip
                        label={option.priority}
                        size="small"
                        variant="outlined"
                        sx={{
                            backgroundColor: alpha(
                                color || "#ff2323",
                                mode === "dark" ? 0.5 : 0.75
                            ),
                            color: textColor,
                            fontWeight: "bold",
                            borderRadius: "5px",
                        }}
                    />
                ) : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value || ""}
                    fullWidth
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue(
                            {
                                id: params.id,
                                field: params.field,
                                value: value,
                            },
                            event
                        );

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                >
                    {priorities.map((option) => (
                        <MenuItem key={option.priority || ""} value={option.priority || ""}>
                            <Chip
                                label={option.priority}
                                size="small"
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || "#ff2323", 0.75),
                                    color: option.textColor,
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                }}
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: "effortLevel",
            headerName: "Effort Level",
            headerClassName: "task-col--header",
            width: 100,
            editable: true,
            align: "center",
            headerAlign: "center",
            renderCell: (params: GridRenderCellParams) => {
                const option = getEffortLevelOption(params.value);
                const color = option?.color;
                const textColor = option?.textColor;
                return option ? (
                    <Chip
                        label={option.level}
                        size="small"
                        variant="outlined"
                        sx={{
                            backgroundColor: alpha(color || "#ff2323", mode === "dark" ? 0.5 : 1),
                            color: textColor,
                            fontWeight: "bold",
                            borderRadius: "5px",
                        }}
                    />
                ) : null;
            },
            renderEditCell: (params: GridRenderEditCellParams) => (
                <Select
                    value={params.value || ""}
                    fullWidth
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue(
                            {
                                id: params.id,
                                field: params.field,
                                value: value,
                            },
                            event
                        );

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                >
                    {effortLevels.map((option) => (
                        <MenuItem key={option.level || ""} value={option.level || ""}>
                            <Chip
                                label={option.level}
                                size="small"
                                variant="outlined"
                                sx={{
                                    backgroundColor: alpha(option.color || "#ff2323", 0.75),
                                    color: option.textColor,
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                }}
                            />
                        </MenuItem>
                    ))}
                </Select>
            ),
        },
        {
            field: "daysLeft",
            headerName: "Days Left",
            headerClassName: "task-col--header",
            type: "number",
            width: 100,
            align: "center",
            headerAlign: "center",
            renderCell: (params: GridRenderCellParams) => {
                return params.value === -1 ? (
                    <Chip
                        label={"Expired"}
                        size="small"
                        variant="outlined"
                        sx={{
                            backgroundColor: alpha("#ff2323", mode === "dark" ? 0.5 : 0.75),
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: "5px",
                        }}
                    />
                ) : (
                    params.value
                );
            },
        },
        {
            field: "dueDate",
            headerName: "Due Date",
            headerClassName: "task-col--header",
            type: "date",
            editable: true,
            width: 100,
            align: "center",
            headerAlign: "center",
            valueFormatter: (params) => (params ? dayjs(params).format("YYYY-MM-DD") : params),
            renderEditCell: (params: GridRenderEditCellParams) => (
                <input
                    type="date"
                    value={params.value ? dayjs(params.value).format("YYYY-MM-DD") : ""}
                    onChange={(event) => {
                        const value = event.target.value;
                        params.api.setEditCellValue(
                            {
                                id: params.id,
                                field: params.field,
                                value: value,
                            },
                            event
                        );

                        // Exit edit mode after value is set
                        params.api.stopCellEditMode({
                            id: params.id,
                            field: params.field,
                        });
                    }}
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        outline: "none",
                        padding: "8px",
                        fontSize: "14px",
                        textAlign: "center",
                    }}
                    autoFocus
                />
            ),
        },
        {
            field: "updatedAt",
            headerName: "Last Updated Time",
            headerClassName: "task-col--header",
            type: "dateTime",
            width: 180,
            align: "center",
            headerAlign: "center",
            valueFormatter: (params) => dayjs(params).format("YYYY-MM-DD HH:mm:ss"),
        },
        {
            field: "createdDate",
            headerName: "Created Date",
            headerClassName: "task-col--header",
            type: "date",
            width: 120,
            align: "center",
            headerAlign: "center",
            valueFormatter: (params) => dayjs(params).format("YYYY-MM-DD"),
        },
        {
            field: "concatTags",
            headerName: "Concat Tags",
            headerClassName: "task-col--header",
        },
    ];
};
