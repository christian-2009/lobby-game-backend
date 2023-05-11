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
import leaveRoom from "./services/leaveRoom";
import harperCheckRoomExists from "./services/harperCheckRoomExists";
import harperHandleTable from "./services/harperHandleTable";

dotenv.config();

const app: Express = express();
app.use(cors());
const port = process.env.PORT || 8000;
const server = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  // allowEIO3: true,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const CHAT_BOT = "ChatBot";

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Servers!");
});

let chatRoom = "";
let allUsers: allUsersType[] = [];

io.on("connection", (socket) => {
  console.log(`[cs] User connected ${socket.id}`);

  socket.on("connect_error", (err) => {
    throw err;
  });
  socket.on("join_room", async (data) => {
    const { username, room, password } = data;

    try {
      await harperHandleTable({ room, password });
    } catch (e: any) {
      io.in(socket.id).emit("error", e.message);
      throw e;
    }

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
      username: CHAT_BOT,
      currentTime,
    });

    socket.to(room).emit("receive_message", {
      message: `${username} has joined the room`,
      username: CHAT_BOT,
      currentTime,
    });
  });
  socket.on("send_message", (data: ClientToServerDataInterface) => {
    const { message, username, room, __createdtime__ } = data;
    io.in(room).emit("receive_message", data);
    harperSaveMessage({ message, username, room, __createdtime__ })
      ?.then((response) => console.log(`[cs] response`, response))
      .catch((error) => console.log(`[cs] error`, error));
  });

  socket.on("leave_room", (data) => {
    const { username, room } = data;
    socket.leave(room);
    const __createdtime__ = Date.now();
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit("receive_message", {
      message: `${username} has left the room`,
      username: CHAT_BOT,
      __createdtime__,
    });
  });
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
