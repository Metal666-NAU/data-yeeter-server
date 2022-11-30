import https from "https";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

import { WS_PORT } from "./constants.js";

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
        let fileSize: number | undefined = data["message"]["fileSize"];

        if (!uuid || !otherUuid || !fileName || !fileSize) {
          ws.send(JSON.stringify({ error: WSErrors.missingUuid }));

          console.warn(
            `${uuid} tried to create fileshare with ${otherUuid} but one of uuids is missing`
          );

          break;
        }

        fileShares.push(new FileShare(uuid, otherUuid, fileName, fileSize, ws));

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
            type: "fileInfo",
            message: { name: fileShare.fileName, size: fileShare.fileSize },
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

server.listen(WS_PORT);

class FileShare {
  readonly senderUuid: String;
  readonly receiverUuid: String;
  readonly fileName: String;
  readonly fileSize: number;
  readonly senderConnection: WebSocket.WebSocket;
  receiverConnection: WebSocket.WebSocket | undefined;

  constructor(
    senderUuid: String,
    receiverUuid: String,
    fileName: String,
    fileSize: number,
    senderConnection: WebSocket.WebSocket
  ) {
    this.senderUuid = senderUuid;
    this.receiverUuid = receiverUuid;
    this.fileName = fileName;
    this.fileSize = fileSize;
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
