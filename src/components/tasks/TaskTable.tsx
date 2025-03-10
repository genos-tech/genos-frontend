import { useState, useCallback, useEffect } from "react";
import Box from '@mui/material/Box';
import { DataGrid, GridToolbar, GridFilterModel, useGridApiRef } from '@mui/x-data-grid';
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useColorScheme } from '@mui/joy/styles';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import { taskColumns, taskRows } from './sampleTaskLists';

const theme = createTheme({ cssVariables: true });

const predefinedFilters: { label: string; filterModel: GridFilterModel }[] = [
  {
    label: 'All',
    filterModel: { items: [] },
  },
  {
    label: 'Open',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Open' }] },
  },
  {
    label: 'WIP',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'WIP' }] },
  },
  {
    label: 'Closed',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Closed' }] },
  },
  {
    label: 'Deleted',
    filterModel: { items: [{ field: 'status', operator: 'equals', value: 'Deleted' }] },
  },
];

type TaskTableProps = {
  setIsTaskContentVisible: (value: boolean) => void;
};

export default function TaskTable(props: TaskTableProps) {
  const { setIsTaskContentVisible } = props
  const { mode } = useColorScheme();
  const className = `task-datagrid-${mode}`

  const apiRef = useGridApiRef();
  const [predefinedFiltersRowCount, setPredefinedFiltersRowCount] = useState<number[]>([]);
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

  useEffect(() => {
    // Calculate the row count for predefined filters
    if (taskRows.length === 0) {
      return;
    }

    setPredefinedFiltersRowCount(
      predefinedFilters.map(({ filterModel }) => getFilteredRowsCount(filterModel)),
    );
  }, [apiRef, taskRows, getFilteredRowsCount]);

  return (
    <ThemeProvider theme={theme}>
      <div style={{ overflow: 'hidden', borderRadius: '5px' }}>
        <Stack direction="row" gap={1} mb={1} flexWrap="wrap">
          {predefinedFilters.map(({ label, filterModel }, index) => {
            const count = predefinedFiltersRowCount[index];
            if (label === 'All') {
              return (
                <Button
                  key={label}
                  onClick={() => apiRef.current.setFilterModel(filterModel)}
                  variant="outlined"
                  sx={{
                    color: mode === 'dark' ? 'white' : 'black',
                    borderColor: mode === 'dark' ? 'white' : 'black',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: 0.85,
                    height: '30px'
                  }}
                >
                  {label} {count !== undefined ? `(${count})` : ''}
                </Button>
              );
            } else if (label === 'Open') {
              return (
                <Button
                  key={label}
                  onClick={() => apiRef.current.setFilterModel(filterModel)}
                  variant="outlined"
                  sx={{
                    color: mode === 'dark' ? '#2bc8ff' : '#002bff',
                    borderColor: mode === 'dark' ? '#2bc8ff' : '#002bff',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: 0.85,
                    height: '30px'
                  }}
                >
                  {label} {count !== undefined ? `(${count})` : ''}
                </Button>
              );
            } else if (label === 'WIP') {
              return (
                <Button
                  key={label}
                  onClick={() => apiRef.current.setFilterModel(filterModel)}
                  variant="outlined"
                  sx={{
                    color: '#e58700',
                    borderColor: '#e58700',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: 0.85,
                    height: '30px'
                  }}
                >
                  {label} {count !== undefined ? `(${count})` : ''}
                </Button>
              );
            } else if (label === 'Closed') {
              return (
                <Button
                  key={label}
                  onClick={() => apiRef.current.setFilterModel(filterModel)}
                  variant="outlined"
                  sx={{
                    color: mode === 'dark' ? '#0adc00' : '#1ec800',
                    borderColor: mode === 'dark' ? '#0adc00' : '#1ec800',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: 0.85,
                    height: '30px'
                  }}
                >
                  {label} {count !== undefined ? `(${count})` : ''}
                </Button>
              );
            } else if (label === 'Deleted') {
              return (
                <Button
                  key={label}
                  onClick={() => apiRef.current.setFilterModel(filterModel)}
                  variant="outlined"
                  sx={{
                    color: mode === 'dark' ? '#ff2e2e' : '#c80000',
                    borderColor: mode === 'dark' ? '#ff2e2e' : '#c80000',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: 0.85,
                    height: '30px'
                  }}
                >
                  {label} {count !== undefined ? `(${count})` : ''}
                </Button>
              );
            }
          })}
        </Stack>
        <Box
          sx={{
            height: "97%",
            width: '100%',
          }}
        >
          <DataGrid
            onCellClick={(params) => (console.log("Cell clicked:", params))}
            onRowClick={(params, event, detail) => {
              console.log("Row clicked:", params);
              setIsTaskContentVisible(true);
            }}
            className={className}
            apiRef={apiRef}
            sx={{
              "& .MuiDataGrid-columnHeaderTitle": {
                fontSize: "0.875rem",
                fontWeight: 'bold',
              },
            }}
            style={{
              color: mode === 'dark' ? '#fbfcfc' : '#373737',
              borderColor: 'transparent',
              fontWeight: 'bold'
            }}
            rows={taskRows}
            columns={taskColumns}
            initialState={{
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
                  parentTaskId: true
                }
              }
            }}
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
              },
            }}
            checkboxSelection
            disableRowSelectionOnClick
            keepNonExistentRowsSelected
          />
        </Box>
      </div>
    </ThemeProvider >
  );
}
