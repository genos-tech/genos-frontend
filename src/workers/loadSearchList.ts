import loadSearchList from '../components/loadFromBackend/loadSearchList';
import { UserProps, SearchListProps } from "../types";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;
    const teamName: string = "origin-tech";

    console.log(myself)

    // Load data from backend
    const searchList: SearchListProps[] = await loadSearchList({
        myself: myself,
        teamName: teamName,
        accessToken: accessToken || ""
    });
    console.log("searchList:", searchList)

    // Return the list to the main thread
    self.postMessage(searchList);
};

export { };
