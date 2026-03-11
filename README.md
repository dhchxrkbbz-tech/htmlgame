# HTMLGame Prototype

Phaser 3 kliens + Node.js backend + Socket.IO + MongoDB-ready scaffold egy instanced action RPG prototípushoz.

## Tartalom

- `client/`: Phaser kliens, scene-ek, gameplay rendszerek, hálózati kliens
- `server/`: Express + Socket.IO backend, auth, marketplace, in-memory fallback, Mongoose modellek
- `tests/`: combat és inventory alap unit tesztek
- `launcher/`: minimál Electron launcher shell

## Fő funkciók a scaffoldban

- Boot -> Login -> Game scene váltás
- Login/register + validáció backend oldalon
- Socket.IO instance join, movement/combat/party/guild események váza
- JSON alapú map, enemy, loot és skill definíciók
- Manifest-alapú asset loader pipeline a Boot scene-ben
- Class rendszer: Warrior, Mage, Ranger, Cleric
- Alap enemy AI: patrol, chase, attack, flee
- Inventory, skill, combat, HUD és optimization helper váz
- Marketplace REST végpontok és in-memory/MongoDB kompatibilis service réteg
- DOM-alapú inventory + marketplace panel drag-drop listázással és buy flow-val
- Party és guild REST/service réteg, shared XP/shared loot, guild chat sync
- Remote player interpolált szinkron instance scope-on belül
- Electron launcher login/register/guest + update shell

## Billentyűk

- `1-4`: skillek
- `Bal klikk`: basic attack
- `I`: inventory panel
- `M`: market panel
- `P`: party panel
- `G`: guild panel

`I` és `M` ugyanazt a jobb oldali inventory/market DOM panelt vezérli.

## Phase 1 Demo Flow

- Login scene-ben már látszik a local server státusz, a guest fallback és a rövid vertical slice útvonal.
- A tutorial map most Adventurer Camp -> Crystal Path -> Slime Clearing landmark útvonallal indul.
- A combat első feedback köre bekerült: enemy health indicator, floating damage, hit flash, death feedback, cooldownos HUD feed.
- A class identity minimum már ténylegesen feldolgozott skill effectekkel jelenik meg: warrior stun/knockback, mage ranged/AOE, ranger hosszabb range és multishot, cleric heal/shield.

Ajánlott 3-5 perces bemutató:

1. Indítsd a local servert és a klienst.
2. Login, register vagy guest belépéssel lépj be a tutorial grove-ba.
3. Mozogj a campből a Crystal Pathon át a slime clearingig.
4. Használd a basic attackot és a `1-4` skilleket, majd figyeld a cooldown és combat feedback elemeket.
5. Nyisd meg az inventory, market, party és guild paneleket játék közben.
6. Multiplayer playtesthez indíts egy második klienst ugyanabba az instance-ba.

## Phase 2 Demo Loop

- A tutorial pályán látható pickup dropok vannak, és az eleső enemy garantált demo lootot dob.
- Az `E` gomb felveszi a közeli lootot, az item azonnal bekerül az inventoryba, és a shared loot feed is frissül.
- Az inventory panel most rarity, kategória, description és trader value adatokat is mutat.
- A market panel trader-felületként működik, seeded grove trader kínálattal és egyértelmű buy/sell/cancel feedbackkel.

## Phase 3 Social And Multiplayer

- A party és guild állapot most külön social activity feedben és részletes HUD snapshotban is látszik.
- A remote player spawn már névcímkével és presence összesítéssel jelenik meg a kliensen.
- A guild chat olvashatóbban látszik a HUD-ban és a social panelben is.
- Készült külön két klienses kézi ellenőrzőlista a [plans/multiplayer-playtest-checklist.md](plans/multiplayer-playtest-checklist.md) fájlban.

## Asset Pipeline

- A Boot scene a [client/assets/assetManifest.js](client/assets/assetManifest.js) alapján tölti a JSON és UI asseteket.
- A preload végén fut egy runtime asset audit is, ami jelzi, ha a manifestből hiányzik kötelező generated asset vagy valamelyik texture nem töltődött be.
- A generált player és enemy animációk a [client/systems/player/playerTextures.js](client/systems/player/playerTextures.js) bootstrapján keresztül jönnek létre.
- Az asset generátor használata és a jelenlegi elvárt assetkészlet a [plans/asset-pipeline.md](plans/asset-pipeline.md) fájlban van dokumentálva.

## Phase 4 UI And Polish

- A trader és social panelek közös modal shellre álltak át, így az inventory/shop és party/guild ablakok már ugyanazt a vizuális nyelvet használják.
- A HUD hierarchy tisztább lett: külön vitals, status, quickbar és social/combat rétegek látszanak, rövid onboarding hinttel.
- Az asset pipeline most egy extra enemy típust és két új környezeti propot is tartalmaz.
- Minimum audio fallback bekerült: UI click, hit, loot pickup és ambient drón hang akkor is működik, ha nincs külön audio asset csomag betöltve.

## Phase 5 Demo Closure

- A játékon belül most külön vertical slice objective tracker vezeti végig a camp -> crystal path -> combat -> loot -> trade -> guild -> second client flow-t.
- A demo content minimum most 12 használható itemet tartalmaz, a trader katalógus 8 listázással indul.
- A bemutató forgatókönyv a [plans/vertical-slice-walkthrough.md](plans/vertical-slice-walkthrough.md) fájlban van összefoglalva.
- A release candidate kézi ellenőrzőlista a [plans/release-candidate-checklist.md](plans/release-candidate-checklist.md) fájlban van.

## API váz

- `/api/auth`: login/register
- `/api/marketplace`: listing és buy endpointok
- `/api/parties`: party állapot lekérés és szinkron
- `/api/guilds`: guild lista, create, join, chat

## Launcher

- Az Electron launcher a [launcher/index.html](launcher/index.html) és [launcher/renderer.js](launcher/renderer.js) fájlokkal külön login/register/guest felületet ad.
- Sikeres launcher login után a játékablak előtöltött sessionnel indul, és átugorja a [client/scenes/LoginScene.js](client/scenes/LoginScene.js) képernyőt.

## Indítás

1. Telepítsd a függőségeket:

```bash
npm install
```

2. Másold a `.env.example` fájl értékeit saját `.env` fájlba, ha MongoDB-t is használnál.

3. Fejlesztői mód:

```bash
npm run dev
```

4. Tesztek:

```bash
npm test
```

5. Launcher:

```bash
npm run launcher
```

## Megjegyzés

A backend akkor is elindul, ha nincs MongoDB kapcsolat; ilyen esetben auth és marketplace célra in-memory fallback store dolgozik.

Party és guild state is működik in-memory fallback módban, így a social scaffold MongoDB nélkül is kipróbálható.