import json, os, glob

def iter_runs(input_path):
    paths = []
    if os.path.isdir(input_path):
        paths = glob.glob(os.path.join(input_path, "**", "*.json"), recursive=True)
    else:
        paths = [input_path]
    for p in paths:
        try:
            with open(p, "r", encoding="utf-8") as f:
                yield p, json.load(f)
        except Exception:
            continue

def get_value(d, dotted_key, default=None):
    cur = d
    for part in dotted_key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur
