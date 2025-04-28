import { useState, useCallback, useEffect } from "react";
import { DataGrid, GridToolbar, GridFilterModel, useGridApiRef } from '@mui/x-data-grid';
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useColorScheme } from '@mui/joy/styles';
import { Box, Button, Stack, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { getTaskColumns } from './TaskTableFormat';
import { loadProjectTags } from '../../services/loadProjectTags';
import { loadTeamMembers } from "../../../admin/services/loadTeamMembers";
import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from '../../../../types/admin';
import { TaskTableProps, TagListProps } from "../../../../types/tasks";

const options = [
  { name: "Group By Status", filterId: 1 },
  { name: "Group By Tag", filterId: 2 },
  { name: "Group By Priority", filterId: 3 },
  { name: "Group By Effort Level", filterId: 4 },
];

const theme = createTheme({ cssVariables: true });

type FilterProps = {
  label: string;
  filterModel: GridFilterModel;
  lightModeColor: string;
  darkModeColor: string;
}

const predefinedStatusFilters: FilterProps[] = [
  {
    label: 'All',
    filterModel: { items: [] },
    lightModeColor: 'black',
    darkModeColor: 'white',
  },
  {
    label: 'Open',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Open' }] },
    lightModeColor: '#002bff',
    darkModeColor: '#2bc8ff',
  },
  {
    label: 'WIP',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'WIP' }] },
    lightModeColor: '#e58700',
    darkModeColor: '#e58700',
  },
  {
    label: 'Closed',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Closed' }] },
    lightModeColor: '#1ec800',
    darkModeColor: '#0adc00',
  },
  {
    label: 'Pending',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Pending' }] },
    lightModeColor: '#b900ff',
    darkModeColor: '#b900ff',
  },
  {
    label: 'Deleted',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Deleted' }] },
    lightModeColor: '#c80000',
    darkModeColor: '#ff2e2e',
  },
];

const predefinedPriorityFilters: FilterProps[] = [
  {
    label: 'All',
    filterModel: { items: [] },
    lightModeColor: 'black',
    darkModeColor: 'white',
  },
  {
    label: 'Low',
    filterModel: { items: [{ field: 'priority', operator: 'equals', value: 'Low' }] },
    lightModeColor: '#0044c2',
    darkModeColor: '#0044c2',
  },
  {
    label: 'Medium',
    filterModel: { items: [{ field: 'priority', operator: 'equals', value: 'Medium' }] },
    lightModeColor: '#1dc200',
    darkModeColor: '#1dc200',
  },
  {
    label: 'High',
    filterModel: { items: [{ field: 'priority', operator: 'equals', value: 'High' }] },
    lightModeColor: '#ff2323',
    darkModeColor: '#ff2323',
  },
];

const predefinedEffortLevelFilters: FilterProps[] = [
  {
    label: 'All',
    filterModel: { items: [] },
    lightModeColor: 'black',
    darkModeColor: 'white',
  },
  {
    label: 'Low',
    filterModel: { items: [{ field: 'effortLevel', operator: 'equals', value: 'Low' }] },
    lightModeColor: '#0044c2',
    darkModeColor: '#0044c2',
  },
  {
    label: 'Medium',
    filterModel: { items: [{ field: 'effortLevel', operator: 'equals', value: 'Medium' }] },
    lightModeColor: '#1dc200',
    darkModeColor: '#1dc200',
  },
  {
    label: 'High',
    filterModel: { items: [{ field: 'effortLevel', operator: 'equals', value: 'High' }] },
    lightModeColor: '#ff2323',
    darkModeColor: '#ff2323',
  },
];


type ProjectTaskTableProps = {
  myself: UserProps;
  projectTasks: TaskTableProps[];
  setIsTaskContentVisible: (value: boolean) => void;
  setCurrentPreviewTaskId: (value: number) => void;
};

export const TaskTable = (props: ProjectTaskTableProps) => {
  const { myself, projectTasks, setIsTaskContentVisible, setCurrentPreviewTaskId } = props
  const { mode } = useColorScheme();
  const className = `task-datagrid-${mode}`
  const apiRef = useGridApiRef();
  const [filterBy, setFilterBy] = useState<number>(1); // 1: status, 2: tag
  const [predefinedFilters, setPredefinedFilters] = useState<FilterProps[]>(predefinedStatusFilters);
  const [predefinedFiltersRowCount, setPredefinedFiltersRowCount] = useState<number[]>([]);
  const { accessToken } = useAuth();

  // Get team members
  const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
  // Update Project and Tag list
  const getTeamMembers = () => {
    // Load the latest project as initial process
    (async () => {
      const loadedTeamMembers: UserProps[] = await loadTeamMembers(myself, accessToken);
      if (loadedTeamMembers.length > 0) {
        setTeamMembers(loadedTeamMembers);
      }
    })();
  };
  useEffect(() => {
    getTeamMembers()
  }, [])

  const getFilteredRowsCount = useCallback(
    (filterModel: GridFilterModel) => {
      const rowIds = apiRef.current?.getAllRowIds();
      const filterState = apiRef.current?.getFilterState(filterModel);
      if (!rowIds || !filterState) {
        return 0;
      }

      const { filteredRowsLookup } = filterState;
      return rowIds.filter((rowId) => filteredRowsLookup[rowId] !== false).length;
    },
    [apiRef],
  );

  // Get Project tags
  const updateTagOptions = () => {
    (async () => {
      const loadedProjectTags: TagListProps[] = await loadProjectTags(myself, projectTasks[0].projectId || -1, accessToken);
      if (loadedProjectTags.length > 0) {
        const tagBasedFilters: FilterProps[] = loadedProjectTags.map(tag => ({
          label: tag.tagName,
          filterModel: { items: [{ field: 'concatTags', operator: 'contains', value: tag.tagName }] },
          lightModeColor: tag.tagColor,
          darkModeColor: tag.tagColor,
        }));
        setPredefinedFilters([
          {
            label: 'All',
            filterModel: { items: [] },
            lightModeColor: 'black',
            darkModeColor: 'white',
          }, ...tagBasedFilters])
      }
    })();
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    if (filterBy === 1) {
      setPredefinedFilters(predefinedStatusFilters)
    } else if (filterBy === 2) {
      updateTagOptions()
    } else if (filterBy === 3) {
      setPredefinedFilters(predefinedPriorityFilters)
    } else if (filterBy === 4) {
      setPredefinedFilters(predefinedEffortLevelFilters)
    }
    setAnchorEl(null);
  }, [filterBy]);

  useEffect(() => {
    // Calculate the row count for predefined filters
    if (projectTasks.length === 0) {
      return;
    }
    setPredefinedFiltersRowCount(
      predefinedFilters.map(({ filterModel }) => getFilteredRowsCount(filterModel)),
    );
  }, [predefinedFilters, projectTasks]);

  return (
    <ThemeProvider theme={theme}>
      <div style={{ height: '100%', overflow: 'hidden', borderRadius: '5px' }}>
        <Stack direction="row" gap={1} mb={1} flexWrap="wrap" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {predefinedFilters.map(({ label, filterModel, lightModeColor, darkModeColor }, index) => {
            const count = predefinedFiltersRowCount[index];
            return (
              <Button
                key={label}
                onClick={() => apiRef.current?.setFilterModel(filterModel)}
                variant="outlined"
                sx={{
                  color: mode === 'dark' ? darkModeColor : lightModeColor,
                  borderColor: mode === 'dark' ? darkModeColor : lightModeColor,
                  fontSize: '13px',
                  fontWeight: 'bold',
                  opacity: 0.85,
                  height: '25px'
                }}
              >
                {label} {count !== undefined ? `(${count})` : ''}
              </Button>
            );
          })}

          <IconButton
            component="p"
            onClick={handleClick}
            size="small"
            sx={{
              color: mode === 'dark' ? '#ffffff' : '#000000',
              borderRadius: 1,  // removes the circular style
              padding: 1,       // optional, adjust to taste
            }}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="long-menu"
            MenuListProps={{
              'aria-labelledby': 'long-button',
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            slotProps={{
              paper: {
                style: {
                  maxHeight: 300,
                },
              },
            }}
          >
            {options.map((option) => (
              <MenuItem key={option.filterId} onClick={() => { setFilterBy(option.filterId) }}>
                {option.name}
              </MenuItem>
            ))}
          </Menu>
        </Stack>

        <Box
          sx={{
            height: "97%",
            width: '100%',
          }}
        >
          <DataGrid
            onCellClick={(params) => { }}
            onCellDoubleClick={(params => {
              setIsTaskContentVisible(true);
              setCurrentPreviewTaskId(Number(params.id));
            })}
            onRowClick={(params, event, detail) => {
              // setIsTaskContentVisible(true);
              // setCurrentPreviewTaskId(Number(params.id));
            }}
            className={className}
            apiRef={apiRef}
            sx={{
              "& .MuiDataGrid-columnHeaderTitle": {
                fontSize: "0.875rem",
                fontWeight: 'bold',
              },
              '& .MuiDataGrid-row.Mui-selected': {
                backgroundColor: 'rgba(0, 123, 255, 0.2) !important', // light blue
              },
              '& .MuiDataGrid-row.Mui-selected:hover': {
                backgroundColor: 'rgba(0, 123, 255, 0.3) !important', // slightly darker on hover
              },
            }}
            style={{
              color: mode === 'dark' ? '#fbfcfc' : '#373737',
              borderColor: 'transparent',
              fontWeight: 'bold'
            }}
            rows={projectTasks}
            columns={getTaskColumns({ myself: myself, accessToken: accessToken, teamMembers: teamMembers })}
            initialState={{
              density: 'compact',
              filter: {
                filterModel: {
                  items: [
                    { field: 'status', operator: 'isAnyOf', value: ['Open', 'WIP'] }]
                }
              },
              sorting: {
                sortModel: [{ field: 'id', sort: 'desc' }],
              },
              pagination: {
                paginationModel: {
                  pageSize: 50,
                },
              },
              columns: {
                columnVisibilityModel: {
                  id: true,
                  summary: true,
                  priority: true,
                  effortLevel: true,
                  createdDate: true,
                  dueDate: true,
                  daysLeft: true,
                  status: true,
                  assigneeEmail: true,
                  assigneeName: true,
                  parentTaskId: true,
                  concatTags: false
                }
              }
            }
            }
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
              },
            }}
            keepNonExistentRowsSelected
            checkboxSelection
            disableRowSelectionOnClick
          />
        </Box>
      </div>
    </ThemeProvider >
  );
}
