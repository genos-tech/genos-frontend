import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectProps } from "../../../../../types/tasks";
import { Toggler } from "../common";

type TagsListItemProps = {
    projectId: number;
    currentProject?: ProjectProps | null;
    setSelectedTagForFiltering: (value: string) => void;
    setFilterBy: (value: number) => void;
    setCurrentFilterName: (value: string) => void;
};
export const TagsListItem = (props: TagsListItemProps) => {
    const {
        projectId,
        currentProject,
        setSelectedTagForFiltering,
        setFilterBy,
        setCurrentFilterName,
    } = props;
    const { mode } = useColorScheme();

    return (
        <Toggler
            key={`toggler-TeamProjects-tags-${projectId}`}
            defaultExpanded={false}
            renderToggle={({ open, setOpen }) => (
                <ListItemButton
                    color="neutral"
                    sx={{ ml: "45px", mr: "8px", pl: "30px" }}
                    onClick={() => {
                        setOpen(!open);
                    }}
                >
                    <ListItemContent>
                        <Typography
                            level="title-sm"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                            startDecorator={<LocalOfferIcon />}
                        >
                            Tags
                        </Typography>
                    </ListItemContent>
                    <KeyboardArrowDownIcon
                        sx={[
                            open
                                ? {
                                      transform: "rotate(180deg)",
                                  }
                                : {
                                      transform: "none",
                                  },
                        ]}
                    />
                </ListItemButton>
            )}
        >
            <List>
                {currentProject?.projectId === projectId &&
                    currentProject !== null &&
                    currentProject.projectTags.map(
                        ({ tagName, tagColor, tagTextColor }, index) => {
                            return (
                                <ListItem key={`listitem-${tagName}-${index}`}>
                                    <ListItemButton
                                        color={"neutral"}
                                        onClick={() => {
                                            setSelectedTagForFiltering(`/${tagName}/`);
                                            setFilterBy(2);
                                            setCurrentFilterName(tagName);
                                        }}
                                        sx={{
                                            overflow: "hidden",
                                            ml: "45px",
                                            mr: "8px",
                                            pl: "20px",
                                        }}
                                    >
                                        <Chip
                                            key={`chip-${tagName}-${index}`}
                                            variant="outlined"
                                            sx={{
                                                color: mode === "dark" ? "white" : "black",
                                                fontWeight: "bold",
                                                borderRadius: "5px",
                                                borderWidth: "3px",
                                                borderColor: alpha(
                                                    tagColor,
                                                    mode === "dark" ? 0.5 : 0.75
                                                ),
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "1px 4px",
                                            }}
                                            size="sm"
                                        >
                                            {tagName}
                                        </Chip>
                                    </ListItemButton>
                                </ListItem>
                            );
                        }
                    )}
            </List>
        </Toggler>
    );
};
