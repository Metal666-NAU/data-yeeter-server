//import express, { Express } from "express";
//import expressWs from "express-ws";
//import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
//import memorystore from "memorystore";
//import session, { SessionData, SessionOptions } from "express-session";
import https from "https";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

import { WS_PORT } from "./constants.js";
//import { UserManager } from "./user_manager.js";

//const app = expressWs(express());
//const secretManagerServiceClient = new SecretManagerServiceClient();
//const MemoryStore = memorystore(session);
//const userManager = new UserManager();

const server = https.createServer({
  key: fs.readFileSync("ssl/cert.key"),
  cert: fs.readFileSync("ssl/cert.pem"),
});
let fileShares: FileShare[] = [];

const wss = new WebSocketServer({
  server: server,
});

wss.on("listening", () => {
  console.log("Websocket server started!");
});
wss.on("connection", (ws) => {
  console.log("New client connected!");

  ws.on("message", (message) => {
    let data = JSON.parse(message.toString());

    switch (data["type"]) {
      case "sendFile": {
        let uuid: String | undefined = data["message"]["uuid"];
        let otherUuid: String | undefined = data["message"]["otherUuid"];
        let fileName: String | undefined = data["message"]["fileName"];

        if (!uuid || !otherUuid || !fileName) {
          ws.send(JSON.stringify({ error: WSErrors.missingUuid }));

          console.warn(
            `${uuid} tried to create fileshare with ${otherUuid} but one of uuids is missing`
          );

          break;
        }

        fileShares.push(new FileShare(uuid, otherUuid, fileName, ws));

        console.log(`Created new fileshare ${uuid} -> ${otherUuid}`);

        break;
      }
      case "connectToFileShare": {
        let uuid: String | undefined = data["message"]["uuid"];
        let otherUuid: String | undefined = data["message"]["otherUuid"];

        if (!uuid || !otherUuid) {
          ws.send(JSON.stringify({ error: WSErrors.missingUuid }));

          console.warn(
            `${uuid} tried to accept fileshare from ${otherUuid} but one of uuids is missing`
          );

          break;
        }

        let fileShare = findFileShareByUuid(otherUuid, uuid);

        if (!fileShare) {
          ws.send(JSON.stringify({ error: WSErrors.invalidUuid }));

          console.warn(
            `${uuid} tried to accept fileshare from ${otherUuid} but it doesn't exist`
          );

          break;
        }

        fileShare.receiverConnection = ws;

        console.log(`${uuid} accepted fileshare from ${otherUuid}`);

        ws.send(
          JSON.stringify({
            type: "fileName",
            message: fileShare.fileName,
          })
        );

        break;
      }
      case "receiveFile": {
        let fileShare = findFileShareByWs(ws);

        if (!fileShare) {
          console.log("User tried to receive file from non-existent fileshare");

          break;
        }

        fileShare?.getOtherConnection(ws)?.send(
          JSON.stringify({
            type: "startSignalling",
          })
        );

        console.log(
          `${fileShare.receiverUuid} requested file from ${fileShare.senderUuid}`
        );

        break;
      }
      case "offer":
      case "answer":
      case "candidate": {
        console.log(
          `Forwarding message to other connection: ${message.toString()}`
        );

        findFileShareByWs(ws)?.getOtherConnection(ws)?.send(message.toString());

        break;
      }
    }
  });
  ws.on("close", () => {
    let closedFileShare = findFileShareByWs(ws);

    if (!closedFileShare) {
      console.warn("Closed websocket connection without fileshare");

      return;
    }

    console.log(
      `Closed fileshare ${closedFileShare.senderUuid} -> ${closedFileShare.receiverUuid}`
    );

    fileShares = fileShares.filter((fileShare) => fileShare != closedFileShare);
  });

  ws.send(JSON.stringify({ type: "init" }));
});

/*if (typeof process.env.COOKIE_SECRET !== "string") {
  console.error("Failed to retrieve cookie secret. Stopping server...");

  process.exit();
}*/

/*let sess: SessionOptions = {
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({
    checkPeriod: 1000 * 60 * 60 * 24,
    //checkPeriod: 1000,
    noDisposeOnSet: true,
    //ttl: 1000 * 10,
    dispose: (key, value) => {
      userManager.removeUser((value as SessionData).user);
    },
  }),
};*/

/*if (app.get("env") === "production") {
  app.set("trust proxy", 1);

  sess.cookie = { secure: true };
}*/

//app.use(session(sess));

/*app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.ws('/ws', (ws, req) => {
  ws.on('sendFile', (msg) => {
    let uuid: String | undefined = msg['uuid'];
    let otherUuid: String | undefined = msg['otherUuid'];

    if(!uuid || !otherUuid) {
      ws.send('error');

      return;
    }

    fileShares.push(new FileShare(uuid, otherUuid, ws));
  });
  ws.on('receiveFile', (msg) => {
    let uuid: String | undefined = msg['uuid'];
    let otherUuid: String | undefined = msg['otherUuid'];
    
    if(!uuid || !otherUuid) {
      ws.send('error');

      return;
    }

    let fileShare = findFileShareByUuid(otherUuid, uuid);

    if(!fileShare) {
      ws.send('error');

      return;
    }

    fileShare.receiverConnection = ws;

    ws.send('go');
  });
  ws.on('signalling', (msg) => {
    findFileShareByWs(ws)?.getOtherConnection(ws)?.send(msg);
  });
});*/

const findFileShareByUuid = (senderUuid: String, receiverUuid: String) =>
  fileShares.find(
    (fileShare) =>
      fileShare.senderUuid === senderUuid &&
      fileShare.receiverUuid === receiverUuid
  );
const findFileShareByWs = (connection: WebSocket.WebSocket) =>
  fileShares.find(
    (fileShare) =>
      fileShare.receiverConnection === connection ||
      fileShare.senderConnection === connection
  );

/*app.post("user/goOnline", (req, res) => {
  console.log(`User with uuid ${req.body.uuid} is going online...`);

  req.session.user = userManager.addUser(req.body.uuid);

  if (!req.session.user) {
    console.warn(`Failed to log user with uuid ${req.body.uuid} in!`);

    res.sendStatus(400);

    return;
  }

  console.log(`A user went online: ${JSON.stringify(req.session.user)}`);

  res.json(req.session.user);
});

app.post("user/enableDiscovery", (req, res) => {
  console.log(`User with uuid ${req.body.uuid} is enabling discovery...`);

  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  req.session.user.visible = true;

  res.sendStatus(200);
});

app.post("user/disableDiscovery", (req, res) => {
  console.log(`User with uuid ${req.body.uuid} is disabling discovery...`);

  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  req.session.user.visible = false;

  res.sendStatus(200);
});

app.post("user/startAddingFriend", (req, res) => {
  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  let friendship = userManager.addFriendship(
    req.session.user,
    req.body.discoveryCode
  );

  if (!friendship) {
    res.sendStatus(400);

    return;
  }

  res.sendStatus(200);
});

app.post("user/finishAddingFriend", (req, res) => {
  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  let friendship = userManager.findFriendship(req.session.user);

  if (!friendship) {
    res.sendStatus(400);

    return;
  }

  res.sendStatus(200);
});

app.post("user/goOffline", (req, res) => {
  let user = req.session.user;

  console.log(`Logging user out: ${JSON.stringify(user)}`);

  req.session.destroy(() => {
    let wentOffline = !userManager.hasUser(user);

    res.sendStatus(wentOffline ? 200 : 400);

    if (wentOffline) {
      console.log(`A user went offline: ${JSON.stringify(user)}`);
    } else {
      console.error(`User ${JSON.stringify(user)} failed to go offline!`);
    }
  });
});*/

/*app.listen(PORT, () => {
  console.log("We are rollin'");
});*/

server.listen(WS_PORT);

class FileShare {
  readonly senderUuid: String;
  readonly receiverUuid: String;
  readonly fileName: String;
  readonly senderConnection: WebSocket.WebSocket;
  receiverConnection: WebSocket.WebSocket | undefined;

  constructor(
    senderUuid: String,
    receiverUuid: String,
    fileName: String,
    senderConnection: WebSocket.WebSocket
  ) {
    this.senderUuid = senderUuid;
    this.receiverUuid = receiverUuid;
    this.fileName = fileName;
    this.senderConnection = senderConnection;
  }

  getOtherConnection(
    connection: WebSocket.WebSocket
  ): WebSocket.WebSocket | undefined {
    if (this.senderConnection === connection) {
      return this.receiverConnection;
    } else if (this.receiverConnection === connection) {
      return this.senderConnection;
    } else {
      return;
    }
  }
}

enum WSErrors {
  missingUuid,
  invalidUuid,
}
