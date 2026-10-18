#!/usr/bin/env python3
"""Extract the original MirrorView baseline from its Markdown handover.
Python 3 standard library only. Run in the receiving coding environment:
  python3 extract_mirrorview.py MirrorView-Opus-Rebuild-and-Integrate.md --output mirrorview-handoff
No ZIP, network, dependencies, credentials, or installation steps are used.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

PAYLOADS = {'baseline/index.html': {'bytes': 572966, 'sha256': '9229eb1ccf5560e942391b23bc1f08f9bc5cbbf3f8463a5241df8f2dd4cc9867'}, 'baseline/README.md': {'bytes': 7965, 'sha256': '1bf2e130933410d023fede7d60e7a11d2ce1aac22f398d62894f0adaaf7a3428'}, 'baseline/TESTING.md': {'bytes': 4833, 'sha256': '0a7fd858cec59ebc7af8d02839a91668d171d9e90154f460001ad794139133f5'}, 'handoff/inspection.json': {'bytes': 2992, 'sha256': '343c664b5fc7e072aedaf58d4ed911a8a764f14ba994a861f7ab3641f8bf3da1'}}
FENCE = b"`" * 8

def extract(document: Path, output: Path) -> list[Path]:
    data = document.read_bytes()
    verified: list[tuple[Path, bytes]] = []
    for name, expected in PAYLOADS.items():
        # Concatenation avoids confusing this script with a payload marker.
        begin = b"<!-- MV_PAYLOAD_" + b"BEGIN: " + name.encode("utf-8") + b" -->\n"
        end = b"\n" + FENCE + b"\n<!-- MV_PAYLOAD_" + b"END: " + name.encode("utf-8") + b" -->"
        if data.count(begin) != 1:
            raise ValueError(f"Missing or duplicate payload: {name}; request the original attachment.")
        fence_at = data.index(begin) + len(begin)
        fence_end = data.find(b"\n", fence_at)
        if fence_end < 0 or not data[fence_at:fence_end].startswith(FENCE):
            raise ValueError(f"Missing payload opening fence: {name}")
        start = fence_end + 1
        stop = start + expected["bytes"]
        raw = data[start:stop]
        if len(raw) != expected["bytes"] or hashlib.sha256(raw).hexdigest() != expected["sha256"]:
            raise ValueError(f"Checksum failed: {name}; do not reconstruct from a truncated block.")
        if data[stop:stop + len(end)] != end:
            raise ValueError(f"Missing payload ending: {name}")
        destination = output / name
        resolved_root = output.resolve()
        if resolved_root not in destination.resolve().parents:
            raise ValueError("Destination escapes the chosen extraction directory.")
        if destination.exists() and (not destination.is_file() or destination.read_bytes() != raw):
            raise FileExistsError(f"Refusing to overwrite a different existing file: {destination}")
        verified.append((destination, raw))
    # Nothing is written until every payload and existing destination passes validation.
    for destination, raw in verified:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            with destination.open("xb") as handle:
                handle.write(raw)
    return [path for path, _ in verified]

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", type=Path, help="The complete handover Markdown attachment")
    parser.add_argument("--output", type=Path, default=Path("mirrorview-handoff"))
    args = parser.parse_args()
    try:
        paths = extract(args.document, args.output)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"Extraction stopped: {exc}\n")
    print("Verified and extracted the supplied baseline; this is not a host integration or deployment.")
    for path in paths:
        print(path)

if __name__ == "__main__":
    main()

