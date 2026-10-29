#!/usr/bin/env python3
"""
ROBLOX Classic – WiFi multiplayer web server (stdlib only, no pip needed)
=========================================================================
Run this on one PC on your WiFi, then everyone else opens:
    http://YOUR-IP:5000

Usage:
    python run.py
    (or:  py run.py    /    python3 run.py)

It serves the classic ROBLOX website and shares accounts, games,
inventory, ROBUX and chat across every device on the same network.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import json
import os
import socket
import hashlib
import time
from datetime import datetime
from pathlib import Path
import threading
import sys

# ---------- paths ----------
BASE_DIR = Path(__file__).resolve().parent
# On Render / cloud: use ./data (or RENDER_DISK_PATH / DATA_DIR env).
# Locally: keep data in ~/RobloxClassicData so it survives re-unzips.
_env_data = os.environ.get("DATA_DIR") or os.environ.get("RENDER_DISK_PATH")
if _env_data:
    DATA_DIR = Path(_env_data)
elif os.environ.get("RENDER") or os.environ.get("PORT"):
    # Detect cloud hosting (Render sets PORT). Use project-local folder.
    DATA_DIR = BASE_DIR / "data"
else:
    DATA_DIR = Path.home() / "RobloxClassicData"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE = DATA_DIR / "rbx_data.json"
if not DATA_FILE.exists() and (BASE_DIR / "rbx_data.json").exists():
    DATA_FILE.write_bytes((BASE_DIR / "rbx_data.json").read_bytes())
os.chdir(BASE_DIR)

# ---------- persistence ----------
_lock = threading.Lock()

DEFAULT_DATA = {
    "users": {},
    "catalog": [],
    "chat": [],
    "banned": [],
    "online": {},
}

def load_data():
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
            for k, v in DEFAULT_DATA.items():
                if k not in d:
                    d[k] = v
            return d
        except Exception as e:
            print("[RBX] Could not load data file:", e)
    return json.loads(json.dumps(DEFAULT_DATA))

def save_data(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("[RBX] Save error:", e)

DATA = load_data()

# ---------- chat filter (swear → #) ----------
_BAD_WORDS = (
    "fuck", "fucker", "fucking", "fuk", "fck", "shit", "shitty", "bullshit",
    "bitch", "asshole", "arsehole", "bastard", "dick", "dickhead", "cock",
    "pussy", "cunt", "whore", "slut", "nigger", "nigga", "faggot", "fag",
    "retard", "retarded", "motherfucker", "mf", "stfu", "gtfo", "damn",
    "dammit", "goddamn", "crap", "piss", "pissed", "wanker", "twat",
    "kurwa", "kurwy", "chuj", "chuja", "chuje", "pierdol", "pierdole",
    "pierdolisz", "jebac", "jebać", "jebany", "jebana", "jebane", "dupa",
    "dupie", "cipa", "cipę", "cipie", "spierdalaj", "spierdol", "pojeb",
    "pojebany", "skurwysyn", "skurwiel", "debil", "idiota", "huj", "huja",
    "kurw", "pierd", "jeb",
)

def censor_text(text: str) -> str:
    if not text:
        return text
    import re
    out = text
    words = sorted(set(_BAD_WORDS), key=len, reverse=True)
    for w in words:
        pat = re.compile(re.escape(w), re.IGNORECASE)
        out = pat.sub(lambda m: "#" * len(m.group(0)), out)
    return out

def hash_pw(pw: str) -> str:
    return hashlib.sha256(("rbx_classic_salt_" + pw).encode("utf-8")).hexdigest()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# ---------- request handler ----------

class RBXHandler(SimpleHTTPRequestHandler):
    # Force correct MIME types so PNGs, JPGs, JS, CSS, fonts all load (not as text)
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".html": "text/html",
        ".htm": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".obj": "text/plain",
        ".rbxm": "application/octet-stream",
        ".rbxl": "application/octet-stream",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".txt": "text/plain",
        ".md": "text/plain",
        ".xml": "application/xml",
        "": "application/octet-stream",
    }

    def log_message(self, fmt, *args):
        sys.stderr.write("[RBX] %s - %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # --- DODANA OBSŁUGA STRONY STARTOWEJ 2009 ---
        if path.lower() == "/ide/start.aspx":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Roblox 2009 Studio Start</h1></body></html>")
            return
        # ---------------------------------------------

        if path == "/api/status":
            self._send_json({
                "ok": True,
                "server": "ROBLOX Classic WiFi",
                "time": datetime.utcnow().isoformat() + "Z",
                "users": len(DATA.get("users", {})),
                "ip": get_local_ip(),
            })
            return

        if path == "/api/all_games":
            games = []
            with _lock:
                for uname, u in DATA.get("users", {}).items():
                    for g in u.get("games", []):
                        g2 = dict(g)
                        g2["creator"] = uname
                        games.append(g2)
            games.sort(key=lambda x: x.get("created", 0), reverse=True)
            games.insert(0, {"id": "testgame", "title": "Sword Arena (Test Game)", "creator": "ROBLOX", "owner": "ROBLOX",
                             "playing": "-", "visits": "-", "likes": "-", "thumb": "/arena-thumb.jpg", "color": "#7a2e0c",
                             "isDefault": True, "desc": "Built-in fighting game. Press 1 to equip the Sword, click to swing. Fight other players."})
            self._send_json({"ok": True, "games": games})
            return

        if path == "/api/chat":
            with _lock:
                msgs = DATA.get("chat", [])[-80:]
            self._send_json({"ok": True, "messages": msgs})
            return

        if path == "/api/online":
            now = time.time()
            with _lock:
                online = DATA.setdefault("online", {})
                online = {u: t for u, t in online.items() if now - t < 60}
                DATA["online"] = online
                save_data(DATA)
            self._send_json({"ok": True, "users": list(online.keys())})
            return

        # static files – serve HTML, PNG, JPG, JS, CSS, fonts, etc. correctly
        if path == "/" or path == "":
            self.path = "/index.html"
        # Ensure binary-safe serving and correct Content-Type for images
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()

        if path == "/api/signup":
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
            if not username or not password:
                self._send_json({"ok": False, "error": "Username and password required."})
                return
            if len(username) < 3 or len(username) > 20:
                self._send_json({"ok": False, "error": "Username must be 3–20 characters."})
                return
            if any(c in username for c in " /\\<>\"'"):
                self._send_json({"ok": False, "error": "Username contains invalid characters."})
                return
            with _lock:
                users = DATA.setdefault("users", {})
                if username.lower() in {u.lower() for u in users}:
                    self._send_json({"ok": False, "error": "Username already taken."})
                    return
                if username.lower() in {b.lower() for b in DATA.get("banned", [])}:
                    self._send_json({"ok": False, "error": "This username is banned."})
                    return
                users[username] = {
                    "password_hash": hash_pw(password),
                    "robux": 0,
                    "bc": None,
                    "games": [],
                    "inventory": [],
                    "wearing": [],
                    "friends": [],
                    "created": time.time(),
                }
                save_data(DATA)
            print(f"[RBX] New account: {username}")
            self._send_json({"ok": True, "username": username})
            return

        if path == "/api/login":
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
            if not username or not password:
                self._send_json({"ok": False, "error": "Username and password required."})
                return
            with _lock:
                users = DATA.get("users", {})
                real_name = None
                for u in users:
                    if u.lower() == username.lower():
                        real_name = u
                        break
                if not real_name:
                    self._send_json({"ok": False, "error": "Invalid username or password."})
                    return
                if real_name.lower() in {b.lower() for b in DATA.get("banned", [])}:
                    self._send_json({"ok": False, "error": "This account is banned."})
                    return
                user = users[real_name]
                if user.get("password_hash") != hash_pw(password):
                    self._send_json({"ok": False, "error": "Invalid username or password."})
                    return
                DATA.setdefault("online", {})[real_name] = time.time()
                save_data(DATA)
                self._send_json({
                    "ok": True,
                    "username": real_name,
                    "robux": user.get("robux", 0),
                    "bc": user.get("bc"),
                    "games": user.get("games", []),
                    "inventory": user.get("inventory", []),
                    "wearing": user.get("wearing", []),
                    "friends": user.get("friends", []),
                })
            return

        if path == "/api/save_user":
            username = (body.get("username") or "").strip()
            if not username:
                self._send_json({"ok": False, "error": "No username"})
                return
            with _lock:
                users = DATA.setdefault("users", {})
                real_name = None
                for u in users:
                    if u.lower() == username.lower():
                        real_name = u
                        break
                if not real_name:
                    self._send_json({"ok": False, "error": "User not found"})
                    return
                user = users[real_name]
                if "robux" in body:
                    user["robux"] = int(body["robux"])
                if "bc" in body:
                    user["bc"] = body["bc"]
                if "games" in body and isinstance(body["games"], list):
                    user["games"] = body["games"]
                if "inventory" in body and isinstance(body["inventory"], list):
                    user["inventory"] = body["inventory"]
                if "wearing" in body and isinstance(body["wearing"], list):
                    user["wearing"] = body["wearing"]
                if "friends" in body and isinstance(body["friends"], list):
                    user["friends"] = body["friends"]
                DATA.setdefault("online", {})[real_name] = time.time()
                save_data(DATA)
            self._send_json({"ok": True})
            return

        if path == "/api/chat":
            user = (body.get("user") or "").strip()
            text = censor_text((body.get("text") or "").strip()[:300])
            if not user or not text:
                self._send_json({"ok": False, "error": "Empty"})
                return
            with _lock:
                DATA.setdefault("chat", []).append({
                    "user": user,
                    "text": text,
                    "ts": time.time(),
                })
                DATA["chat"] = DATA["chat"][-200:]
                save_data(DATA)
            self._send_json({"ok": True})
            return

        if path == "/api/play":
            title = body.get("title") or "Place"
            user = body.get("username") or "Player"
            self._send_json({
                "ok": True,
                "message": f'Joining "{title}" as {user}…',
            })
            return

        if path == "/api/ban":
            admin = (body.get("admin") or "").strip()
            target = (body.get("target") or "").strip()
            if admin.upper() not in ("ROBLOX", "IGOR"):
                self._send_json({"ok": False, "error": "Not an admin"})
                return
            if not target:
                self._send_json({"ok": False, "error": "No target"})
                return
            with _lock:
                banned = DATA.setdefault("banned", [])
                if target.lower() not in {b.lower() for b in banned}:
                    banned.append(target)
                DATA.get("online", {}).pop(target, None)
                save_data(DATA)
            self._send_json({"ok": True})
            return

        self._send_json({"ok": False, "error": "Unknown API"}, 404)

# ---------- multiplayer add-on ----------
try:
    from multiplayer import install as _install_mp
    RBXHandler = _install_mp(RBXHandler, get_local_ip, DATA, _lock, save_data, DATA_DIR)
    print("[RBX] Multiplayer / launcher add-on loaded.")
except Exception as _e:
    print("[RBX] Multiplayer add-on NOT loaded:", _e)

# ---------- main ----------

if __name__ == "__main__":
    ip = get_local_ip()
    port = int(os.environ.get("PORT", "5000"))
    print()
    print("=" * 58)
    print("  ROBLOX Classic  –  Web Server")
    print("=" * 58)
    print(f"  Local:    http://127.0.0.1:{port}")
    print(f"  Network:  http://{ip}:{port}")
    print()
    print("  Open the URL above in any browser.")
    print("  Data is saved in:", DATA_DIR)
    print("  Press Ctrl+C to stop.")
    print("=" * 58)
    print()
    server = ThreadingHTTPServer(("0.0.0.0", port), RBXHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[RBX] Server stopped.")
        server.server_close()
    except Exception as e:
        print("\nERROR:", e)
