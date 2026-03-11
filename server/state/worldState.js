const instances = new Map();
const playerSockets = new Map();

function touchInstance(instance) {
  instance.snapshotSequence += 1;
  instance.lastUpdatedAt = Date.now();
  return instance.snapshotSequence;
}

function serializeInstance(instance) {
  return instance
    ? {
        instanceId: instance.instanceId,
        players: [...instance.players.values()],
        loot: instance.loot,
        enemies: instance.enemies,
        snapshotSequence: instance.snapshotSequence,
        lastUpdatedAt: instance.lastUpdatedAt,
      }
    : null;
}

function getOrCreateInstance(instanceId) {
  if (!instances.has(instanceId)) {
    instances.set(instanceId, {
      instanceId,
      players: new Map(),
      loot: [],
      enemies: [],
      snapshotSequence: 0,
      lastUpdatedAt: Date.now(),
      clientAcks: new Map(),
    });
  }

  return instances.get(instanceId);
}

export function joinInstance({ socketId, player, partyId, mapKey }) {
  const previousInstanceId = playerSockets.get(socketId);
  if (previousInstanceId) {
    const previousInstance = instances.get(previousInstanceId);
    previousInstance?.players.delete(socketId);
  }

  const instanceId = `${mapKey}:${partyId}`;
  const instance = getOrCreateInstance(instanceId);
  const nextSequence = touchInstance(instance);
  instance.players.set(socketId, {
    socketId,
    ...player,
    serverSequence: nextSequence,
    serverUpdatedAt: instance.lastUpdatedAt,
  });
  playerSockets.set(socketId, instanceId);
  return instance;
}

export function updatePlayerState(socketId, patch) {
  const instanceId = playerSockets.get(socketId);
  if (!instanceId) {
    return null;
  }

  const instance = instances.get(instanceId);
  const player = instance?.players.get(socketId);
  if (!player) {
    return null;
  }

  const nextSequence = touchInstance(instance);
  Object.assign(player, patch);
  player.serverSequence = nextSequence;
  player.serverUpdatedAt = instance.lastUpdatedAt;

  return {
    player,
    instanceId,
    snapshotSequence: nextSequence,
    lastUpdatedAt: instance.lastUpdatedAt,
  };
}

export function leaveInstance(socketId) {
  const instanceId = playerSockets.get(socketId);
  if (!instanceId) {
    return null;
  }

  const instance = instances.get(instanceId);
  if (instance?.players.delete(socketId)) {
    instance.clientAcks.delete(socketId);
    touchInstance(instance);
  }
  playerSockets.delete(socketId);
  return instance;
}

export function acknowledgeSnapshot(socketId, sequence) {
  const instanceId = playerSockets.get(socketId);
  if (!instanceId || !Number.isFinite(Number(sequence))) {
    return null;
  }

  const instance = instances.get(instanceId);
  if (!instance) {
    return null;
  }

  const nextSequence = Number(sequence);
  const previous = instance.clientAcks.get(socketId);
  if (previous && previous.sequence >= nextSequence) {
    return previous;
  }

  const ack = {
    sequence: nextSequence,
    ackedAt: Date.now(),
  };
  instance.clientAcks.set(socketId, ack);
  return ack;
}

export function getInstanceAcknowledgementsById(instanceId) {
  const instance = instances.get(instanceId);
  if (!instance) {
    return [];
  }

  return [...instance.clientAcks.entries()].map(([socketId, ack]) => ({
    socketId,
    sequence: ack.sequence,
    ackedAt: ack.ackedAt,
  }));
}

export function getInstanceState(socketId) {
  const instanceId = playerSockets.get(socketId);
  if (!instanceId) {
    return null;
  }

  const instance = instances.get(instanceId);
  return serializeInstance(instance);
}

export function getInstanceStateById(instanceId) {
  return serializeInstance(instances.get(instanceId));
}

export function getInstanceIdForSocket(socketId) {
  return playerSockets.get(socketId) ?? null;
}