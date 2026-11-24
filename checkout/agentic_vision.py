"""Local OCR research: screen recognition is never financial proof."""
import io
import re
import subprocess
from decimal import Decimal
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 4 * 1024 * 1024
MAX_PIXELS = 12_000_000
SUCCESS = re.compile(r"^(?:payment|transaction)\s+successful[!.]?$|^paid successfully[!.]?$", re.I)
NEGATIVE = re.compile(r"\b(?:failed|cancelled|canceled|declined|unsuccessful|not successful|not paid|pending|processing|in progress|reversed|refunded)\b", re.I)
AMOUNT = re.compile(r"(?<!\w)(?:₹|INR\b|Rs\.?)\s*([0-9]{1,9}(?:\.[0-9]{1,2})?)(?![\d.,])", re.I)

def classify_text(text, expected_minor):
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    amounts = {int(Decimal(x) * 100) for x in AMOUNT.findall(text)}
    recognized = next((line for line in lines if SUCCESS.fullmatch(line)), None)
    if NEGATIVE.search(text):
        decision = "NOT_SUCCESS"
    elif not recognized:
        decision = "UNKNOWN"
    elif amounts != {expected_minor}:
        decision = "AMOUNT_UNCONFIRMED"
    else:
        decision = "VISUAL_SUCCESS"
    return {"decision": decision, "advance_research": decision == "VISUAL_SUCCESS",
            "financially_verified": False, "checkout_changed": False}

def analyze_image(data, expected_minor):
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Invalid image size")
    try:
        with Image.open(io.BytesIO(data)) as original:
            if original.format not in {"PNG", "JPEG", "WEBP"} or original.width * original.height > MAX_PIXELS:
                raise ValueError("Unsupported image")
            if getattr(original, "n_frames", 1) != 1:
                raise ValueError("Animated images unsupported")
            image = ImageOps.exif_transpose(original).convert("L")
            image.thumbnail((1800, 2400))
            image = ImageOps.autocontrast(image)
            png = io.BytesIO()
            image.save(png, format="PNG")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid image") from exc
    proc = subprocess.run(["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "11"],
                          input=png.getvalue(), stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, timeout=10, check=True)
    return classify_text(proc.stdout.decode("utf-8", errors="replace"), expected_minor)
