import database, {formatTestResult, query, queryAll, queryTest, TestResult} from "../database/database.mjs";
import { Exception } from "../../api/api-types.mjs";
import * as log from '../log.mjs';
import { DB_USER } from "../database/database-types.mjs";
import { SocketMessage } from "./chat-types.mjs";
import { isArray } from "util";

/* Socket Direct Messaging */
export const fetchContacts = async (userId:number):Promise<Array<{id:number, name:string}>> => { //TODO Filter Correctly
    const result =  await queryAll("SELECT user_id, display_name FROM user_table;", []); 
    if(result && Array.isArray(result) && result.length > 0) 
        return result.map((entry) => ({id: entry.user_id, name: entry.display_name}));
    else return [];
}

export const fetchName = async (userId:number):Promise<string> => {
    const result:any = await query("SELECT display_name FROM user_table WHERE user_id = $1;", [userId]);
    return result.display_name;
}

export const fetchNames = async (userIdList:number[]):Promise<Array<{id:number, name:string}>> => {
    const list:any[] = await queryAll("SELECT user_id, display_name FROM user_table;", []);

    return list.filter((entry) => userIdList.includes(entry.user_id))
        .map((entry) => ({id: entry.user_id, name: entry.display_name}));
}

export const formatMessageNames = async (content:SocketMessage, isCircle=false):Promise<SocketMessage> =>  ({
        ...content,
        time: new Date().getTime(),
        senderName: await fetchName(content.senderId),
        recipientName: isCircle ?  await fetchCircleName(content.recipientId) : await fetchName(content.recipientId)
    });

/* Socket Direct Messaging */

//TEMP TODO: Create Circle Database:
const circleNameMap = new Map<number, string>(); //circleId:socketId //TODO Generate from DB ALL
circleNameMap.set(100, "Owatonna");
circleNameMap.set(200, "Faribault");
circleNameMap.set(300, "Northfield");

export const fetchCircleName = async (circleId:number):Promise<string> => {

    return circleNameMap.get(circleId);
}

export const fetchCircleMessageNames = async (circleIdList:number[]):Promise<Array<{id:number, name:string}>> => {

    return circleIdList
        .map((entry) => ({id: entry, name: circleNameMap.get(entry)}));
}

export const fetchUserCircles = async (userId:number):Promise<Array<{id:number, name:string}>> =>  //TODo Access Database
    Array.from(circleNameMap.entries()).map(([id, name]) => ({id: id, name: name}));

