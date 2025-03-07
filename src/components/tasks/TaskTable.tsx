/* eslint-disable jsx-a11y/anchor-is-valid */
import * as React from 'react';
import { ColorPaletteProp } from '@mui/joy/styles';
import Stack from '@mui/joy/Stack';
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Divider from '@mui/joy/Divider';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Link from '@mui/joy/Link';
import Input from '@mui/joy/Input';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import Table from '@mui/joy/Table';
import Sheet from '@mui/joy/Sheet';
import Checkbox from '@mui/joy/Checkbox';
import IconButton from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import Dropdown from '@mui/joy/Dropdown';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { visuallyHidden } from '@mui/utils';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import { tasks } from './sampleTaskLists';

interface Data {
  id: string;
  summary: string;
  priority: string;
  effortLevel: string;
  status: string;
  parentTaskId: string;
  createdDate: string;
  dueDate: string;
  daysLeft: number;
  assigneeEmail: string;
  assigneeName: string;
  emptyColumn: string;
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

type Order = 'asc' | 'desc';

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string },
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function RowMenu() {
  return (
    <Dropdown>
      <MenuButton
        slots={{ root: IconButton }}
        slotProps={{ root: { variant: 'plain', color: 'neutral', size: 'sm' } }}
      >
        <MoreHorizRoundedIcon />
      </MenuButton>
      <Menu size="sm" sx={{ minWidth: 140 }}>
        <MenuItem>Edit</MenuItem>
        <MenuItem>Close</MenuItem>
        <MenuItem>WIP</MenuItem>
        <Divider />
        <MenuItem color="danger">Delete</MenuItem>
      </Menu>
    </Dropdown>
  );
}
export default function TaskTable() {
  const renderFilters = (numSelected: number) => (
    <React.Fragment>
      <FormControl size="sm">
        <FormLabel>Status</FormLabel>
        <Select
          size="sm"
          placeholder="Filter by status"
          slotProps={{ button: { sx: { whiteSpace: 'nowrap' } } }}
        >
          <Option value="all">All</Option>
          <Option value="open">Open</Option>
          <Option value="inprogress">Inprogress</Option>
          <Option value="closed">Closed</Option>
          <Option value="deleted">Deleted</Option>
        </Select>
      </FormControl>
      <FormControl size="sm">
        <FormLabel>Assignee</FormLabel>
        <Select size="sm" placeholder="All">
          <Option value="all">All</Option>
          <Option value="ken">Ken</Option>
        </Select>
      </FormControl>
      <FormControl size="sm">
        <FormLabel>Priority</FormLabel>
        <Select size="sm" placeholder="All">
          <Option value="all">All</Option>
          <Option value="low">Low</Option>
          <Option value="medium">Medium</Option>
          <Option value="high">High</Option>
        </Select>
      </FormControl>
    </React.Fragment>
  );


  const [order, setOrder] = React.useState<Order>('asc');
  const [orderBy, setOrderBy] = React.useState<keyof Data>('id');
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof Data,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };
  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = tasks.map((task) => task.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };
  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: readonly string[] = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }
    setSelected(newSelected);
  };

  function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  }

  interface HeadCell {
    disablePadding: boolean;
    id: keyof Data;
    label: string;
    numeric: boolean;
  }

  const headCells: readonly HeadCell[] = [
    {
      id: 'id',
      numeric: false,
      disablePadding: true,
      label: 'Task Id',
    },
    {
      id: 'summary',
      numeric: false,
      disablePadding: false,
      label: 'Summary',
    },
    {
      id: 'assigneeName',
      numeric: false,
      disablePadding: false,
      label: 'Assignee',
    },
    {
      id: 'priority',
      numeric: false,
      disablePadding: false,
      label: 'Priority',
    },
    {
      id: 'effortLevel',
      numeric: false,
      disablePadding: false,
      label: 'Effort Level',
    },
    {
      id: 'status',
      numeric: false,
      disablePadding: false,
      label: 'Status',
    },
    {
      id: 'parentTaskId',
      numeric: false,
      disablePadding: false,
      label: 'Parent Task Id',
    },
    {
      id: 'createdDate',
      numeric: false,
      disablePadding: false,
      label: 'Created Date',
    },
    {
      id: 'dueDate',
      numeric: false,
      disablePadding: false,
      label: 'Due Date',
    },
    {
      id: 'daysLeft',
      numeric: true,
      disablePadding: false,
      label: 'Days Left',
    },
    {
      id: 'emptyColumn',
      numeric: false,
      disablePadding: false,
      label: '',
    }
  ];


  interface EnhancedTableProps {
    numSelected: number;
    onRequestSort: (event: React.MouseEvent<unknown>, property: keyof Data) => void;
    onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    order: Order;
    orderBy: string;
    rowCount: number;
  }

  function EnhancedTableHead(props: EnhancedTableProps) {
    const { onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort } =
      props;
    const createSortHandler =
      (property: keyof Data) => (event: React.MouseEvent<unknown>) => {
        onRequestSort(event, property);
      };

    const columnWidths = [
      120, // task id
      300, // Summary
      130, // Assignee
      100, // Priority
      100, // Effort Level
      100, // Status
      130, // Parent task id
      100, // Created Date
      100, // Due Date
      100, // Days Left
      50, // EmptyColumn
    ];

    const ariaLabels = [
      "first",
      "middle",
      "middle",
      "middle",
      "middle",
      "middle",
      "middle",
      "middle",
      "middle",
      "last"
    ]

    return (
      <thead>
        <tr>
          <th>
            <Checkbox
              indeterminate={numSelected > 0 && numSelected < rowCount}
              checked={rowCount > 0 && numSelected === rowCount}
              onChange={onSelectAllClick}
              slotProps={{
                input: {
                  'aria-label': 'select all desserts',
                },
              }}
              sx={{ verticalAlign: 'sub' }}
            />
          </th>
          {headCells.map((headCell, index) => {
            const active = orderBy === headCell.id;
            return (
              <th
                key={headCell.id}
                aria-label={ariaLabels[index]}
                aria-sort={
                  active
                    ? ({ asc: 'ascending', desc: 'descending' } as const)[order]
                    : undefined
                }
                style={{ width: columnWidths[index], textAlign: 'center', padding: '12px 6px' }}
              >
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <Link
                  underline="none"
                  color="neutral"
                  textColor={active ? 'primary.plainColor' : undefined}
                  component="button"
                  onClick={createSortHandler(headCell.id)}
                  startDecorator={
                    headCell.numeric ? (
                      <ArrowDownwardIcon
                        sx={[active ? { opacity: 1 } : { opacity: 0 }]}
                      />
                    ) : null
                  }
                  endDecorator={
                    !headCell.numeric ? (
                      <ArrowDownwardIcon
                        sx={[active ? { opacity: 1 } : { opacity: 0 }]}
                      />
                    ) : null
                  }
                  sx={{
                    fontWeight: 'lg',

                    '& svg': {
                      transition: '0.2s',
                      transform:
                        active && order === 'desc' ? 'rotate(0deg)' : 'rotate(180deg)',
                    },

                    '&:hover': { '& svg': { opacity: 1 } },
                  }}
                >
                  {headCell.label}
                  {active ? (
                    <Box component="span" sx={visuallyHidden}>
                      {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                    </Box>
                  ) : null}
                </Link>
              </th>
            );
          })}
        </tr>
      </thead>
    );
  }

  interface EnhancedTableToolbarProps {
    numSelected: number;
  }
  function EnhancedTableToolbar(props: EnhancedTableToolbarProps) {
    const { numSelected } = props;
    return (
      <Box
        sx={[
          {
            display: 'flex',
            alignItems: 'center',
            py: 1,
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            borderTopLeftRadius: 'var(--unstable_actionRadius)',
            borderTopRightRadius: 'var(--unstable_actionRadius)',
          }
        ]}
      >
        {numSelected > 0 ? (
          <Stack direction="row" spacing={1.5}>
            {numSelected > 0 && (
              <Box>
                <IconButton
                  component='p'
                  variant="soft"
                  color='success'
                  sx={{
                    fontSize: '15px',
                    paddingRight: '10px'
                  }}>
                  <CheckCircleOutlineIcon />
                  Close
                </IconButton>

                <IconButton
                  component='p'
                  variant="soft"
                  color='primary'
                  sx={{
                    fontSize: '15px',
                    paddingRight: '10px',
                    ml: 1
                  }}>
                  <CheckCircleOutlineIcon />
                  WIP
                </IconButton>

                <IconButton
                  component='p'
                  variant="soft"
                  color='danger'
                  sx={{
                    fontSize: '15px',
                    paddingRight: '10px',
                    ml: 1
                  }}>
                  <DeleteIcon />
                  Delete
                </IconButton>

              </Box>
            )}
          </Stack>
        ) : (
          <Typography
            level="body-lg"
            sx={{ flex: '1 1 100%' }}
            id="tableTitle"
            component="div"
          >
            Task
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <React.Fragment>
      <Box
        className="SearchAndFilters-tabletUp"
        sx={{
          borderRadius: 'sm',
          py: 2,
          display: { xs: 'none', sm: 'flex' },
          flexWrap: 'wrap',
          gap: 1.5,
          '& > *': {
            minWidth: { xs: '120px', md: '160px' },
          },
        }}
      >
        <FormControl sx={{ flex: 1 }} size="sm">
          <FormLabel>Search for task</FormLabel>
          <Input size="sm" placeholder="Search" startDecorator={<SearchIcon />} />
        </FormControl>
        {renderFilters(selected.length)}
      </Box>
      <Sheet
        className="TaskTableContainer"
        variant="outlined"
        sx={{
          display: { xs: 'none', sm: 'initial' },
          width: '100%',
          borderRadius: 'sm',
          flexShrink: 1,
          overflow: 'auto',
          minHeight: 0,
          boxShadow: 'sm'
        }}
      >
        <EnhancedTableToolbar numSelected={selected.length} />
        <Table
          aria-labelledby="tableTitle"
          stickyHeader
          hoverRow
          sx={{
            '--TableCell-headBackground': 'var(--joy-palette-background-level1)',
            '--Table-headerUnderlineThickness': '1px',
            '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',
            '--TableCell-paddingY': '4px',
            '--TableCell-paddingX': '8px',
            '--TableCell-selectedBackground': (theme) =>
              theme.vars.palette.warning.softBg,
            '& thead th:nth-child(1)': {
              width: '40px',
            },
            '& thead th:nth-child(2)': {
              width: '30%',
            },
            '& tr > *:nth-child(n+3)': { textAlign: 'right' },
            '& tr > *:last-child': {
              position: 'sticky',
              right: 0,
              bgcolor: 'var(--TableCell-headBackground)',
            },
          }}
        >
          <EnhancedTableHead
            numSelected={selected.length}
            order={order}
            orderBy={orderBy}
            onSelectAllClick={handleSelectAllClick}
            onRequestSort={handleRequestSort}
            rowCount={tasks.length}
          />
          <tbody>
            {[...tasks]
              .sort(getComparator(order, orderBy))
              .map((task, index) => {
                const isItemSelected = selected.includes(task.id);
                const labelId = `enhanced-table-checkbox-${index}`;

                return (
                  <tr
                    onClick={(event) => handleClick(event, task.id)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={task.id}
                    // selected={isItemSelected}
                    style={
                      isItemSelected
                        ? ({
                          '--TableCell-dataBackground':
                            'var(--TableCell-selectedBackground)',
                          '--TableCell-headBackground':
                            'var(--TableCell-selectedBackground)',
                        } as React.CSSProperties)
                        : {}
                    }
                  >
                    <th scope="row">
                      <Checkbox
                        checked={isItemSelected}
                        slotProps={{
                          input: {
                            'aria-labelledby': labelId,
                          },
                        }}
                        sx={{ verticalAlign: 'top' }}
                      />
                    </th>
                    <th id={labelId} scope="row">
                      {task.id}
                    </th>
                    <td>
                      <Typography
                        level="body-sm"
                        textAlign='left'
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: '1',
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {task.summary}
                      </Typography>
                    </td>
                    <td>
                      <Box
                        textAlign='left'
                        sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Avatar size="sm">{task.assigneeEmail}</Avatar>
                        <div>
                          <Typography level="body-xs">{task.assigneeName}</Typography>
                        </div>
                      </Box>
                    </td>
                    <td>
                      <Chip
                        variant="soft"
                        size="sm"
                        color={
                          {
                            High: 'danger',
                            Medium: 'primary',
                            Low: 'success',
                          }[task.priority] as ColorPaletteProp
                        }
                        sx={{ display: "block", margin: "0 auto" }}
                      >
                        {task.priority}
                      </Chip>
                    </td>
                    <td>
                      <Chip
                        variant="soft"
                        size="sm"
                        color={
                          {
                            High: 'danger',
                            Medium: 'primary',
                            Low: 'success',
                          }[task.effortLevel] as ColorPaletteProp
                        }
                        sx={{ display: "block", margin: "0 auto" }}
                      >
                        {task.effortLevel}
                      </Chip>
                    </td>
                    <td>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Chip
                          variant="soft"
                          size="sm"
                          startDecorator={
                            {
                              Open: <CheckCircleOutlineIcon />,
                              WIP: <AutorenewIcon />,
                              Closed: <CheckCircleOutlineIcon />,
                              Deleted: <DeleteOutlineIcon />,
                            }[task.status]
                          }
                          color={
                            {
                              Open: 'neutral',
                              WIP: 'primary',
                              Closed: 'success',
                              Deleted: 'danger',
                            }[task.status] as ColorPaletteProp
                          }
                        >
                          {task.status}
                        </Chip>
                      </Box>
                    </td>
                    <td>
                      <Typography textAlign='center' level="body-xs">{task.parentTaskId}</Typography>
                    </td>
                    <td>
                      <Typography textAlign='center' level="body-xs">{task.createdDate}</Typography>
                    </td>
                    <td>
                      <Typography textAlign='center' level="body-xs">{task.dueDate}</Typography>
                    </td>
                    <td>
                      <Typography textAlign='center' level="body-xs">{task.daysLeft}</Typography>
                    </td>
                    <td>
                      <RowMenu />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </Table>
      </Sheet>
    </React.Fragment >
  );
}
