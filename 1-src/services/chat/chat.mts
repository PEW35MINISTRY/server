import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events.js";
import * as log from "../log.mjs";
import { SocketMessage } from "./chat-types.mjs";
import { formatMessageNames, fetchNames } from "./chat-utilities.mjs";

const contactMap = new Map<number, string>(); //userId:socketId (Currently Online)

const getSocketId = (userId: number):string => contactMap.get(userId);

const getUserId = (socketId: string):number => {
    const match:[number, string] = [...contactMap].find(([key, val]) => val === socketId); console.log('match', match);
    if(match && match.length) 
        return match[0];
    else
        return 0;
}
export default (chatIO: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => chatIO.on("connection", async (socket:Socket) => { //https://socket.io/docs/v3/emit-cheatsheet/
    console.log('\nDirect Chat: New Connection:', socket.handshake.auth.userId, socket.id);
    
    contactMap.set(socket.handshake.auth.userId, socket.id);
    console.log('Direct Contacts Online: ', contactMap);

    //Send All Available Contacts Online //TODO: Filter contacts from database table
    // chatIO.emit('contactMap', JSON.stringify(await fetchNames(Array.from(contactMap.keys()))));

    //All Circles Apart //TODO: Filter fro DB
    // chatIO.emit('circleMap', JSON.stringify(await fetchCircleMessageNames([100,200,300])));
    
    //Announce Online
    socket.emit('server', 'Welcome to Direct Chat!'); 
    chatIO.emit('server', `User: ${socket.handshake.auth.userId} has joined Direct Chat!`); 

//Socket Listeners
    socket.on('log', (text:string)=>{
        log.event('Direct Chat Event:', socket.id, getUserId(socket.id), text);
    });

    socket.on('leave', (userId:number)=>{
        console.log('Direct Chat: Leaving:', userId, socket.id);
        chatIO.emit('server', `User ${userId} has left the chat`)
        contactMap.delete(userId);
        console.log('Direct Contacts Online: ', contactMap);
    });

    socket.on('disconnect', ()=>{
        console.log('Direct Chat: Disconnecting:', socket.id);
    });

    socket.on('direct-message', async (content:SocketMessage)=> {
        console.log('Direct Chat: ', content);

        //Note: Not authenticating Message

        if(contactMap.has(content.recipientId)) {
            const details = await formatMessageNames(content);
            chatIO.to(contactMap.get(details.recipientId)).emit('direct-message', details);
            socket.emit('direct-message', details);
            log.event(`Direct Message: [${details.time}] ${details.senderId}|${details.senderName} to ${details.recipientId}|${details.recipientName}:`, content.message);
        } else 
            socket.emit('server', 'Failed to send message: \"'+content.message+'/"');
        // TODO Send to Database
    });


    socket.on('circle-message', async (content:SocketMessage)=> {
        console.log('Circle Chat: ', content);

        //Note: Not authenticating Message
        socket.join(content.recipientId.toString());
        socket.emit('circle-message', `Current Members: ${(await fetchNames(Array.from(await chatIO.in(content.recipientId.toString()).fetchSockets()).map(s => getUserId(s.id)))).join('\n')}`);

        chatIO.in(content.recipientId.toString()).emit('circle-message', await formatMessageNames(content, true));

        // TODO Send to Database
    });
    
    
  });