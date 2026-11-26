#!/usr/bin/env python3
"""
Export / import GoalWay mission bundles directly from / to Supabase
(standard library only). Mirrors the mission screen's buttons:

  export <mission id> <folder>
      Same bundle as the Export button (English screen):
      { exportedAt, mission, missionHe, instructionsEn, instructionsHe }.
      Writes <folder>/mission-<id>-<YYYY-MM-DD>.json and prints its path.

  import <bundle.json> [--dry-run]
      Same writes as the Import button (admin.tsx, "importMissionBundle"):
      upserts instructions (data_en, then data_he) and the mission by id,
      then reads the rows back to verify them. --dry-run only reports
      what would be written.

Configuration is read from the repository's .env (environment variables
override it):
  SUPABASE_PROJECT_URL, SUPABASE_API_KEY   (already used by the app)
  GOALWAY_EMAIL, GOALWAY_PASSWORD          (an admin GoalWay account; needed
                                            for import, used for export too
                                            when present)
Writes run as that signed-in user, so row-level security applies, exactly as
in the app. There is no service-role key.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ENV_FILE = REPO / ".env"

MISSION_STATUSES = [
    "Missing instructions",
    "Includes empty instructions",
    "Full instruction - no rewording",
    "Updated rewording",
    "Not updated rewording",
]
DEFAULT_STATUS = MISSION_STATUSES[0]


# ---------------------------------------------------------------- config / http
def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("SUPABASE_PROJECT_URL", "SUPABASE_API_KEY", "GOALWAY_EMAIL", "GOALWAY_PASSWORD"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    missing = [k for k in ("SUPABASE_PROJECT_URL", "SUPABASE_API_KEY") if not env.get(k)]
    if missing:
        raise SystemExit(f"ERROR: {', '.join(missing)} not set in {ENV_FILE}")
    env["SUPABASE_PROJECT_URL"] = env["SUPABASE_PROJECT_URL"].rstrip("/")
    return env


class Client:
    def __init__(self, env, need_login):
        self.url = env["SUPABASE_PROJECT_URL"]
        self.key = env["SUPABASE_API_KEY"]
        self.token = self.key
        self.user = None
        email, password = env.get("GOALWAY_EMAIL"), env.get("GOALWAY_PASSWORD")
        if email and password:
            res = self._req("POST", "/auth/v1/token?grant_type=password",
                            {"email": email, "password": password}, auth=False)
            self.token = res["access_token"]
            self.user = (res.get("user") or {}).get("email")
        elif need_login:
            raise SystemExit(
                f"ERROR: GOALWAY_EMAIL and GOALWAY_PASSWORD (an admin GoalWay account) must be set in {ENV_FILE} "
                "to import. Add them there yourself; they are never shown to Claude.")

    def _req(self, method, path, body=None, auth=True, prefer=None):
        headers = {"apikey": self.key, "Content-Type": "application/json", "Accept": "application/json"}
        headers["Authorization"] = f"Bearer {self.token if auth else self.key}"
        if prefer:
            headers["Prefer"] = prefer
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            if path.startswith("/auth/"):
                detail = re.sub(r'"(access|refresh)_token"\s*:\s*"[^"]*"', r'"\1_token":"…"', detail)
            raise SystemExit(f"ERROR: {method} {path.split('?')[0]} -> HTTP {e.code}: {detail}")
        except urllib.error.URLError as e:
            raise SystemExit(f"ERROR: cannot reach Supabase: {e.reason}")
        return json.loads(raw) if raw else None

    def select(self, table, columns, **filters):
        q = {"select": columns, **filters}
        return self._req("GET", f"/rest/v1/{table}?{urllib.parse.urlencode(q, safe='(),.*')}")

    def update(self, table, row_id, values):
        rows = self._req("PATCH", f"/rest/v1/{table}?id=eq.{urllib.parse.quote(row_id, safe='')}",
                         values, prefer="return=representation")
        if not rows:
            raise SystemExit(f"ERROR: update of {table} '{row_id}' changed no row "
                             "(row-level security refused it? sign in with an admin account)")

    def insert(self, table, values):
        rows = self._req("POST", f"/rest/v1/{table}", values, prefer="return=representation")
        if not rows:
            raise SystemExit(f"ERROR: insert into {table} '{values.get('id')}' returned no row")

    def exists(self, table, row_id):
        return bool(self.select(table, "id", id=f"eq.{row_id}"))


def in_list(ids):
    return "in.(" + ",".join('"' + i.replace("\\", "\\\\").replace('"', '\\"') + '"' for i in ids) + ")"


def now_iso():
    # Same format as JavaScript's Date.toISOString(): 2026-11-26T09:15:02.123Z
    t = datetime.now(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def normalize_status(s):
    return s if s in MISSION_STATUSES else DEFAULT_STATUS


def migrate_legacy(m):
    """missions.server.ts migrateLegacyMission."""
    if "instructions" in m:
        return {**m, "status": normalize_status(m.get("status"))}
    titles = m.get("instructionTitles") or {}
    return {
        "id": m.get("id"),
        "title": m.get("title"),
        "description": m.get("description"),
        "instructions": [[i, titles[i]] if titles.get(i) else [i] for i in (m.get("instructionIds") or [])],
        "status": normalize_status(m.get("status")),
    }


SPECIAL = re.compile(r"^(comment-|if-|end-if-|else-)|^T\d+$")


def real_instruction_ids(pairs):
    seen = []
    for pair in pairs:
        iid = pair[0]
        if SPECIAL.search(iid) or iid == "0":
            continue
        base = iid.split("#")[0]
        if base not in seen:
            seen.append(base)
    return seen


# ---------------------------------------------------------------- export
def cmd_export(mission_id, folder):
    db = Client(load_env(), need_login=False)
    rows = db.select("missions", "id,data_en,data_he,is_example", id=f"eq.{mission_id}", is_temp="eq.false")
    if not rows:
        raise SystemExit(f"ERROR: mission '{mission_id}' not found")
    row = rows[0]
    if row.get("data_en") is None:
        raise SystemExit(f"ERROR: mission '{mission_id}' has no English data (data_en)")
    m = migrate_legacy(row["data_en"])
    instructions = m.get("instructions") or []
    mission = {
        "id": m.get("id"),
        "title": m.get("title"),
        "description": m.get("description"),
        "instructions": instructions,
        "status": normalize_status(m.get("status")),
        "isExample": row.get("is_example") or False,
    }
    he = migrate_legacy(row["data_he"]) if row.get("data_he") is not None else {}

    def pick(k):
        v = he.get(k)
        return mission[k] if v is None else v

    mission_he = {k: pick(k) for k in ("id", "title", "description", "instructions", "status")}

    ids = real_instruction_ids(instructions)
    instr_en, instr_he = [], []
    if ids:
        irows = db.select("instructions", "id,data_en,data_he,is_temp,source_instruction_id",
                          id=in_list(ids), order="created_at.asc")
        for lang, out in (("data_en", instr_en), ("data_he", instr_he)):
            for r in irows:
                d = r.get(lang)
                if d is None or d.get("id") not in ids:
                    continue
                item = dict(d)
                item["isTemp"] = r.get("is_temp") or False
                item["sourceInstructionId"] = r.get("source_instruction_id")
                out.append(item)
    missing = [i for i in ids if i not in {x.get("id") for x in instr_en}]

    bundle = {
        "exportedAt": now_iso(),
        "mission": mission,
        "missionHe": mission_he,
        "instructionsEn": instr_en,
        "instructionsHe": instr_he,
    }
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"mission-{mission['id']}-{datetime.now(timezone.utc):%Y-%m-%d}.json"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)
    print(f"Exported mission {mission['id']} \"{mission['title']}\": "
          f"{len(instr_en)} instruction(s) EN, {len(instr_he)} HE")
    if missing:
        print("WARNING: instruction(s) referenced by the mission but not in the database:", ", ".join(missing))
    print(f"FILE: {path}")
    return 0


# ---------------------------------------------------------------- import
def cmd_import(path, dry_run):
    with open(path, encoding="utf-8-sig") as f:
        bundle = json.load(f)
    m, mhe = bundle.get("mission") or {}, bundle.get("missionHe")
    if not m.get("id"):
        raise SystemExit("ERROR: bundle is missing mission data")
    if m.get("status") and m["status"] not in MISSION_STATUSES:
        raise SystemExit("ERROR: bundle contains an invalid mission status")
    if mhe and mhe.get("status") and mhe["status"] not in MISSION_STATUSES:
        raise SystemExit("ERROR: bundle contains an invalid Hebrew mission status")
    en, he = bundle.get("instructionsEn") or [], bundle.get("instructionsHe") or []

    mission_payload = {k: m.get(k) for k in ("id", "title", "description", "instructions")}
    mission_payload["status"] = normalize_status(m.get("status"))
    he_payload = None
    if mhe:
        he_payload = {k: mhe.get(k) for k in ("id", "title", "description", "instructions")}
        he_payload["status"] = normalize_status(mhe.get("status"))

    if dry_run:
        print(f"DRY RUN: would write mission {m['id']} (data_en{', data_he' if he_payload else ''}"
              f"{', is_example' if 'isExample' in m else ''}), "
              f"{len(en)} instruction(s) data_en, {len(he)} instruction(s) data_he. Nothing written.")
        return 0

    db = Client(load_env(), need_login=True)
    print(f"Signed in as {db.user}")
    for instr in en:
        ts = now_iso()
        if db.exists("instructions", instr["id"]):
            db.update("instructions", instr["id"], {"data_en": instr, "updated_at": ts})
        else:
            db.insert("instructions", {"id": instr["id"], "data_en": instr, "data_he": None,
                                       "created_at": ts, "updated_at": ts})
    for instr in he:
        ts = now_iso()
        if db.exists("instructions", instr["id"]):
            db.update("instructions", instr["id"], {"data_he": instr, "updated_at": ts})
        else:
            db.insert("instructions", {"id": instr["id"], "data_en": dict(instr), "data_he": instr,
                                       "created_at": ts, "updated_at": ts})
    ts = now_iso()
    if db.exists("missions", m["id"]):
        values = {"data_en": mission_payload, "updated_at": ts}
        if he_payload:
            values["data_he"] = he_payload
        if "isExample" in m:
            values["is_example"] = m["isExample"]
        db.update("missions", m["id"], values)
    else:
        values = {"id": m["id"], "data_en": mission_payload, "data_he": he_payload,
                  "created_at": ts, "updated_at": ts}
        if "isExample" in m:
            values["is_example"] = m["isExample"]
        db.insert("missions", values)

    # read back and verify
    problems = []
    row = db.select("missions", "data_en,data_he", id=f"eq.{m['id']}")[0]
    if row["data_en"] != mission_payload:
        problems.append("missions.data_en")
    if he_payload and row["data_he"] != he_payload:
        problems.append("missions.data_he")
    ids = list({i["id"] for i in en + he})
    got = {r["id"]: r for r in db.select("instructions", "id,data_en,data_he", id=in_list(ids))} if ids else {}
    for lang, items in (("data_en", en), ("data_he", he)):
        for i in items:
            if (got.get(i["id"]) or {}).get(lang) != i:
                problems.append(f"instructions[{i['id']}].{lang}")
    if problems:
        print("ERROR: read-back differs for:", ", ".join(problems))
        return 1
    print(f"Imported mission \"{m['id']}\" with {len(en)} instruction(s); read-back verified.")
    return 0


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    if len(argv) == 3 and argv[0] == "export":
        return cmd_export(argv[1], argv[2])
    if len(argv) in (2, 3) and argv[0] == "import" and (len(argv) == 2 or argv[2] == "--dry-run"):
        return cmd_import(argv[1], len(argv) == 3)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
