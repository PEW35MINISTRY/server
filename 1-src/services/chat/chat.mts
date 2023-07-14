import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events.js";
import * as log from "../log.mjs";
import { SocketMessage } from "./chat-types.mjs";
import { formatMessageNames, fetchNames } from "./chat-utilities.mjs";

const contactMap = new Map<number, string>(); //userID:socketID (Currently Online)

const getSocketID = (userID: number):string => contactMap.get(userID);

const getUserID = (socketID: string):number => {
    const match:[number, string] = [...contactMap].find(([key, val]) => val === socketID); 
    if(match && match.length) 
        return match[0];
    else
        return 0;
}
export default (chatIO: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => chatIO.on("connection", async (socket:Socket) => { //https://socket.io/docs/v3/emit-cheatsheet/
    log.event('\nChat: New Connection:', socket.handshake.auth.userID, socket.id);
    
    contactMap.set(socket.handshake.auth.userID, socket.id);
    log.event('Direct Contacts Online: ', contactMap);
   
    //Announce Online
    socket.emit('server', 'Welcome to Chat!'); 
    // chatIO.emit('server', `User: ${socket.handshake.auth.userID} has joined Direct Chat!`); 

//Socket Listeners
    socket.on('log', (text:string)=>{
        log.event('Chat Event:', socket.id, getUserID(socket.id), text);
    });

    socket.on('leave', (userID:number)=>{
        log.event('Direct Chat: Leaving:', userID, socket.id);
        // chatIO.emit('server', `User ${userID} has left the chat`)
        contactMap.delete(userID);
        log.event('Direct Contacts Online: ', contactMap);
    });

    socket.on('disconnect', ()=>{
        log.event('Chat: Disconnecting:', socket.id);
    });

    socket.on('direct-message', async (content:SocketMessage)=> {
        log.event('Direct Chat: ', content);

        //Note: Not authenticating Message

        if(contactMap.has(content.recipientID)) {
            const details = await formatMessageNames(content);
            chatIO.to(contactMap.get(details.recipientID)).emit('direct-message', details);
            if(content.senderID != content.recipientID) 
                socket.emit('direct-message', details);
            log.event(`Direct Message: [${details.time}] ${details.senderID}|${details.senderName} to ${details.recipientID}|${details.recipientName}:`, content.message);
        } else 
            socket.emit('server', 'Failed to send message: \"'+content.message+'/"'); //TODO Temp User is Offline
        // TODO Send to Database
    });

    socket.on('circle-join', async (circleID:number)=> {
        log.event('Joining Circle: ', socket.id, circleID);
        const roomID:string = circleID.toString();
        socket.join(roomID);

        socket.emit('server', `Current Members: ${(await (await fetchNames(Array.from(await chatIO.in(roomID).fetchSockets()).map(s => getUserID(s.id)))).map(user => user.displayName).join('\n'))}`);
        // log.event(`Current Members: ${(await (await fetchNames(Array.from(await chatIO.in(content.recipientID.toString()).fetchSockets()).map(s => getUserID(s.id)))).map(user => user.name))}`);

        // TODO Send to Database
    });

    socket.on('circle-message', async (content:SocketMessage)=> {
        log.event('Circle Chat: ', content);
        const roomID:string = content.recipientID.toString();

        //Note: Not authenticating Message
        if(!socket.rooms.has(roomID))
            socket.join(roomID);

        chatIO.to(roomID).emit('circle-message', await formatMessageNames(content, true));

        // TODO Send to Database
    });
    
    
  });