import os
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
    """Run Dolphin on a receipt image/PDF and return the markdown it produces."""
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
        return (Path(out_dir) / "markdown" / f"{path.stem}.md").read_text(encoding="utf-8")
