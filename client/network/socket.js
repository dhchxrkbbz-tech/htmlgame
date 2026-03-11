import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function createSocketManager() {
  let socket;
  let token = null;

  function buildHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  return {
    get baseUrl() {
      return API_URL;
    },
    get socket() {
      return socket;
    },
    async request(path, payload, options = {}) {
      const method = options.method ?? "POST";
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: buildHeaders(),
        body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      return data;
    },
    async login(payload) {
      return this.request("/api/auth/login", payload);
    },
    async register(payload) {
      return this.request("/api/auth/register", payload);
    },
    async getParty(partyId) {
      return this.request(`/api/parties/${partyId}`, null, { method: "GET" });
    },
    async syncParty(payload) {
      return this.request("/api/parties/sync", payload);
    },
    async inviteParty(payload) {
      return this.request("/api/parties/invite", payload);
    },
    async acceptPartyInvite(payload) {
      return this.request("/api/parties/accept", payload);
    },
    async getGuild(guildId) {
      return this.request(`/api/guilds/${guildId}`, null, { method: "GET" });
    },
    async listGuilds() {
      return this.request("/api/guilds", null, { method: "GET" });
    },
    async createGuild(payload) {
      return this.request("/api/guilds", payload);
    },
    async joinGuild(payload) {
      return this.request("/api/guilds/join", payload);
    },
    async listMarketListings() {
      return this.request("/api/marketplace/listings", null, { method: "GET" });
    },
    async createMarketListing(payload) {
      return this.request("/api/marketplace/listings", payload);
    },
    async reserveMarketListing(payload) {
      return this.request("/api/marketplace/reserve", payload);
    },
    async buyMarketListing(payload) {
      return this.request("/api/marketplace/buy", payload);
    },
    async releaseMarketListing(payload) {
      return this.request("/api/marketplace/release", payload);
    },
    async cancelMarketListing(payload) {
      return this.request("/api/marketplace/cancel", payload);
    },
    setToken(nextToken) {
      token = nextToken;
      if (socket) {
        socket.auth = { token };
      }
    },
    connect() {
      if (!socket) {
        socket = io(API_URL, {
          autoConnect: false,
          transports: ["websocket"],
          auth: { token },
        });
      }

      socket.auth = { token };

      if (!socket.connected) {
        socket.connect();
      }

      return socket;
    },
    disconnect() {
      socket?.disconnect();
    },
    on(eventName, handler) {
      this.connect().on(eventName, handler);
    },
    off(eventName, handler) {
      socket?.off(eventName, handler);
    },
    emitMovement(payload) {
      socket?.emit("player:movement", payload);
    },
    emitCombat(payload) {
      socket?.emit("combat:use-skill", payload);
    },
    emitLoot(payload) {
      socket?.emit("loot:pickup", payload);
    },
    emitSkill(payload) {
      socket?.emit("skill:cast", payload);
    },
    emitParty(payload) {
      socket?.emit("party:update", payload);
    },
    emitPartyInviteNotice(payload) {
      socket?.emit("party:invite:notify", payload);
    },
    emitPartyAcceptNotice(payload) {
      socket?.emit("party:accept:notify", payload);
    },
    emitGuildSync(guildId) {
      socket?.emit("guild:sync", { guildId });
    },
    emitGuildChat(payload) {
      socket?.emit("guild:chat", payload);
    },
    emitMarketRefresh() {
      socket?.emit("market:refresh");
    },
    requestInstanceState(knownSequence = null) {
      socket?.emit("instance:state", { knownSequence });
    },
    emitSnapshotAck(sequence) {
      socket?.emit("instance:snapshot-ack", { sequence });
    },
    requestPartyState(partyId) {
      socket?.emit("party:state", { partyId });
    },
    requestGuildState(guildId) {
      socket?.emit("guild:state", { guildId });
    },
    joinInstance(payload) {
      socket?.emit("instance:join", payload);
    },
  };
}