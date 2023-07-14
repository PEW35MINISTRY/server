import { Exception } from "../../api/api-types.mjs";
import * as log from '../log.mjs';
import { SocketMessage } from "./chat-types.mjs";
import USER from "../models/user.mjs";
import { DB_SELECT_CONTACTS, DB_SELECT_USER } from "../database/queries/user-queries.mjs";
import { ProfileListItem } from "../../api/profile/profile-types.mjs";

/* Socket Direct Messaging */
export const fetchContacts = async (userID:number):Promise<ProfileListItem[]> => {
    const userList:ProfileListItem[] =  await DB_SELECT_CONTACTS(userID); 

    return userList;
}

export const fetchName = async (userID:number):Promise<string> => {
    const userProfile:USER = await DB_SELECT_USER(new Map([['userID', userID]]));
    return userProfile.displayName;
}

export const fetchNames = async (userIDList:number[]):Promise<ProfileListItem[]> => {
    const userList:ProfileListItem[] =  await DB_SELECT_CONTACTS(-1);

    return userList;
}

export const formatMessageNames = async (content:SocketMessage, isCircle=false):Promise<SocketMessage> =>  ({
        ...content,
        time: new Date().getTime(),
        senderName: await fetchName(content.senderID),
        recipientName: isCircle ?  await fetchCircleName(content.recipientID) : await fetchName(content.recipientID)
    });

/* Socket Direct Messaging */

//TEMP TODO: Create Circle Database:
const circleNameMap = new Map<number, string>(); //circleID:socketID //TODO Generate from DB ALL
circleNameMap.set(100, "Owatonna");
circleNameMap.set(200, "Faribault");
circleNameMap.set(300, "Northfield");

export const fetchCircleName = async (circleID:number):Promise<string> => {

    return circleNameMap.get(circleID);
}

export const fetchCircleMessageNames = async (circleIDList:number[]):Promise<Array<{ID:number, name:string}>> => {

    return circleIDList
        .map((entry) => ({ID: entry, name: circleNameMap.get(entry)}));
}

export const fetchUserCircles = async (userID:number):Promise<Array<{ID:number, name:string}>> =>  //TODo Access Database
    Array.from(circleNameMap.entries()).map(([ID, name]) => ({ID: ID, name: name}));

