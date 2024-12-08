import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import USER from '../1-models/userModel.mjs';
import * as log from '../10-utilities/logging/log.mjs';
import { DB_SELECT_CONTACT_LIST, DB_SELECT_USER } from '../2-database/queries/user-queries.mjs';
import { SocketMessage } from './chat-types.mjs';

/* Socket Direct Messaging */
export const fetchContacts = async (userID:number):Promise<ProfileListItem[]> => {
    const userList:ProfileListItem[] =  await DB_SELECT_CONTACT_LIST(userID); 

    return userList;
}

export const fetchName = async (userID:number):Promise<string> => {
    const userProfile:USER = await DB_SELECT_USER(new Map([['userID', userID]]));
    return userProfile.displayName;
}

export const fetchNames = async (userIDList:number[]):Promise<ProfileListItem[]> => {
    const userList:ProfileListItem[] =  [];

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
circleNameMap.set(100, 'Owatonna');
circleNameMap.set(200, 'Faribault');
circleNameMap.set(300, 'Northfield');

export const fetchCircleName = async (circleID:number):Promise<string> => {

    return circleNameMap.get(circleID);
}

export const fetchCircleMessageNames = async (circleIDList:number[]):Promise<Array<{ID:number, name:string}>> => {

    return circleIDList
        .map((entry) => ({ID: entry, name: circleNameMap.get(entry)}));
}

export const fetchUserCircles = async (userID:number):Promise<Array<{ID:number, name:string}>> =>  //TODo Access Database
    Array.from(circleNameMap.entries()).map(([ID, name]) => ({ID: ID, name: name}));

