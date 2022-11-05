import express, { Express } from "express";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import memorystore from 'memorystore';
import session from "express-session";

import { PORT } from "./constants.js";

const app: Express = express();
const secretManagerServiceClient = new SecretManagerServiceClient();
const MemoryStore = memorystore(session);

const cookieSecret = new TextDecoder().decode((await secretManagerServiceClient.accessSecretVersion({
  name: "projects/761304302994/secrets/cookie/versions/latest",
}))[0].payload?.data as Uint8Array);

if (cookieSecret === null || typeof cookieSecret !== 'string') {
  console.error("Failed to retrieve cookie secret. Stopping server...");

  process.exit();
}

app.use(
  session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true
    },
    store: new MemoryStore({
      checkPeriod: 1000 * 60 * 60 * 24
    }),
  })
);

app.get("/offerFile", (req, res) => {
  res.send("hello world");
});

app.get("/requestFile", (req, res) => {
  res.send("hello world");
});

app.listen(PORT, () => {
  console.log("We are rollin'");
});
