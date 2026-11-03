import html
import logging
import os
import re
import sys
import tempfile
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[3]
DOLPHIN_DIR = ROOT_DIR / "Dolphin"
MODEL_PATH = Path(os.getenv("DOLPHIN_MODEL_PATH", ROOT_DIR / "hf_model"))
MAX_BATCH_SIZE = 16

# One model instance can only run one job at a time; the same lock guards the one-time load
_dolphin_lock = threading.Lock()
_model = None
_dolphin = None  # the demo_page module


# going to load dolphin once and then keep it in memory, imported lazily so tests dont require torch.
def _load_model():
    """Call with _dolphin_lock held."""
    global _model, _dolphin

    if _model is not None:
        return _model, _dolphin

    # Dolphin isn't a package: demo_page.py does `from utils.utils import *`, so its folder must be importable
    if str(DOLPHIN_DIR) not in sys.path:
        sys.path.insert(0, str(DOLPHIN_DIR))
    import demo_page
    import torch

    model = demo_page.DOLPHIN(str(MODEL_PATH))  # loads on CPU in float32 when there's no CUDA

    # Dolphin only knows cuda/cpu; on Apple Silicon move it to the GPU (MPS)
    if model.device == "cpu" and torch.backends.mps.is_available():
        model.model.to("mps")
        model.device = "mps"

    logger.info("Dolphin loaded on %s", model.device)
    _model, _dolphin = model, demo_page
    return _model, _dolphin


def warm_up() -> None:
    """Load the model ahead of the first upload so that receipt doesn't pay for it."""
    try:
        with _dolphin_lock:
            _load_model()
    except Exception:
        logger.exception("Couldn't preload Dolphin; it will be retried on the first receipt")


def parse_document(path: Path) -> str:
    """Run Dolphin on a receipt image/PDF and return its text, one receipt line per line."""
    # Dolphin still writes figure crops (e.g. logos) and PDF results to disk, so give it a scratch folder
    with _dolphin_lock, tempfile.TemporaryDirectory() as out_dir:
        model, dolphin = _load_model()
        dolphin.setup_output_dirs(out_dir)
        _, results = dolphin.process_document(
            document_path=str(path.resolve()),
            model=model,
            save_dir=out_dir,
            max_batch_size=MAX_BATCH_SIZE,
        )

    # PDFs give a list of {"page_number", "elements"}; wrap them in the shape elements_to_text expects
    if path.suffix.lower() == ".pdf":
        return elements_to_text({"pages": results})
    return elements_to_text(results)


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
