import { useEffect } from "react";

import { TaskMetaProps, TaskMetaTreeNode } from "../../types/tasks";

type initCurrentTaskChainProps = {
    taskMeta: TaskMetaProps[];
    currentTaskChain?: TaskMetaTreeNode[];
    setCurrentTaskChain: (value: TaskMetaTreeNode[]) => void;
};
export const initCurrentTaskChain = (props: initCurrentTaskChainProps) => {
    const { taskMeta, currentTaskChain, setCurrentTaskChain } = props;
    useEffect(() => {
        if (currentTaskChain === undefined && taskMeta.length === 0) {
            setCurrentTaskChain([]);
        }
    }, [taskMeta]);
};
