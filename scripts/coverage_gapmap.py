#!/usr/bin/env python3
"""Regenerate the headless coverage gap map from both vitest v8 reports.

Reads overture-ui/coverage + web/coverage (produce them with `mise run cover`)
and prints a markdown gap map to stdout: per-module unit% (mock-deps tier),
behavior% (real ui.js + seq8-wasm tier), and union% (covered by either), plus
totals. Keeps docs/COVERAGE-GAP-MAP.md honest instead of letting a hand-edited
snapshot rot.

Usage:  mise run gap-map            # or: python3 scripts/coverage_gapmap.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI_PATH = os.path.join(ROOT, "overture-ui/coverage/coverage-final.json")
WEB_PATH = os.path.join(ROOT, "web/coverage/coverage-final.json")


def load(path):
    if not os.path.exists(path):
        sys.exit(f"missing {path} — run `mise run cover` first")
    return json.load(open(path))


def rel(p):
    return p.split("/overture-ui/ui/")[-1]


def covered(fc):
    s = fc["s"]
    return sum(1 for v in s.values() if v > 0), len(s)


def main():
    ui, web = load(UI_PATH), load(WEB_PATH)
    paths = sorted(set(ui) | set(web), key=rel)
    rows = []
    u_c = u_t = w_c = w_t = un_c = un_t = 0
    for p in paths:
        uc, ut = covered(ui[p]) if p in ui else (0, 0)
        wc, wt = covered(web[p]) if p in web else (0, 0)
        ids = set(ui[p]["s"]) if p in ui else set()
        ids |= set(web[p]["s"]) if p in web else set()
        unc = sum(
            1
            for i in ids
            if (p in ui and ui[p]["s"].get(i, 0) > 0)
            or (p in web and web[p]["s"].get(i, 0) > 0)
        )
        u_c, u_t, w_c, w_t, un_c, un_t = (
            u_c + uc, u_t + ut, w_c + wc, w_t + wt, un_c + unc, un_t + len(ids),
        )
        rows.append((rel(p), uc, ut, wc, wt, unc, len(ids)))

    def pct(c, t):
        return f"{100 * c / t:.0f}" if t else "-"

    print(f"**Unit** {100*u_c/u_t:.1f}% · **Behavior** {100*w_c/w_t:.1f}% · "
          f"**Union** {100*un_c/un_t:.1f}%  ({un_c}/{un_t} statements)\n")
    print("| Module | Unit% | Behavior% | Union% |")
    print("|---|---|---|---|")
    for name, uc, ut, wc, wt, unc, unt in sorted(rows, key=lambda r: 100 * r[5] / r[6] if r[6] else 100):
        print(f"| {name} | {pct(uc, ut)} | {pct(wc, wt)} | {pct(unc, unt)} |")


if __name__ == "__main__":
    main()
