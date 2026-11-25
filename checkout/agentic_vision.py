"""In-memory OCR with minimized live observations and no media retention."""
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
    visual_status = "NOT_SUCCESS" if NEGATIVE.search(text) else ("SUCCESS_RECOGNIZED" if recognized else "UNKNOWN")
    return {"decision": decision, "visual_status": visual_status,
            "advance_research": decision == "VISUAL_SUCCESS",
            "financially_verified": False, "checkout_changed": False}

# Conservative labeled fields only. No fuzzy recipient correction.
VPA_FIELD = re.compile(r"^(?:paid\s+to|sent\s+to|recipient(?:\s+upi\s+id)?|payee(?:\s+upi\s+id)?|to\s+upi\s+id)\s*:?\s*([a-z0-9._-]+@[a-z0-9._-]+)\s*$", re.I)
REF_FIELD = re.compile(r"^(?:upi\s+(?:ref(?:erence)?(?:\s+(?:no\.?|number))?|transaction\s+id)|rrn|utr(?:\s+(?:no\.?|number))?)\s*:?\s*([0-9]{12})\s*$", re.I)

def match_receipt(text, expected_minor, expected_vpa):
    result = classify_text(text, expected_minor)
    if result["decision"] != "VISUAL_SUCCESS":
        return result
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    # Support label/value on adjacent OCR lines; never infer from unlabeled IDs.
    candidates = lines + [a + " " + b for a, b in zip(lines, lines[1:])]
    recipients = {m.group(1).casefold() for line in candidates if (m := VPA_FIELD.fullmatch(line))}
    references = {m.group(1) for line in candidates if (m := REF_FIELD.fullmatch(line))}
    if not expected_vpa or recipients != {expected_vpa.casefold()}:
        return dict(result, decision="RECIPIENT_UNCONFIRMED", advance_research=False)
    if len(references) != 1:
        return dict(result, decision="REFERENCE_UNCONFIRMED", advance_research=False)
    # Internal-only reference fingerprint. Never returned from public endpoints.
    import hashlib
    reference_digest = hashlib.sha256(("visual-upi:" + next(iter(references))).encode("ascii")).hexdigest()
    return dict(result, reference_digest=reference_digest)

def _read_text(data):
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
    return proc.stdout.decode("utf-8", errors="replace")


def analyze_image(data, expected_minor, expected_vpa=None):
    text = _read_text(data)
    return classify_text(text, expected_minor) if expected_vpa is None else match_receipt(text, expected_minor, expected_vpa)


SECRET_LABEL = re.compile(r"\b(?:upi\s+pin|pin|otp|cvv|password)\b", re.I)
UNMASKED_ACCOUNT = re.compile(
    r"\b(?:account(?:\s+(?:number|no\.?))?|a/c|card(?:\s+number)?)\s*[:#-]?\s*[0-9]{9,18}\b",
    re.I,
)
BALANCE = re.compile(r"\b(?:available\s+)?balance\b", re.I)


def observe_live_text(text):
    """Return only fields needed for the current checkout; discard all other OCR."""
    if SECRET_LABEL.search(text) or UNMASKED_ACCOUNT.search(text) or BALANCE.search(text):
        return {"sensitive_content": True}
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    candidates = lines + [a + " " + b for a, b in zip(lines, lines[1:])]
    recipients = {m.group(1).casefold() for line in candidates if (m := VPA_FIELD.fullmatch(line))}
    references = {m.group(1) for line in candidates if (m := REF_FIELD.fullmatch(line))}
    amounts = {int(Decimal(value) * 100) for value in AMOUNT.findall(text)}
    recognized = any(SUCCESS.fullmatch(line) for line in lines)
    # Raw payee/reference values remain transient inputs to the server policy.
    # They are never included in an API response or written to storage.
    return {
        "sensitive_content": False,
        "success": recognized and not NEGATIVE.search(text),
        "amount_minor": next(iter(amounts)) if len(amounts) == 1 else None,
        "payee": next(iter(recipients)) if len(recipients) == 1 else None,
        "reference": next(iter(references)) if len(references) == 1 else None,
    }


def analyze_live_frame(data):
    """Analyze one live frame in memory. Neither the frame nor OCR text is stored."""
    return observe_live_text(_read_text(data))
