import { useEffect, useState } from "react";
import LoadSearchList from "../workers/loadSearchList.ts?worker";
import LoadDMHistoryWorker from "../workers/loadDMHistoryWorker.ts?worker";
import LoadSpecificDMHistoryWorker from "../workers/loadSpecificDMHistoryWorker.ts?worker";
import LoadGMHistoryWorker from "../workers/loadGMHistoryWorker.ts?worker";
import LoadSpecificGMHistoryWorker from "../workers/loadSpecificGMHistoryWorker.ts?worker";
import { UserProps } from "../types";

const myself: UserProps = {
    userName: localStorage.getItem("userName") || "",
    userEmail: localStorage.getItem("userEmail") || "",
    avatarImgPath: "/path/to/user/Weikiy.jpg",
    online: true,
};

const LoadTest = () => {
    const [result1, setResult1] = useState<number | null>(null);

    // Load Search list
    useEffect(() => {
        console.log("Loading search list...")
        const loadSearchListWorker = new LoadSearchList();
        loadSearchListWorker.postMessage(myself);
        loadSearchListWorker.onmessage = (event) => {
            console.log("searchList:", event.data);
        };
        return () => {
            loadSearchListWorker.terminate();
        };
    }, []);

    // Load DM history
    useEffect(() => {
        console.log("Initial DM history data loading...")
        const loadDMHistoryWorker = new LoadDMHistoryWorker();
        loadDMHistoryWorker.postMessage(myself);
        loadDMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial DM history data loading completed");
            }
        };
        return () => {
            loadDMHistoryWorker.terminate();
        };
    }, []);

    // Load Specific DM history
    const test_dm_partner_email = myself.userEmail
    useEffect(() => {
        console.log("Initial Specific DM history data loading...")
        const loadSpecificDMHistoryWorker = new LoadSpecificDMHistoryWorker();
        loadSpecificDMHistoryWorker.postMessage({ userEmail: myself.userEmail, dmEmail: test_dm_partner_email });
        loadSpecificDMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial DM history data loading completed");
            }
        };
        return () => {
            loadSpecificDMHistoryWorker.terminate();
        };
    }, []);

    // Load GM history
    useEffect(() => {
        console.log("Initial GM history data loading...")
        const loadGMHistoryWorker = new LoadGMHistoryWorker();
        loadGMHistoryWorker.postMessage(myself);
        loadGMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial GM history data loading completed");
            }
        };
        return () => {
            loadGMHistoryWorker.terminate();
        };
    }, []);

    // Load Specific GM history
    const test_gm_group_email = "weikiy@weikiy.tech"
    useEffect(() => {
        console.log("Initial Specific GM history data loading...")
        const loadSpecificGMHistoryWorker = new LoadSpecificGMHistoryWorker();
        loadSpecificGMHistoryWorker.postMessage({ userEmail: myself.userEmail, gmEmail: test_gm_group_email });
        loadSpecificGMHistoryWorker.onmessage = (event) => {
            if (event.data === "done") {
                console.log("Initial GM history data loading completed");
            }
        };
        return () => {
            loadSpecificGMHistoryWorker.terminate();
        };
    }, []);


    return (
        <div>
            <div>result1: {result1}</div>
        </div>
    );
};

export default LoadTest;
