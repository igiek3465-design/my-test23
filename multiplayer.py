"""
ROBLOX Classic WiFi - multiplayer / launcher add-on (stdlib only)
=================================================================
Adds to run.py (nothing is removed):
  * stores the real .rbxl place files on the server  (places/ folder)
  * "sessions": first player to press Play on a place becomes the HOST,
    everybody else who presses Play on the same place JOINS that host
  * serves the 2013-style Lua scripts the old RobloxPlayerBeta.exe loads
    with   -a <auth url>  -t <ticket>  -j <join script url>
  * serves the small launcher files so other PCs can download them
"""
import json
import re
import time
import uuid
import zlib
import threading
import base64
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE_DIR = Path(__file__).resolve().parent
PLACES_DIR = BASE_DIR / "places"
GAME_PORT = 53640          # UDP port the game server listens on
SESSION_TTL = 90           # seconds without a heartbeat before a session is dead
MAX_UPLOAD = 1024 * 1024 * 1024

LAUNCHER_FILES = {
    "INSTALL-LAUNCHER.bat", "launch.bat", "launcher.py", "launcher_config.json",
    "RobloxPlayerBeta.exe",
}

SESSIONS = {}
MP = {}
_slock = threading.Lock()


def _safe_id(s):
    return re.sub(r"[^A-Za-z0-9_\-]", "", str(s or ""))[:64]


def _safe_name(s):
    return re.sub(r"[^A-Za-z0-9_]", "", str(s or "Player"))[:20] or "Player"


def _numeric(s):
    return zlib.crc32(str(s).encode("utf-8")) & 0x7FFFFFFF or 1


def _fresh(sess):
    return time.time() - sess["last"] < SESSION_TTL


def _players(sess):
    now = time.time()
    return sorted(u for u, t in sess["players"].items() if now - t < SESSION_TTL)


_HAT_CACHE = {}


def _http(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout).read()


def _hash_url(h):
    i = 31
    for ch in h:
        i ^= ord(ch)
    return "https://t%d.rbxcdn.com/%s" % (i % 8, h)


def fetch_hat(aid):
    """Download the 3D model (obj + texture) of a Roblox asset through THIS server's internet."""
    if aid in _HAT_CACHE:
        return _HAT_CACHE[aid]
    meta = None
    for _ in range(6):
        j = json.loads(_http("https://thumbnails.roblox.com/v1/assets-thumbnail-3d?assetId=%d" % aid))
        if j.get("state") in ("Error", "Blocked"):
            break
        if j.get("state") == "Completed" and j.get("imageUrl"):
            meta = json.loads(_http(j["imageUrl"]))
            break
        time.sleep(1.3)
    if not meta:
        raise RuntimeError("Roblox has no 3D model for this ID (use a hat/accessory ID).")
    obj = _http(_hash_url(meta["obj"])).decode("utf-8", "replace")
    tex = ["data:image/png;base64," + base64.b64encode(_http(_hash_url(h))).decode()
           for h in (meta.get("textures") or [])[:2]]
    _HAT_CACHE[aid] = {"ok": True, "obj": obj, "textures": tex}
    return _HAT_CACHE[aid]


def fetch_shirt(aid):
    key = ("shirt", aid)
    if key in _HAT_CACHE:
        return _HAT_CACHE[key]
    xml = _http("https://assetdelivery.roblox.com/v1/asset/?id=%d" % aid).decode("utf-8", "replace")
    mm = re.search(r"<url>[^<]*?id=(\d+)</url>", xml, re.I) or re.search(r"rbxassetid://(\d+)", xml)
    if not mm:
        raise RuntimeError("not a hat or shirt")
    img = _http("https://assetdelivery.roblox.com/v1/asset/?id=%s" % mm.group(1))
    out = {"ok": True, "shirt": "data:image/png;base64," + base64.b64encode(img).decode(),
           "tmpl": 'class="Shirt"' in xml}
    _HAT_CACHE[key] = out
    return out


def install(Base, get_local_ip, DATA=None, dlock=None, save=None, data_dir=None):
    """Return a handler class that adds the new routes on top of Base."""
    global PLACES_DIR
    if data_dir:
        PLACES_DIR = Path(data_dir) / "places"
    dlock = dlock or threading.Lock()

    class Handler(Base):

        # ---------- helpers ----------
        def _text(self, text, ctype="text/plain; charset=utf-8", status=200):
            body = text.encode("utf-8") if isinstance(text, str) else text
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _base_url(self):
            host = self.headers.get("Host") or "%s:5000" % get_local_ip()
            if host.startswith("127.0.0.1") or host.startswith("localhost"):
                host = "%s:%s" % (get_local_ip(), host.split(":")[-1] if ":" in host else "5000")
            # Render / reverse proxies set X-Forwarded-Proto (https on public URL)
            proto = (self.headers.get("X-Forwarded-Proto") or "http").split(",")[0].strip()
            if proto not in ("http", "https"):
                proto = "http"
            return proto + "://" + host

        def _client_ip(self):
            ip = self.client_address[0]
            if ip in ("127.0.0.1", "::1", "localhost"):
                return get_local_ip()
            return ip

        # ---------- GET ----------
        def do_GET(self):
            p = urlparse(self.path)
            path, q = p.path, parse_qs(p.query)

            # never hand out the account database
            if path.lower().endswith("rbx_data.json") or path.startswith("/places/"):
                return self._text("Not found", status=404)

            if path.startswith("/api/place/"):
                pid = _safe_id(path.rsplit("/", 1)[-1].replace(".rbxl", ""))
                f = PLACES_DIR / (pid + ".rbxl")
                if not f.exists():
                    return self._text("No such place", status=404)
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(f.stat().st_size))
                self.end_headers()
                with open(f, "rb") as fh:
                    while True:
                        chunk = fh.read(1 << 20)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                return

            if path == "/api/place_info":
                pid = _safe_id((q.get("id") or [""])[0])
                f = PLACES_DIR / (pid + ".rbxl")
                return self._send_json({"ok": True, "has": f.exists() or pid == "testgame",
                                        "size": f.stat().st_size if f.exists() else 0})

            if path == "/api/session_info":
                gid = _safe_id((q.get("gameId") or [""])[0])
                with _slock:
                    s = SESSIONS.get(gid)
                    visits = (DATA or {}).get("visits", {}).get(gid, 0)
                    if not s or not _fresh(s):
                        return self._send_json({"ok": True, "active": False, "players": [], "visits": visits})
                    return self._send_json({"ok": True, "active": True, "host": s["host_user"], "visits": visits,
                                            "hostIp": s["host_ip"], "players": _players(s)})

            if path == "/api/hat3d":
                try:
                    aid = int((q.get("id") or ["0"])[0])
                    try:
                        return self._send_json(fetch_hat(aid))
                    except Exception:
                        return self._send_json(fetch_shirt(aid))
                except Exception as e:
                    return self._send_json({"ok": False, "error": "Could not load: %s (the PC running run.py needs internet)" % e})

            if path == "/api/servers":
                gid = _safe_id((q.get("g") or [""])[0])
                now, out = time.time(), []
                with _slock:
                    for k in list(MP):
                        if not k.startswith(gid + "|"):
                            continue
                        g = MP[k]
                        g["pl"] = {u: v for u, v in g["pl"].items() if now - v["t"] < 6}
                        if not g["pl"] and now - g.get("last", g.get("created", 0)) > 25:
                            del MP[k]
                            continue
                        out.append({"id": k.split("|", 1)[1], "owner": g.get("owner", ""),
                                    "players": sorted(g["pl"]), "age": int(now - g.get("created", now))})
                out.sort(key=lambda s: -len(s["players"]))
                return self._send_json({"ok": True, "servers": out})

            if path == "/api/friends":
                me = (q.get("u") or [""])[0]
                with dlock:
                    fr = DATA.get("fr", {"req": [], "f": {}})
                    real = next((u for u in DATA.get("users", {}) if u.lower() == me.lower()), me)
                    on = DATA.get("online", {})
                    friends = [{"name": f, "online": time.time() - on.get(f, 0) < 60} for f in fr["f"].get(real, [])]
                    inc = [r["from"] for r in fr["req"] if r["to"] == real]
                    out = [r["to"] for r in fr["req"] if r["from"] == real]
                return self._send_json({"ok": True, "friends": friends, "incoming": inc, "outgoing": out})

            if path == "/api/users":
                qs = (q.get("q") or [""])[0].strip().lower()
                with dlock:
                    out = [{"username": u, "games": len(d.get("games", []))}
                           for u, d in DATA.get("users", {}).items() if qs in u.lower()]
                return self._send_json({"ok": True, "users": out[:20]})

            if path == "/api/profile":
                name = (q.get("u") or [""])[0].strip()
                with dlock:
                    real = next((u for u in DATA.get("users", {}) if u.lower() == name.lower()), None)
                    if not real:
                        return self._send_json({"ok": False, "error": "No such user."})
                    d = DATA["users"][real]
                    games = [dict(g) for g in d.get("games", [])]
                    for g in games:
                        g.pop("fileData", None)
                    posts = [x for x in DATA.get("feed", []) if x["user"] == real][-20:][::-1]
                    online = time.time() - DATA.get("online", {}).get(real, 0) < 60
                return self._send_json({"ok": True, "username": real, "created": d.get("created", 0),
                                        "games": games, "posts": posts, "online": online,
                                        "wearing": d.get("wearing", [])})

            if path == "/api/feed":
                with dlock:
                    posts = DATA.get("feed", [])[-40:][::-1]
                return self._send_json({"ok": True, "posts": posts})

            if path == "/game/host.lua":
                gid = _safe_id((q.get("place") or [""])[0])
                port = int((q.get("port") or [GAME_PORT])[0])
                base = self._base_url()
                return self._text(_host_lua(base, gid, port))

            if path == "/game/join.lua":
                host = re.sub(r"[^0-9A-Za-z\.\-]", "", (q.get("host") or ["127.0.0.1"])[0])
                port = int((q.get("port") or [GAME_PORT])[0])
                user = _safe_name((q.get("user") or ["Player"])[0])
                gid = _safe_id((q.get("place") or [""])[0])
                return self._text(_join_lua(host, port, user, gid))

            if path.lower().startswith("/login/negotiate"):
                return self._text("0")

            if path.lower().startswith("/setting/"):
                return self._send_json({"FFlagSecureJoinScripts": False,
                                        "SecureJoinScripts": False})

            if path.startswith("/launcher/"):
                name = path.split("/", 2)[-1]
                if name in LAUNCHER_FILES and (BASE_DIR / name).exists():
                    return self._text((BASE_DIR / name).read_bytes(),
                                      "application/octet-stream")
                return self._text("Not found", status=404)

            return Base.do_GET(self)

        # ---------- POST ----------
        def do_POST(self):
            p = urlparse(self.path)
            path, q = p.path, parse_qs(p.query)

            if path == "/api/upload_place":
                pid = _safe_id((q.get("id") or [""])[0])
                length = int(self.headers.get("Content-Length", 0) or 0)
                if not pid or length <= 0 or length > MAX_UPLOAD:
                    return self._send_json({"ok": False, "error": "Bad upload."})
                PLACES_DIR.mkdir(exist_ok=True)
                dest = PLACES_DIR / (pid + ".rbxl")
                if "json" in (self.headers.get("Content-Type") or ""):
                    try:
                        raw = base64.b64decode(json.loads(self.rfile.read(length).decode("utf-8")).get("data", ""))
                    except Exception:
                        return self._send_json({"ok": False, "error": "Bad base64."})
                    dest.write_bytes(raw)
                else:
                    left = length
                    with open(dest, "wb") as fh:
                        while left > 0:
                            chunk = self.rfile.read(min(1 << 20, left))
                            if not chunk:
                                break
                            fh.write(chunk)
                            left -= len(chunk)
                print("[RBX] Stored place %s (%d bytes)" % (pid, dest.stat().st_size))
                return self._send_json({"ok": True, "size": dest.stat().st_size})

            if path == "/api/mp":
                body = self._read_json()
                gid, user = _safe_id(body.get("g")), _safe_name(body.get("u"))
                key = gid + "|" + (_safe_id(body.get("s")) or "main")
                try:
                    pos = [float(x) for x in (body.get("p") or [])[:10]]
                except Exception:
                    pos = [0, 5, 0, 0, 0, 0]
                say, since, now = str(body.get("say") or "")[:200].strip(), int(body.get("since") or 0), time.time()
                with _slock:
                    g = MP.setdefault(key, {"pl": {}, "chat": [], "n": 0, "owner": user, "created": now})
                    g["last"] = now
                    g["pl"][user] = {"p": pos, "t": now}
                    g["pl"] = {k: v for k, v in g["pl"].items() if now - v["t"] < 6}
                    fx = body.get("fx") or {}
                    try:
                        es = int(fx.get("es", -1))
                    except Exception:
                        es = -1
                    g.setdefault("sc", {}); g.setdefault("ev", []); g.setdefault("en", 0); g.setdefault("hit_t", {})
                    g["sc"].setdefault(user, [0, 0])
                    if fx.get("h") and now - g["hit_t"].get(user, 0) > 0.2:
                        for h in (fx.get("h") or [])[:4]:
                            try:
                                to, dmg = _safe_name(h[0]), max(1, min(30, int(h[1])))
                            except Exception:
                                continue
                            if to and to != user and to in g["pl"]:
                                g["en"] += 1
                                g["ev"] = (g["ev"] + [[g["en"], user, to, dmg]])[-80:]
                        g["hit_t"][user] = now
                    if fx.get("d"):
                        by = _safe_name(fx.get("by")) if fx.get("by") else ""
                        g["sc"][user][1] += 1
                        if by and by != user:
                            g["sc"].setdefault(by, [0, 0])[0] += 1
                        g["n"] += 1
                        g["chat"] = (g["chat"] + [[g["n"], "ROBLOX", (user + " was slain by " + by) if by and by != user else (user + " fell")]])[-60:]
                    bn = user.lower() in {b.lower() for b in (DATA or {}).get("banned", [])}
                    if bn:
                        g["pl"].pop(user, None)
                    if say.startswith("/"):
                        pw = say[1:].split()
                        cmd, tgt = (pw[0].lower() if pw else ""), (_safe_name(pw[1]) if len(pw) > 1 else "")
                        msg = "Commands (admins only): /fly user, /unfly user, /kick user, /ban user"
                        if cmd in ("fly", "unfly", "kick", "ban") and tgt:
                            real = next((k for k in g["pl"] if k.lower() == tgt.lower()), None)
                            if user.upper() not in ("ROBLOX", "IGOR"):
                                msg = "You are not an admin."
                            elif tgt.upper() in ("ROBLOX", "IGOR"):
                                msg = "You cannot target an admin."
                            elif cmd == "ban":
                                with dlock:
                                    bl = DATA.setdefault("banned", [])
                                    if tgt.lower() not in {b.lower() for b in bl}:
                                        bl.append(real or tgt)
                                        save(DATA)
                                g.setdefault("kick", {})[real or tgt] = now
                                msg = (real or tgt) + " was banned by " + user
                            elif not real:
                                msg = tgt + " is not in this server."
                            elif cmd == "kick":
                                g.setdefault("kick", {})[real] = now
                                g["pl"].pop(real, None)
                                msg = real + " was kicked by " + user
                            else:
                                g.setdefault("fly", {})[real] = (cmd == "fly")
                                msg = real + (" can now fly (Space up, C down)" if cmd == "fly" else " can no longer fly") + " - by " + user
                        g["n"] += 1
                        g["chat"] = (g["chat"] + [[g["n"], "ROBLOX", msg]])[-60:]
                        say = ""
                    if say:
                        g["n"] += 1
                        g["chat"] = (g["chat"] + [[g["n"], user, say]])[-60:]
                    out = {"ok": True, "pl": {k: v["p"] for k, v in g["pl"].items()},
                           "chat": [c for c in g["chat"] if c[0] > since],
                           "ev": [e for e in g["ev"] if e[0] > es] if es >= 0 else [], "en": g["en"], "sc": g["sc"], "fly": bool(g.get("fly", {}).get(user)),
                           "kick": bn or now - g.get("kick", {}).get(user, 0) < 15, "banned": bn}
                return self._send_json(out)

            if path == "/api/feed":
                body = self._read_json()
                user, text = _safe_name(body.get("user")), str(body.get("text") or "").strip()[:200]
                with dlock:
                    real = next((u for u in DATA.get("users", {}) if u.lower() == user.lower()), None)
                    if not real or not text:
                        return self._send_json({"ok": False, "error": "Bad post."})
                    DATA.setdefault("feed", []).append({"user": real, "text": text, "ts": time.time()})
                    DATA["feed"] = DATA["feed"][-300:]
                    save(DATA)
                return self._send_json({"ok": True})

            if path == "/api/server_create":
                body = self._read_json()
                gid, user = _safe_id(body.get("g")), _safe_name(body.get("u"))
                sid = uuid.uuid4().hex[:6]
                with _slock:
                    MP[gid + "|" + sid] = {"pl": {}, "chat": [], "n": 0, "owner": user,
                                           "created": time.time(), "last": time.time()}
                return self._send_json({"ok": True, "id": sid})

            if path == "/api/friend_request":
                body = self._read_json()
                a, b = str(body.get("from") or ""), str(body.get("to") or "")
                with dlock:
                    us = DATA.get("users", {})
                    a = next((u for u in us if u.lower() == a.lower()), None)
                    b = next((u for u in us if u.lower() == b.lower()), None)
                    if not a or not b or a == b:
                        return self._send_json({"ok": False, "error": "Bad request."})
                    fr = DATA.setdefault("fr", {"req": [], "f": {}})
                    if b in fr["f"].get(a, []):
                        return self._send_json({"ok": True, "state": "friends"})
                    if {"from": b, "to": a} in fr["req"]:
                        fr["req"].remove({"from": b, "to": a})
                        fr["f"].setdefault(a, []).append(b)
                        fr["f"].setdefault(b, []).append(a)
                        state = "friends"
                    else:
                        if {"from": a, "to": b} not in fr["req"]:
                            fr["req"].append({"from": a, "to": b})
                        state = "sent"
                    save(DATA)
                return self._send_json({"ok": True, "state": state})

            if path == "/api/friend_respond":
                body = self._read_json()
                me, other = str(body.get("user") or ""), str(body.get("from") or "")
                with dlock:
                    fr = DATA.setdefault("fr", {"req": [], "f": {}})
                    req = next((r for r in fr["req"] if r["to"].lower() == me.lower() and r["from"].lower() == other.lower()), None)
                    if not req:
                        return self._send_json({"ok": False, "error": "No such request."})
                    fr["req"].remove(req)
                    if body.get("accept"):
                        fr["f"].setdefault(req["to"], []).append(req["from"])
                        fr["f"].setdefault(req["from"], []).append(req["to"])
                    save(DATA)
                return self._send_json({"ok": True})

            if path == "/api/session":
                body = self._read_json()
                gid = _safe_id(body.get("gameId"))
                user = _safe_name(body.get("username"))
                if not gid:
                    return self._send_json({"ok": False, "error": "No game."})
                if not (PLACES_DIR / (gid + ".rbxl")).exists():
                    return self._send_json({"ok": False, "error": "no_place"})
                ip = self._client_ip()
                with _slock:
                    s = SESSIONS.get(gid)
                    if s and _fresh(s):
                        role = "join"
                    else:
                        s = {"id": uuid.uuid4().hex[:10], "host_user": user, "host_ip": ip,
                             "last": time.time(), "players": {}}
                        SESSIONS[gid] = s
                        role = "host"
                    s["players"][user] = time.time()
                    with dlock:
                        vis = DATA.setdefault("visits", {})
                        vis[gid] = vis.get(gid, 0) + 1
                        save(DATA)
                    out = {"ok": True, "role": role, "sess": s["id"], "hostIp": s["host_ip"],
                           "hostUser": s["host_user"], "port": GAME_PORT,
                           "players": _players(s)}
                print("[RBX] %s -> %s (%s) on %s" % (user, role.upper(), ip, gid))
                return self._send_json(out)

            if path == "/api/session_ping":
                body = self._read_json()
                sid, user = body.get("sess"), _safe_name(body.get("user"))
                with _slock:
                    for gid, s in list(SESSIONS.items()):
                        if s["id"] == sid:
                            if body.get("left"):
                                s["players"].pop(user, None)
                                if body.get("role") == "host":
                                    SESSIONS.pop(gid, None)
                            else:
                                s["players"][user] = time.time()
                                if body.get("role") == "host":
                                    s["last"] = time.time()
                            return self._send_json({"ok": True})
                return self._send_json({"ok": False, "error": "no session"})

            return Base.do_POST(self)

    return Handler


# ---------- Lua scripts for the old (2013) client ----------

def _host_lua(base, gid, port):
    pid = _numeric(gid)
    return """-- ROBLOX Classic WiFi : server script (generated)
pcall(function() game:SetPlaceID(%d, false) end)
pcall(function() game:GetService("ContentProvider"):SetBaseUrl("%s/") end)

local ok, err = pcall(function() game:Load("%s/api/place/%s.rbxl") end)
if not ok then print("Could not load place: " .. tostring(err)) end

local Players = game:GetService("Players")
pcall(function() Players.CharacterAutoSpawn = false end)
Players.PlayerAdded:connect(function(player)
  print("Player joined: " .. tostring(player.Name))
  player.CharacterAdded:connect(function(char)
    local hum = char:FindFirstChild("Humanoid")
    if hum then
      hum.Died:connect(function() wait(5) player:LoadCharacter() end)
    end
  end)
  player:LoadCharacter()
end)

game:GetService("NetworkServer"):Start(%d, 20)
game:GetService("RunService"):Run()
""" % (pid, base, base, gid, port)


def _join_lua(host, port, user, gid):
    pid = _numeric(gid)
    uid = _numeric("user:" + user) % 900000000 + 100000
    return """-- ROBLOX Classic WiFi : client join script (generated)
pcall(function() game:SetPlaceID(%d, false) end)
local client = game:GetService("NetworkClient")
local player = game:GetService("Players"):CreateLocalPlayer(%d)
player.Name = "%s"
pcall(function() player:SetSuperSafeChat(false) end)
pcall(function() game:SetMessage("Connecting to %s ...") end)

client.ConnectionAccepted:connect(function(peer, replicator)
  pcall(function() game:SetMessage("") end)
  pcall(function() game:ClearMessage() end)
end)
client.ConnectionFailed:connect(function(peer, code, msg)
  pcall(function() game:SetMessage("Connection failed: " .. tostring(msg)) end)
end)

local ok, err = pcall(function() client:PlayerConnect(%d, "%s", %d, 0, 20) end)
if not ok then pcall(function() game:SetMessage("Could not connect: " .. tostring(err)) end) end
game:GetService("RunService"):Run()
""" % (pid, uid, user, host, uid, host, port)
