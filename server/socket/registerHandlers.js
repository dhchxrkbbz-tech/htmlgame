import { addGuildMessage, getGuildState } from "../services/guildService.js";
import { listMarketListings } from "../services/marketplaceService.js";
import { addSharedLoot, awardSharedXp, getPartyState, syncPartyState } from "../services/partyService.js";
import { acknowledgeSnapshot, getInstanceIdForSocket, getInstanceState, getInstanceStateById, joinInstance, leaveInstance, updatePlayerState } from "../state/worldState.js";
import { verifyToken } from "../services/authService.js";

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    function emitSocketError(error) {
      socket.emit("socket:error", { error: error.message });
    }

    socket.on("instance:join", (payload) => {
      try {
        if (payload.token) {
          verifyToken(payload.token);
        }

        for (const roomId of socket.rooms) {
          if (roomId !== socket.id) {
            socket.leave(roomId);
          }
        }

        const instance = joinInstance({
          socketId: socket.id,
          player: payload.player,
          partyId: payload.partyId,
          mapKey: payload.mapKey,
        });

        socket.join(instance.instanceId);
        socket.join(`party:${payload.partyId}`);
        if (payload.player?.username) {
          socket.join(`user:${payload.player.username}`);
        }
        if (payload.player?.guildId) {
          socket.join(`guild:${payload.player.guildId}`);
        }

        io.to(instance.instanceId).emit("world:state", getInstanceStateById(instance.instanceId));
      } catch (error) {
        socket.emit("socket:error", { error: error.message });
      }
    });

    socket.on("player:movement", (payload) => {
      const movement = updatePlayerState(socket.id, payload);
      if (!movement?.instanceId) {
        return;
      }

      socket.to(movement.instanceId).emit("player:moved", {
        socketId: socket.id,
        snapshotSequence: movement.snapshotSequence,
        serverTime: movement.lastUpdatedAt,
        ...payload,
      });
    });

    socket.on("instance:snapshot-ack", ({ sequence }) => {
      acknowledgeSnapshot(socket.id, sequence);
    });

    socket.on("combat:use-skill", ({ skillId, impacted = [] }) => {
      const instanceId = getInstanceIdForSocket(socket.id);
      const resolution = {
        summary: `${skillId} resolved on ${impacted.length} target(s).`,
      };

      socket.emit("combat:resolved", resolution);
      if (instanceId) {
        socket.to(instanceId).emit("combat:resolved", resolution);
      }
    });

    socket.on("loot:pickup", async (payload) => {
      try {
        const instanceId = getInstanceIdForSocket(socket.id);
        if (payload.partyId) {
          const partyState = await addSharedLoot(payload.partyId, payload.item);
          io.to(`party:${payload.partyId}`).emit("party:state", partyState);
        }

        if (instanceId) {
          io.to(instanceId).emit("loot:updated", payload);
        }
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("skill:cast", (payload) => {
      const instanceId = getInstanceIdForSocket(socket.id);
      if (instanceId) {
        socket.to(instanceId).emit("skill:casted", payload);
      }
    });

    socket.on("party:update", async (payload) => {
      try {
        const partyState = await syncPartyState(payload);
        socket.join(`party:${partyState.partyId}`);
        io.to(`party:${partyState.partyId}`).emit("party:state", partyState);

        if (payload.sharedXpDelta) {
          const synced = await awardSharedXp(partyState.partyId, payload.sharedXpDelta);
          io.to(`party:${partyState.partyId}`).emit("party:state", synced);
        }
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("party:invite:notify", async ({ partyId, invitedBy, username }) => {
      try {
        const partyState = await getPartyState(partyId);
        if (!partyState) {
          return;
        }

        io.to(`user:${username}`).emit("party:invite-received", {
          partyId,
          invitedBy,
          invitee: username,
          partyState,
        });
        io.to(`party:${partyId}`).emit("party:state", partyState);
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("party:accept:notify", async ({ partyId, username }) => {
      try {
        const partyState = await getPartyState(partyId);
        if (!partyState) {
          return;
        }

        socket.join(`party:${partyId}`);
        io.to(`party:${partyId}`).emit("party:state", partyState);
        io.to(`user:${username}`).emit("party:invite-accepted", { partyState });
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("guild:chat", async (payload) => {
      try {
        const message = await addGuildMessage(payload);
        socket.join(`guild:${payload.guildId}`);
        io.to(`guild:${payload.guildId}`).emit("guild:message", {
          guildId: payload.guildId,
          ...message,
        });
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("guild:sync", async ({ guildId }) => {
      try {
        const guildState = await getGuildState(guildId);
        if (guildState) {
          socket.join(`guild:${guildId}`);
          io.to(`guild:${guildId}`).emit("guild:state", guildState);
        }
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("market:refresh", async () => {
      try {
        const listings = await listMarketListings();
        io.emit("market:updated", { listings });
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("disconnect", () => {
      const instance = leaveInstance(socket.id);
      if (instance) {
        io.to(instance.instanceId).emit("world:state", getInstanceStateById(instance.instanceId));
      }
    });

    socket.on("instance:state", ({ knownSequence } = {}) => {
      const state = getInstanceState(socket.id);
      if (!state) {
        return;
      }

      if (Number.isFinite(Number(knownSequence)) && Number(knownSequence) >= (state.snapshotSequence ?? 0)) {
        return;
      }

      socket.emit("world:state", state);
    });

    socket.on("party:state", async ({ partyId }) => {
      try {
        const partyState = await getPartyState(partyId);
        if (partyState) {
          socket.join(`party:${partyId}`);
          socket.emit("party:state", partyState);
        }
      } catch (error) {
        emitSocketError(error);
      }
    });

    socket.on("guild:state", async ({ guildId }) => {
      try {
        const guildState = await getGuildState(guildId);
        if (guildState) {
          socket.join(`guild:${guildId}`);
          socket.emit("guild:state", guildState);
        }
      } catch (error) {
        emitSocketError(error);
      }
    });
  });
}