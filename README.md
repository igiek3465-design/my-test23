# ROBLOX Classic - Browser Edition

Everything runs in the browser. No exe required to play.

## Start (local)
1. Install Python 3 (tick "Add Python to PATH").
2. Double-click `START.bat` (or `python3 run.py` / `./START.sh`).
3. Open the **Network** address it prints: yourself and everyone on the same WiFi.

Accounts, places, feed, friends and servers are saved in `C:\Users\<you>\RobloxClassicData\`
(on Linux/macOS: `~/RobloxClassicData/`).

## Deploy online (Render.com)
See **DEPLOY-RENDER.md** for a full step-by-step tutorial.
Short version: push this folder to GitHub → Render → New Web Service → Start Command `python run.py` → open the https://….onrender.com URL.

## Play
Publish a `.rbxl` in **Build**, open it, press **Play** — opens in the browser (any modern browser).
The game page lists servers for that place — Join or Create new server.
Players in different servers never see each other.

## Tabs
- **Home / Games** — continue playing, friends strip
- **Catalog** — wear items (hats / T-shirts by Roblox asset ID)
- **Build** — Places, 3D Assets, Admin (tabs in the left sidebar)
- **Studio** — trial browser studio: Explorer (Workspace, ReplicatedStorage, ServerScriptService, StarterGui, StarterPlayer, StarterPack…), Insert Part / Script / Folder / Mesh from Roblox ID, Properties, Lua source, Publish
- **Friends** — full friends page (also header button)
- **Builders Club / Download / Forum** — as before

## Trial limit
Only **1 place** per account. Delete the existing place in Build → My Places before publishing another (or when publishing from Studio).

## In game
WASD move, Space jump, right-drag camera, wheel zoom (scroll in = first person),
**Shift** = Shift Lock, **Esc** = menu, `/` = chat, 1–9 tools.
Scripts in the place run in your browser (Lua subset). Parts, tools, basic physics work; large places load nearby parts only.

## Skin / items
Catalog → wear items. Hats and T-shirts with a Roblox ID show on your 3D avatar.
(The PC running `run.py` needs internet to download item models.)

## Friends
Friends tab or header button → search / add. Open profile → Add Friend. Accept under Friends.

## Limits
- Scripts run locally in each browser (not fully synced).
- GUIs (ScreenGui), some meshes/decals/sounds inside places are limited.
- Studio trial saves structure + scripts; full binary `.rbxl` export from Studio is limited.
- Big places need RAM; only nearby parts are drawn.

## Test game: Sword Arena
Games list -> **Sword Arena (Test Game)** (built in, no upload needed, does not count toward the 1-place limit).
Press **1** to equip the Sword (`Sword.obj` + `Handle1_diff.png`), **click** to swing. Hits other players in the same server
(25 damage, 4 hits to kill) . Kills/Deaths board top right. Respawn on a random green pad; touching the baseplate = death.
Map code is in `fight.js` (`build()`); change the sword look by replacing `Sword.obj` / `Handle1_diff.png`.

Map uses `grid2.png` as texture, cursor is `cursor.png`. Esc menu -> **Skin** switches to `character.rbxm` (others see it too).
First person (scroll in) shows your arms and the sword. Chat bubbles vanish after 10 seconds.
Admin chat commands (accounts ROBLOX and igor): `/fly user` (Space up, C down), `/unfly user`, `/kick user`, `/ban user` (ban uses the site ban list).
