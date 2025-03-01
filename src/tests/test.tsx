import { useEffect, useState } from "react";
import Worker from "../workers/worker.ts?worker";
import {
    addData,
    getData
} from "../components/indexedDBUtils/crud";

const WorkerWithIndexedDBTest = () => {
    ////////////////////////////
    // Web Worker Testing
    ////////////////////////////

    const [result1, setResult1] = useState<number | null>(null);
    const [result2, setResult2] = useState<number | null>(null);
    const [result3, setResult3] = useState<number | null>(null);

    useEffect(() => {
        const worker = new Worker();

        worker.onmessage = (event) => {
            setResult1(event.data);
            console.log("Main thread received from worker:", event.data);
        };

        worker.postMessage(10); // Send data to worker

        return () => {
            worker.terminate();
        };
    }, []);

    useEffect(() => {
        const worker = new Worker();

        worker.onmessage = (event) => {
            setResult2(event.data);
            console.log("Main thread received from worker:", event.data);
        };

        worker.postMessage(20); // Send data to worker

        return () => {
            worker.terminate();
        };
    }, []);

    useEffect(() => {
        const worker = new Worker();

        worker.onmessage = (event) => {
            setResult3(event.data);
            console.log("Main thread received from worker:", event.data);
        };

        worker.postMessage(30); // Send data to worker

        return () => {
            worker.terminate();
        };
    }, []);

    ////////////////////////////
    // IndexedDB Testing
    ////////////////////////////

    const [dmMessage, setDMMessage] = useState<string>("None");
    const id = "jun@jun_8"

    useEffect(() => {

        // addData
        (async () => {
            // await deleteIndexedDB()

            await addData({
                storeName: "dm_messages",
                partner_email: "jun@jun",
                messageId_with_partner_email: id,
                data: {
                    messageId_with_partner_email: id,
                    partner_email: "jun@jun",
                    content: "hello",
                    sender: {
                        name: "jun",
                        email: "jun@jun"
                    }
                }
            })

            const dm_message = await getData("dm_messages", id);
            console.log("dm_message.content:", dm_message.content)
            setDMMessage(dm_message.content);
        })();

    }, []);


    return (
        <div>
            <div>Worker Result1: {result1}</div>
            <div>Worker Result2: {result2}</div>
            <div>Worker Result3: {result3}</div>
            <div>dmMessage: {dmMessage}</div>
        </div>
    );
};

export default WorkerWithIndexedDBTest;
