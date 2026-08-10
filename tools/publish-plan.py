#!/usr/bin/env python3
"""Push a new block to the Worker. Run this after regenerating the meal plan.

    export LIST_URL=https://shopping-list-sync.you.workers.dev
    export LIST_KEY=...        # the shared list key
    export ADMIN_KEY=...       # the admin key
    python3 publish-plan.py plan.json

Every phone picks the new plan up on its next sync. Nothing gets reinstalled.
Ticks are cleared by default, because a new block's items are different items.
Pass --keep-ticks to leave them alone.
"""
import json, os, sys, urllib.request, urllib.error

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    path = args[0] if args else "plan.json"
    keep = "--keep-ticks" in sys.argv

    url = os.environ.get("LIST_URL", "").rstrip("/")
    lk, ak = os.environ.get("LIST_KEY", ""), os.environ.get("ADMIN_KEY", "")
    missing = [n for n, v in (("LIST_URL", url), ("LIST_KEY", lk), ("ADMIN_KEY", ak)) if not v]
    if missing:
        sys.exit("Missing environment variables: " + ", ".join(missing))

    payload = json.load(open(path, encoding="utf-8"))
    plan = payload.get("plan", payload)
    weeks = plan.get("weeks")
    if not isinstance(weeks, list) or not weeks:
        sys.exit(f"{path} does not look like a plan (no weeks array)")

    items = sum(len(s["items"]) for w in weeks
                for st in w["lists"].values() for s in st)
    total = sum(i["c"] for w in weeks for st in w["lists"].values()
                for s in st for i in s["items"])
    print(f"{path}: {len(weeks)} weeks, {items} items, ${total:.2f}")

    body = json.dumps({"plan": plan, "resetTicks": not keep}).encode()
    # Cloudflare's browser-integrity check answers urllib's default
    # "Python-urllib/3.x" with 403 error 1010 before the request ever reaches the
    # Worker, so send a normal browser User-Agent. This is not evasion: the
    # endpoint is ours and the admin key still authorises the write.
    req = urllib.request.Request(url + "/plan", data=body, method="PUT", headers={
        "Content-Type": "application/json", "X-List-Key": lk, "X-Admin-Key": ak,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.load(r)
        print(f"published \u2192 rev {out.get('rev')} at {out.get('updated')}")
        print("ticks " + ("kept" if keep else "cleared"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        if e.code == 403 and "1010" in detail:
            detail += "\n  (Cloudflare blocked the client signature, not your keys —"
            detail += " check the User-Agent header above.)"
        sys.exit(f"HTTP {e.code}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"could not reach {url}: {e.reason}")

if __name__ == "__main__":
    main()
