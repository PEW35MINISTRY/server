import database, {formatTestResult, query, queryAll, queryTest, TestResult} from "../database/database.mjs";
import { Exception } from "../../api/api-types.mjs";
import * as log from '../log.mjs';
import { DB_USER } from "../database/database-types.mjs";
import { SocketMessage } from "./chat-types.mjs";

export const fetchName = async (userId:number):Promise<string> => {
    const result:TestResult = await queryTest("SELECT display_name FROM user_table WHERE user_id = $1;", [userId]);
    if(result.success) 
        return result.result;
    else 
        return userId.toString();
}

export const contactAllowed = async (senderId:number, receiverId:number) => {
    //Database check friends, circle, 
}

export const fetchNames = async (userIdList:number[]):Promise<Array<{id:number, name:string}>> => {
    const list:any[] = await queryAll("SELECT user_id, display_name FROM user_table;", []);

    return list.filter((entry) => userIdList.includes(entry.user_id))
        .map((entry) => ({id: entry.user_id, name: entry.display_name}));
}

export const formatMessageNames = async (content:SocketMessage):Promise<SocketMessage> =>  ({
        ...content,
        time: new Date().getTime(),
        senderName: await fetchName(content.senderId),
        recipientName: await fetchName(content.recipientId)
    });

