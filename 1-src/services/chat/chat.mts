import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events.js";
import * as log from "../log.mjs";
import { SocketMessage } from "./chat-types.mjs";
import { formatMessageNames, fetchNames } from "./chat-utilities.mjs";

const contactMap = new Map<number, string>(); //userId:socketId (Currently Online)

const getSocketId = (userId: number):string => contactMap.get(userId);

const getUserId = (socketId: string):number => {
    const match:[number, string] = [...contactMap].find(([key, val]) => val === socketId); 
    if(match && match.length) 
        return match[0];
    else
        return 0;
}
export default (chatIO: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => chatIO.on("connection", async (socket:Socket) => { //https://socket.io/docs/v3/emit-cheatsheet/
    log.event('\nChat: New Connection:', socket.handshake.auth.userId, socket.id);
    
    contactMap.set(socket.handshake.auth.userId, socket.id);
    log.event('Direct Contacts Online: ', contactMap);
   
    //Announce Online
    socket.emit('server', 'Welcome to Chat!'); 
    // chatIO.emit('server', `User: ${socket.handshake.auth.userId} has joined Direct Chat!`); 

//Socket Listeners
    socket.on('log', (text:string)=>{
        log.event('Chat Event:', socket.id, getUserId(socket.id), text);
    });

    socket.on('leave', (userId:number)=>{
        log.event('Direct Chat: Leaving:', userId, socket.id);
        // chatIO.emit('server', `User ${userId} has left the chat`)
        contactMap.delete(userId);
        log.event('Direct Contacts Online: ', contactMap);
    });

    socket.on('disconnect', ()=>{
        log.event('Chat: Disconnecting:', socket.id);
    });

    socket.on('direct-message', async (content:SocketMessage)=> {
        log.event('Direct Chat: ', content);

        //Note: Not authenticating Message

        if(contactMap.has(content.recipientId)) {
            const details = await formatMessageNames(content);
            chatIO.to(contactMap.get(details.recipientId)).emit('direct-message', details);
            if(content.senderId != content.recipientId) 
                socket.emit('direct-message', details);
            log.event(`Direct Message: [${details.time}] ${details.senderId}|${details.senderName} to ${details.recipientId}|${details.recipientName}:`, content.message);
        } else 
            socket.emit('server', 'Failed to send message: \"'+content.message+'/"'); //TODO Temp User is Offline
        // TODO Send to Database
    });

    socket.on('circle-join', async (circleId:number)=> {
        log.event('Joining Circle: ', socket.id, circleId);
        const roomId:string = circleId.toString();
        socket.join(roomId);

        socket.emit('server', `Current Members: ${(await (await fetchNames(Array.from(await chatIO.in(roomId).fetchSockets()).map(s => getUserId(s.id)))).map(user => user.name).join('\n'))}`);
        // log.event(`Current Members: ${(await (await fetchNames(Array.from(await chatIO.in(content.recipientId.toString()).fetchSockets()).map(s => getUserId(s.id)))).map(user => user.name))}`);

        // TODO Send to Database
    });

    socket.on('circle-message', async (content:SocketMessage)=> {
        log.event('Circle Chat: ', content);
        const roomId:string = content.recipientId.toString();

        //Note: Not authenticating Message
        if(!socket.rooms.has(roomId))
            socket.join(roomId);

        chatIO.to(roomId).emit('circle-message', await formatMessageNames(content, true));

        // TODO Send to Database
    });
    
    
  });