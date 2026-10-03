#!/usr/bin/env python3
"""Generate a reviewable static Russian catalogue from public UI source strings.

The translation service is used only while preparing this committed catalogue;
the deployed app never calls it. Run extract-ui-strings.mjs first.
"""
import concurrent.futures
import json
import subprocess
from pathlib import Path

source = Path("apps/web/src/locales/en-extracted.json")
target = Path("apps/web/src/locales/ru.json")
items = json.loads(source.read_text())
separator = "\n⟦◇⟧\n"

chunks = []
current = []
for item in items:
    if current and len(separator.join(current)) + len(item) > 2600:
        chunks.append(current)
        current = []
    current.append(item)
if current:
    chunks.append(current)


def translate(chunk):
    command = [
        "curl", "-fsS", "--retry", "3", "--retry-delay", "1", "--max-time", "35", "-G",
        "https://translate.googleapis.com/translate_a/single",
        "--data-urlencode", "client=gtx", "--data-urlencode", "sl=en",
        "--data-urlencode", "tl=ru", "--data-urlencode", "dt=t",
        "--data-urlencode", "q=" + separator.join(chunk),
    ]
    response = json.loads(subprocess.check_output(command))
    translated = "".join(part[0] for part in response[0]).strip().split(separator)
    if len(translated) != len(chunk):
        if len(chunk) == 1:
            return {chunk[0]: chunk[0]}
        mid = len(chunk) // 2
        return translate(chunk[:mid]) | translate(chunk[mid:])
    return {english: russian.strip() for english, russian in zip(chunk, translated)}


existing = json.loads(target.read_text()) if target.exists() else {}
pending = [[item for item in chunk if item not in existing] for chunk in chunks]
pending = [chunk for chunk in pending if chunk]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for index, part in enumerate(executor.map(translate, pending), 1):
        existing.update(part)
        if index % 10 == 0 or index == len(pending):
            target.write_text(json.dumps(dict(sorted(existing.items())), ensure_ascii=False, indent=2) + "\n")
            print(f"Translated {len(existing)} strings ({index}/{len(pending)} batches)", flush=True)
