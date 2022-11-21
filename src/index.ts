import express, { Express } from "express";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import memorystore from "memorystore";
import session, { SessionData, SessionOptions } from "express-session";

import { PORT } from "./constants.js";
import { UserManager } from "./user_manager.js";

const app: Express = express();
const secretManagerServiceClient = new SecretManagerServiceClient();
const MemoryStore = memorystore(session);
const userManager = new UserManager();

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
      userManager.removeUser((value as SessionData).user);
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

app.post("/goOnline", (req, res) => {
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

app.post("/goOffline", (req, res) => {
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
});

app.post("/addFriend", (req, res) => {
  let user = userManager.findUser(req.body.discoveryCode);

  if (user === undefined) {
    res.sendStatus(400);

    return;
  }

  res.json(user);
});

app.listen(PORT, () => {
  console.log("We are rollin'");
});
