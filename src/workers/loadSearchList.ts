import loadSearchList from '../components/loadFromBackend/loadSearchList';
import { UserProps, SearchListProps } from "../types";

self.onmessage = async (event) => {
    const myself: UserProps = event.data;

    // Load data from backend
    const searchList: SearchListProps[] = await loadSearchList();
    console.log("searchList:", searchList)

    // Return the list to the main thread
    self.postMessage(searchList);
};

export { };
