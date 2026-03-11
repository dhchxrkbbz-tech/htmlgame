import { beforeEach, describe, expect, it } from "vitest";
import { acknowledgeSnapshot, getInstanceAcknowledgementsById, getInstanceStateById, joinInstance, leaveInstance, updatePlayerState } from "../server/state/worldState.js";

describe("worldState snapshot sequencing", () => {
  beforeEach(() => {
    leaveInstance("socket-a");
    leaveInstance("socket-b");
  });

  it("increments snapshot sequence on join and movement updates", () => {
    const instance = joinInstance({
      socketId: "socket-a",
      partyId: "alpha-party",
      mapKey: "map:tutorial",
      player: { username: "alpha", x: 10, y: 10 },
    });

    expect(instance.snapshotSequence).toBe(1);

    const movement = updatePlayerState("socket-a", { x: 42, y: 18, velocityX: 10, velocityY: 2 });
    expect(movement.snapshotSequence).toBe(2);

    const state = getInstanceStateById("map:tutorial:alpha-party");
    expect(state.snapshotSequence).toBe(2);
    expect(state.players[0].serverSequence).toBe(2);
  });

  it("tracks monotonic client acknowledgements", () => {
    joinInstance({
      socketId: "socket-b",
      partyId: "beta-party",
      mapKey: "map:tutorial",
      player: { username: "beta", x: 10, y: 10 },
    });

    acknowledgeSnapshot("socket-b", 3);
    acknowledgeSnapshot("socket-b", 2);

    const acknowledgements = getInstanceAcknowledgementsById("map:tutorial:beta-party");
    expect(acknowledgements).toHaveLength(1);
    expect(acknowledgements[0].sequence).toBe(3);
  });
});