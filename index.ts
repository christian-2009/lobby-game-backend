import express, { Express, Request, response, Response } from "express";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import {
  allUsersType,
  ClientToServerDataInterface,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";
import harperSaveMessage from "./services/harperSaveMessage";
import harperGetMessages from "./services/harperGetMessages";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8000;
const server = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

//cors middleware
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Servers!");
});

let chatRoom = "";
const allUsers: allUsersType[] = [];

io.on("connection", (socket) => {
  console.log(`[cs] User connected ${socket.id}`);
  socket.on("join_room", (data) => {
    const { username, room } = data;
    console.log(`[cs] username, room`, username, room);
    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    const chatRoomUsers = allUsers.filter((user) => user.room === room);

    socket.to(room).emit("chatroom_users", chatRoomUsers);
    socket.emit("chatroom_users", chatRoomUsers);

    harperGetMessages(room)
      ?.then((last100messages) => {
        socket.emit("last_100_messages", last100messages);
      })
      .catch((err) => console.log(`[cs] err`, err));

    socket.join(room);

    const currentTime = Date.now();

    socket.emit("receive_message", {
      message: `Welcome ${username}`,
      username: "Chat",
      currentTime,
    });

    socket.to(room).emit("receive_message", {
      message: `${username} has joined the room`,
      username: "Chat",
      currentTime,
    });
  });
  socket.on("send_message", (data: ClientToServerDataInterface) => {
    const { message, username, room, createdTime } = data;
    io.in(room).emit("receive_message", data);
    console.log(`[cs] createdTime`, createdTime);
    harperSaveMessage({ message, username, room, createdTime })
      ?.then((response) => console.log(`[cs] response`, response))
      .catch((error) => console.log(`[cs] error`, error));
  });
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
