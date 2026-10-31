import html
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
DOLPHIN_DIR = ROOT_DIR / "Dolphin"
MODEL_PATH = Path(os.getenv("DOLPHIN_MODEL_PATH", ROOT_DIR / "hf_model"))
TIMEOUT_SECONDS = 600

# Dolphin loads a multi-GB model per run, so only let one run at a time
_dolphin_lock = threading.Lock()


def parse_document(path: Path) -> str:
    """Run Dolphin on a receipt image/PDF and return its text, one receipt line per line."""
    with _dolphin_lock, tempfile.TemporaryDirectory() as out_dir:
        # Dolphin isn't a package, so run its script from its own folder (it imports `utils` relatively)
        subprocess.run(
            [
                sys.executable, "demo_page.py",
                "--model_path", str(MODEL_PATH),
                "--save_dir", out_dir,
                "--input_path", str(path.resolve()),
            ],
            cwd=DOLPHIN_DIR,
            check=True,
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
        )
        # Use the JSON rather than the markdown: the markdown converter flattens each block onto one line,
        # which throws away the line structure the extractor relies on
        json_path = Path(out_dir) / "recognition_json" / f"{path.stem}.json"
        return elements_to_text(json.loads(json_path.read_text(encoding="utf-8")))


def elements_to_text(data: list | dict) -> str:
    # Images give a list of elements; PDFs give {"pages": [{"elements": [...]}, ...]}
    if isinstance(data, dict):
        elements = [el for page in data.get("pages", []) for el in page.get("elements", [])]
    else:
        elements = sorted(data, key=lambda el: el.get("reading_order", 0))
    return "\n".join(_element_text(el) for el in elements if el.get("text"))


def _element_text(element: dict) -> str:
    text = element["text"]
    if element.get("label") == "tab" or "<tr" in text:
        # Tables come back as HTML; turn each row into one "cell cell cell" line
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.DOTALL)
        lines = [" ".join(re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.DOTALL)) for row in rows]
        return "\n".join(html.unescape(re.sub(r"<[^>]+>", "", line)).strip() for line in lines)
    return text
