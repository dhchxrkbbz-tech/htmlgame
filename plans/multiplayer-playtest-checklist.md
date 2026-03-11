# HTMLGame Multiplayer Playtest Checklist

## Setup

1. Start the local backend with `npm start` or `npm run dev`.
2. Open two clients using browser + browser, or browser + launcher.
3. Use two separate accounts or one account plus one guest.

## Instance Presence

1. Confirm both players enter the same map and can see each other spawn.
2. Verify the remote player nameplate appears above the second client.
3. Move both players and confirm interpolation stays smooth without snap jitter.

## Party Flow

1. Open the party panel with `P` on client A.
2. Sync a shared party id and add client B by username.
3. Confirm both HUDs show the same party id, roster, shared XP, and shared loot list.
4. Award shared XP and verify both clients receive the update.

## Guild Flow

1. Open the guild panel with `G` on client A.
2. Create a guild, then join it from client B.
3. Refresh guild state on both clients and confirm the member list matches.
4. Send chat messages from both clients and confirm they appear in-order on both HUDs.

## Combat And Loot

1. Fight at least one slime with both clients in the same instance.
2. Confirm combat summaries appear on both clients.
3. Pick up a loot drop on client A and verify the shared loot log updates on client B.
4. Repeat with client B to confirm reverse sync.

## Marketplace Sanity

1. List one item from client A in the trader panel.
2. Refresh client B and verify the listing is visible.
3. Buy or reserve/finalize from client B and confirm inventory updates on both sides as expected.

## Exit Criteria

1. No blocking console error during login, movement, party, guild, or loot actions.
2. No stale remote player remains after disconnecting one client.
3. Party, guild, loot, and market state can be refreshed manually if a client joins late.