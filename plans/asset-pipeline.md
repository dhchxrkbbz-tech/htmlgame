# Asset Pipeline Notes

## Generator

- Source script: `tools/generate_assets.py`
- Output root: `client/assets/generated/`
- Run command: `python tools/generate_assets.py`

## Generated Sets

- Class sprite families: `warrior`, `mage`, `ranger`, `cleric`
- Enemy sprite families: `slime`, `mossling`
- Environment tiles: `grass`, `path`, `platform`
- Environment props: `tree`, `crystal`, `brazier`, `mushroom-ring`, `obelisk`
- UI frames: `window`, `slot`, `button`, `feed`
- UI icons: `inventory`, `guild`, `trader`, `party`, `combat`

## Runtime Checks

- `client/assets/assetManifest.js` is the preload source of truth.
- `client/assets/assetAudit.js` verifies that required generated keys are still present in the manifest.
- Boot also checks that every manifest entry actually produced a loaded cache/texture entry after preload.

## Phase 4 Goal

- Generated assets should be sufficient for the demo even without external art/audio packs.
- If dedicated audio files are missing, the client falls back to lightweight synthesized cues for UI, hit, loot, and ambient feedback.