#!/usr/bin/env python3
"""
GoalWay mission-bundle helper (standard library only).

Commands
--------
  strings  <input.json> <strings.json>
      List every string that may be edited, keyed by an address, with its
      current English text. Fill a copy of this file with the new wording.

  build    <input.json> <edits.json> <output.json> [--keep WORD ...]
      Build the output deterministically:
        * missionHe       = copy of mission
        * instructionsHe  = copy of instructionsEn
      then apply the English edits ("en") to mission / instructionsEn and the
      Hebrew translations ("he") to missionHe / instructionsHe, and validate.

  images   <input.json> <folder>
      Download the screenshots of the bundle's instructions (image entries in
      instructionsEn) into <folder>, so they can be looked at before
      rewording. Writes <folder>/images.json: for each image, its file name,
      instruction id, explanation index and annotations (badge label, text,
      position and size as % of the image). Only public GoalWay storage URLs
      on ALLOWED_HOSTS are fetched; anything else is skipped.

  validate <input.json> <output.json> [--keep WORD ...]
      Check that output.json keeps the structure of input.json and changes
      only the allowed fields. Exit code 0 = OK (warnings allowed), 1 = errors.

Addresses (same address is used for "en" and "he"):
  mission.title
  mission.description
  mission.instructions[<index>]                 second item of that pair
  instr[<id>].title
  instr[<id>].explanation[<i>].content          only entries of type "text"
  instr[<id>].explanation[<i>].annotations[<j>].text
"""

import copy
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Image hosts the `images` command may download from. Must match the
# sandbox network allow-list in .claude/settings.json.
ALLOWED_HOSTS = {"pmrjsnveoqquqftlvqmz.supabase.co"}
PUBLIC_PATH = "/storage/v1/object/public/"
MAX_IMAGE_BYTES = 15 * 1024 * 1024
IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp"}
KEEP_FILE = HERE / "keep_english.txt"
HEB = re.compile(r"[֐-׿]")
ADDR = re.compile(
    r"^(?:mission\.(title|description)"
    r"|mission\.instructions\[(\d+)\]"
    r"|instr\[([^\]]+)\]\.(?:(title)"
    r"|explanation\[(\d+)\]\.(?:(content)|annotations\[(\d+)\]\.text)))$"
)


# ---------------------------------------------------------------- helpers
def load(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def save(obj, path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def keep_words(extra):
    words = []
    if KEEP_FILE.exists():
        for line in KEEP_FILE.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                words.append(line)
    return words + list(extra or [])


def by_id(lst):
    return {str(i.get("id")): i for i in lst}


def editable(bundle):
    """Yield (address, text) for every editable string (English side)."""
    m = bundle.get("mission", {})
    for k in ("title", "description"):
        if isinstance(m.get(k), str) and m[k].strip():
            yield f"mission.{k}", m[k]
    for i, pair in enumerate(m.get("instructions", [])):
        if len(pair) > 1 and isinstance(pair[1], str) and pair[1].strip():
            yield f"mission.instructions[{i}]", pair[1]
    for ins in bundle.get("instructionsEn", []):
        iid = ins.get("id")
        if isinstance(ins.get("title"), str) and ins["title"].strip():
            yield f"instr[{iid}].title", ins["title"]
        for e, ent in enumerate(ins.get("explanation", [])):
            if ent.get("type") == "text" and isinstance(ent.get("content"), str):
                yield f"instr[{iid}].explanation[{e}].content", ent["content"]
            for a, ann in enumerate(ent.get("annotations", []) or []):
                if isinstance(ann.get("text"), str) and ann["text"].strip():
                    yield f"instr[{iid}].explanation[{e}].annotations[{a}].text", ann["text"]


def set_at(bundle, addr, text, he):
    mt = ADDR.match(addr)
    if not mt:
        raise KeyError(f"bad address: {addr}")
    mkey, midx, iid, ititle, eidx, econt, aidx = mt.groups()
    mission = bundle["missionHe" if he else "mission"]
    instrs = by_id(bundle["instructionsHe" if he else "instructionsEn"])
    if mkey:
        mission[mkey] = text
    elif midx is not None:
        pair = mission["instructions"][int(midx)]
        if len(pair) < 2 or pair[1] is None:
            raise KeyError(f"{addr}: second item is empty and must stay empty")
        pair[1] = text
    else:
        ins = instrs[iid]
        if ititle:
            ins["title"] = text
        else:
            ent = ins["explanation"][int(eidx)]
            if econt:
                if ent.get("type") != "text":
                    raise KeyError(f"{addr}: entry is type '{ent.get('type')}', only 'text' content may change")
                ent["content"] = text
            else:
                ent["annotations"][int(aidx)]["text"] = text


# ---------------------------------------------------------------- validation
class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, m):
        self.errors.append(m)

    def warn(self, m):
        self.warnings.append(m)


def same_except(a, b, allowed, path, rep):
    """Compare two dicts; keys in `allowed` may differ in value (must stay str)."""
    if set(a) != set(b):
        rep.err(f"{path}: keys differ (missing {sorted(set(a)-set(b))}, added {sorted(set(b)-set(a))})")
    for k in set(a) & set(b):
        if k in allowed:
            if type(a[k]) is not type(b[k]):
                rep.err(f"{path}.{k}: type changed")
        elif a[k] != b[k]:
            rep.err(f"{path}.{k}: must not change")


def check_instruction(src, out, path, rep):
    same_except({k: v for k, v in src.items() if k != "explanation"},
                {k: v for k, v in out.items() if k != "explanation"},
                {"title"}, path, rep)
    se, oe = src.get("explanation", []), out.get("explanation", [])
    if len(se) != len(oe):
        rep.err(f"{path}.explanation: length {len(se)} -> {len(oe)}")
        return
    for e, (s, o) in enumerate(zip(se, oe)):
        p = f"{path}.explanation[{e}]"
        allowed = {"content"} if s.get("type") == "text" else set()
        same_except({k: v for k, v in s.items() if k != "annotations"},
                    {k: v for k, v in o.items() if k != "annotations"}, allowed, p, rep)
        sa, oa = s.get("annotations") or [], o.get("annotations") or []
        if ("annotations" in s) != ("annotations" in o) or len(sa) != len(oa):
            rep.err(f"{p}.annotations: count or presence changed")
            continue
        for j, (x, y) in enumerate(zip(sa, oa)):
            same_except(x, y, {"text"}, f"{p}.annotations[{j}]", rep)


def check_mission(src, out, path, rep, allow_extra=()):
    keys_s = set(src) | set(allow_extra)
    if set(out) - keys_s or set(src) - set(out) - {"isExample"}:
        rep.err(f"{path}: keys differ from mission (got {sorted(out)})")
    for k in src:
        if k in ("title", "description", "instructions") or k not in out:
            continue
        if src[k] != out[k]:
            rep.err(f"{path}.{k}: must equal mission.{k}")
    si, oi = src.get("instructions", []), out.get("instructions", [])
    if len(si) != len(oi):
        rep.err(f"{path}.instructions: length {len(si)} -> {len(oi)}")
        return
    for i, (a, b) in enumerate(zip(si, oi)):
        if len(a) != len(b) or a[0] != b[0]:
            rep.err(f"{path}.instructions[{i}]: id/order changed ({a[0]} -> {b[0]})")
        elif len(a) > 1 and (a[1] is None) != (b[1] is None):
            rep.err(f"{path}.instructions[{i}] ({a[0]}): empty/non-empty changed")


NUM_LINE = re.compile(r"^\s*(\d+)[.)]", re.M)
NUM_ANY = re.compile(r"\d+(?:[.,]\d+)?")


def text_checks(addr, src_text, new_text, rep, keep, hebrew):
    side = "he" if hebrew else "en"
    if not isinstance(new_text, str):
        return
    if NUM_LINE.findall(src_text) != NUM_LINE.findall(new_text):
        rep.err(f"[{side}] {addr}: list numbering changed")
    if sorted(NUM_ANY.findall(src_text)) != sorted(NUM_ANY.findall(new_text)):
        rep.warn(f"[{side}] {addr}: numbers differ {sorted(NUM_ANY.findall(src_text))} -> {sorted(NUM_ANY.findall(new_text))}")
    if "\\n" in new_text:
        rep.err(f"[{side}] {addr}: contains a literal backslash-n; use a real newline (\\n in JSON)")
    if new_text.count("**") % 2 or new_text.count("`") % 2:
        rep.warn(f"[{side}] {addr}: unbalanced ** or ` markers")
    if hebrew:
        if HEB.search(src_text) is None and re.search(r"[A-Za-z]{3,}", src_text) and not HEB.search(new_text):
            rep.warn(f"[he] {addr}: no Hebrew letters - not translated?")
        for w in keep:
            if re.search(rf"(?<![A-Za-z]){re.escape(w)}(?![A-Za-z])", src_text, re.I) and \
               not re.search(rf"(?<![A-Za-z]){re.escape(w)}(?![A-Za-z])", new_text, re.I):
                rep.err(f"[he] {addr}: keep-English word '{w}' missing from the Hebrew text")


def get_at(bundle, addr, he):
    tmp = {}
    mt = ADDR.match(addr)
    mkey, midx, iid, ititle, eidx, econt, aidx = mt.groups()
    mission = bundle.get("missionHe" if he else "mission", {})
    instrs = by_id(bundle.get("instructionsHe" if he else "instructionsEn", []))
    try:
        if mkey:
            return mission.get(mkey)
        if midx is not None:
            return mission["instructions"][int(midx)][1]
        ins = instrs[iid]
        if ititle:
            return ins.get("title")
        ent = ins["explanation"][int(eidx)]
        return ent.get("content") if econt else ent["annotations"][int(aidx)].get("text")
    except (KeyError, IndexError, TypeError):
        return tmp.get("missing")


def validate(src, out, keep):
    rep = Report()
    for k in ("exportedAt", "mission", "missionHe", "instructionsEn", "instructionsHe"):
        if k in src and k not in out:
            rep.err(f"top-level '{k}' missing")
    for k in ("missionHe", "instructionsHe"):
        if k not in out:
            rep.err(f"top-level '{k}' missing")
    if set(out) - set(src) - {"missionHe", "instructionsHe"}:
        rep.err(f"unexpected top-level keys {sorted(set(out)-set(src))}")
    if src.get("exportedAt") != out.get("exportedAt"):
        rep.err("exportedAt must not change")
    if rep.errors:
        return rep

    # mission (EN) vs input mission
    check_mission(src["mission"], out["mission"], "mission", rep)
    # missionHe vs output mission (copy, translated)
    check_mission(out["mission"], out["missionHe"], "missionHe", rep)

    # instructionsEn vs input
    s_ids = [str(i.get("id")) for i in src["instructionsEn"]]
    o_ids = [str(i.get("id")) for i in out["instructionsEn"]]
    if s_ids != o_ids:
        rep.err(f"instructionsEn: ids/order changed {s_ids} -> {o_ids}")
    else:
        for s, o in zip(src["instructionsEn"], out["instructionsEn"]):
            check_instruction(s, o, f"instructionsEn[{s.get('id')}]", rep)
    # instructionsHe vs output instructionsEn
    h_ids = [str(i.get("id")) for i in out["instructionsHe"]]
    if h_ids != o_ids:
        rep.err(f"instructionsHe: ids/order must match instructionsEn {o_ids}, got {h_ids}")
    else:
        for s, o in zip(out["instructionsEn"], out["instructionsHe"]):
            check_instruction(s, o, f"instructionsHe[{s.get('id')}]", rep)

    if rep.errors:
        return rep
    # text-level checks
    changed = 0
    for addr, en_src in editable(src):
        en_new = get_at(out, addr, he=False)
        he_new = get_at(out, addr, he=True)
        if en_new != en_src:
            changed += 1
        text_checks(addr, en_src, en_new, rep, keep, hebrew=False)
        text_checks(addr, en_new or "", he_new, rep, keep, hebrew=True)
    rep.changed = changed
    return rep


def print_report(rep, total):
    for w in rep.warnings:
        print("WARNING:", w)
    for e in rep.errors:
        print("ERROR:  ", e)
    status = "FAILED" if rep.errors else "OK"
    print(f"\n{status}: {len(rep.errors)} error(s), {len(rep.warnings)} warning(s); "
          f"{getattr(rep, 'changed', 0)} of {total} English strings reworded.")


def parse_keep(argv):
    keep = []
    if "--keep" in argv:
        i = argv.index("--keep")
        keep, argv = argv[i + 1:], argv[:i]
    return argv, keep


# ---------------------------------------------------------------- commands
def cmd_strings(inp, outp):
    src = load(inp)
    save({"en": dict(editable(src)), "he": {}}, outp)
    print(f"{len(dict(editable(src)))} editable strings written to {outp}")


def cmd_build(inp, edits_path, outp, keep):
    src = load(inp)
    edits = load(edits_path)
    out = copy.deepcopy(src)
    known = dict(editable(src))
    for addr in list(edits.get("en", {})) + list(edits.get("he", {})):
        if addr not in known:
            raise SystemExit(f"ERROR: unknown address in edits: {addr}")
    for addr, text in edits.get("en", {}).items():
        set_at(out, addr, text, he=False)
    # Hebrew copies are made AFTER the English edits, then translated
    out["missionHe"] = copy.deepcopy(out["mission"])
    out["instructionsHe"] = copy.deepcopy(out["instructionsEn"])
    missing = [a for a in known if a not in edits.get("he", {})]
    for addr, text in edits.get("he", {}).items():
        set_at(out, addr, text, he=True)
    # keep the original top-level key order
    ordered = {k: out[k] for k in src if k in out}
    for k in ("missionHe", "instructionsHe"):
        ordered.setdefault(k, out[k])
    save(ordered, outp)
    print(f"Built {outp}")
    if missing:
        print(f"WARNING: {len(missing)} string(s) have no Hebrew translation:", *missing, sep="\n  ")
    rep = validate(src, ordered, keep)
    print_report(rep, len(known))
    return 1 if rep.errors else 0


def cmd_images(inp, folder):
    src = load(inp)
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    index, fetched, failed = [], {}, 0
    for ins in src.get("instructionsEn", []):
        iid = str(ins.get("id"))
        for e, ent in enumerate(ins.get("explanation", [])):
            if ent.get("type") != "image" or not isinstance(ent.get("content"), str):
                continue
            url = ent["content"].strip()
            entry = {
                "instruction": iid,
                "title": ins.get("title"),
                "explanation": e,
                "file": None,
                "annotations": [
                    {k: a.get(k) for k in ("label", "text", "x", "y", "width", "height", "isRedaction") if k in a}
                    for a in ent.get("annotations", []) or []
                ],
            }
            parts = urllib.parse.urlsplit(url)
            if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS or PUBLIC_PATH not in parts.path:
                entry["error"] = "skipped: not a public GoalWay storage URL"
                index.append(entry)
                failed += 1
                continue
            if url in fetched:
                entry["file"] = fetched[url]
                index.append(entry)
                continue
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "goalway-repolish"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    ctype = resp.headers.get_content_type()
                    if ctype not in IMAGE_TYPES:
                        raise ValueError(f"not an image ({ctype})")
                    data = resp.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise ValueError("image larger than 15 MB")
                name = f"instr-{re.sub(r'[^A-Za-z0-9_-]', '_', iid)}_{e}{IMAGE_TYPES[ctype]}"
                (folder / name).write_bytes(data)
                fetched[url] = entry["file"] = name
            except Exception as exc:  # network, HTTP or content errors: report, continue
                entry["error"] = f"download failed: {exc}"
                failed += 1
            index.append(entry)
    save(index, folder / "images.json")
    print(f"{len(fetched)} image(s) saved in {folder}; {failed} skipped or failed; index: {folder / 'images.json'}")
    for entry in index:
        if entry.get("error"):
            print(f"  instr {entry['instruction']} explanation[{entry['explanation']}]: {entry['error']}")
    return 0


def cmd_validate(inp, outp, keep):
    src, out = load(inp), load(outp)
    rep = validate(src, out, keep)
    print_report(rep, len(dict(editable(src))))
    return 1 if rep.errors else 0


def main(argv):
    # Windows consoles may not support every character; never crash on printing.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    argv, extra = parse_keep(argv)
    keep = keep_words(extra)
    if len(argv) >= 3 and argv[0] == "strings":
        cmd_strings(argv[1], argv[2]); return 0
    if len(argv) >= 4 and argv[0] == "build":
        return cmd_build(argv[1], argv[2], argv[3], keep)
    if len(argv) >= 3 and argv[0] == "images":
        return cmd_images(argv[1], argv[2])
    if len(argv) >= 3 and argv[0] == "validate":
        return cmd_validate(argv[1], argv[2], keep)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
