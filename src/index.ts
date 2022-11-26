import express, { Express } from "express";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import memorystore from "memorystore";
import session, { SessionData, SessionOptions } from "express-session";

import { PORT } from "./constants.js";
import { FileShare, FileShareManager } from "./fileshare_manager.js";

const app: Express = express();
const secretManagerServiceClient = new SecretManagerServiceClient();
const MemoryStore = memorystore(session);
const fileShareManager = new FileShareManager();

const cookieSecret = new TextDecoder().decode(
  (
    await secretManagerServiceClient.accessSecretVersion({
      name: "projects/761304302994/secrets/cookie/versions/latest",
    })
  )[0].payload?.data as Uint8Array
);

if (cookieSecret === null || typeof cookieSecret !== "string") {
  console.error("Failed to retrieve cookie secret. Stopping server...");

  process.exit();
}

let sess: SessionOptions = {
  secret: cookieSecret,
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({
    checkPeriod: 1000 * 60 * 60 * 24,
    //checkPeriod: 1000,
    noDisposeOnSet: true,
    //ttl: 1000 * 10,
    dispose: (key, value) => {
      fileShareManager.dropFileShare((value as SessionData).user.uuid);
    },
  }),
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1);

  sess.cookie = { secure: true };
}

app.use(session(sess));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post("/startFileShare", (req, res) => {
  console.log(
    `Starting fileshare from ${req.body.uuid} to ${req.body.targetUuid}...`
  );

  req.session.user = new User(req.body.uuid);

  fileShareManager.createNewFileShare(
    req.session.user.uuid,
    req.body.targetUuid,
    req.body.offer
  );

  res.sendStatus(200);
});

app.get("/connectToFileShare", (req, res) => {
  let uuid = req.query.uuid as string | undefined;
  let sourceUuid = req.query.sourceUuid as string | undefined;

  console.log(`${uuid} tries to accept fileshare from ${sourceUuid}...`);

  if (!uuid || !sourceUuid) {
    res.sendStatus(400);

    return;
  }

  req.session.user = new User(uuid);

  let fileShare: FileShare | undefined = fileShareManager.findFileShare(
    sourceUuid,
    req.session.user.uuid
  );

  if (!fileShare) {
    res.sendStatus(400);

    return;
  }

  res.send({
    offer: fileShare.offer,
  });
});

app.post("/receiveFile", (req, res) => {
  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  let fileShare: FileShare | undefined = fileShareManager.findFileShare(
    null,
    req.session.user.uuid
  );

  if (!fileShare) {
    res.sendStatus(400);

    return;
  }

  console.log(
    `${req.session.user?.uuid} wants to receive a file from ${fileShare.sourceUuid}...`
  );

  fileShareManager.acceptFileShare(
    fileShare.sourceUuid,
    req.session.user!.uuid,
    req.body.answer
  );

  res.sendStatus(200);
});

app.get("/sendFile", (req, res) => {
  if (!req.session.user) {
    res.sendStatus(400);

    return;
  }

  let fileShare: FileShare | undefined = fileShareManager.findFileShare(
    req.session.user.uuid,
    null
  );

  if (!fileShare) {
    res.sendStatus(400);

    return;
  }

  console.log(
    `${req.session.user?.uuid} sends file to ${fileShare.targetUuid}...`
  );

  res.send({
    answer: fileShare.answer,
  });
});

app.listen(PORT, () => {
  console.log("We are rollin'");
});

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

class User {
  readonly uuid: String;

  constructor(uuid: String) {
    this.uuid = uuid;
  }
}
