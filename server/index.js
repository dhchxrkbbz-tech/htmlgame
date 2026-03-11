import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { connectDatabase, isDatabaseConnected } from "./config/database.js";
import { authRoutes } from "./routes/authRoutes.js";
import { guildRoutes } from "./routes/guildRoutes.js";
import { marketplaceRoutes } from "./routes/marketplaceRoutes.js";
import { partyRoutes } from "./routes/partyRoutes.js";
import { registerSocketHandlers } from "./socket/registerHandlers.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientOrigin,
    credentials: true,
  },
});

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/parties", partyRoutes);
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: {
      connected: isDatabaseConnected(),
      mode: isDatabaseConnected() ? "mongodb" : "in-memory",
    },
  });
});

registerSocketHandlers(io);

connectDatabase()
  .catch((error) => {
    console.warn(`Database connection skipped: ${error.message}`);
  })
  .finally(() => {
    server.listen(env.port, () => {
      console.log(`Server listening on http://localhost:${env.port}`);
    });
  });