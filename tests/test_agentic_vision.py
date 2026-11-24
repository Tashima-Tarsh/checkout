import io
import shutil
import pytest
from PIL import Image, ImageDraw, ImageFont
from checkout.agentic_vision import analyze_image, classify_text

@pytest.mark.parametrize("text,expected,decision", [
    ("Payment Successful\nINR 1.00",100,"VISUAL_SUCCESS"),
    ("Payment Failed\nINR 1.00",100,"NOT_SUCCESS"),
    ("Payment Successful\nINR 2.00",100,"AMOUNT_UNCONFIRMED"),
    ("Payment Successful\nINR 1.00\nINR 2.00",100,"AMOUNT_UNCONFIRMED"),
    ("Payment Successful\nINR 1.00\nPayment pending",100,"NOT_SUCCESS"),
    ("Payment Successful\n1",100,"AMOUNT_UNCONFIRMED"),
    ("INR 1.00",100,"UNKNOWN"),
    ("Payment not successful\nINR 1.00",100,"NOT_SUCCESS"),
])
def test_gate(text, expected, decision):
    result = classify_text(text, expected)
    assert result["decision"] == decision
    assert result["advance_research"] == (decision == "VISUAL_SUCCESS")
    assert result["financially_verified"] is False
    assert result["checkout_changed"] is False
    if decision == "AMOUNT_UNCONFIRMED":
        assert result["visual_status"] == "SUCCESS_RECOGNIZED"

def test_invalid_image():
    with pytest.raises(ValueError):
        analyze_image(b"not an image", 100)

@pytest.mark.skipif(shutil.which("tesseract") is None, reason="OCR executable not installed")
@pytest.mark.parametrize("status,expected", [("Payment Successful","VISUAL_SUCCESS"),("Payment Failed","NOT_SUCCESS")])
def test_real_ocr(status, expected):
    image = Image.new("RGB",(900,500),"white")
    font = ImageFont.truetype("DejaVuSans.ttf", 48)
    draw = ImageDraw.Draw(image)
    draw.text((60,80),status,font=font,fill="black")
    draw.text((60,175),"INR 1.00",font=font,fill="black")
    stream = io.BytesIO()
    image.save(stream,format="PNG")
    result = analyze_image(stream.getvalue(),100)
    assert result["decision"] == expected
    assert result["financially_verified"] is False

@pytest.mark.skipif(shutil.which("tesseract") is None, reason="OCR executable not installed")
def test_rupee_glyph_uncertainty_does_not_hide_success_heading():
    image = Image.new("RGB",(900,500),"white")
    font = ImageFont.truetype("DejaVuSans.ttf",48)
    draw = ImageDraw.Draw(image)
    draw.text((60,80),"Payment Successful",font=font,fill="black")
    draw.text((60,175),"₹1.00",font=font,fill="black")
    stream = io.BytesIO()
    image.save(stream,format="PNG")
    result = analyze_image(stream.getvalue(),100)
    assert result["visual_status"] == "SUCCESS_RECOGNIZED"
    assert result["decision"] in {"VISUAL_SUCCESS","AMOUNT_UNCONFIRMED"}
    assert result["financially_verified"] is False


@pytest.mark.parametrize("tail,decision", [
    ("Paid to: fixture@example\nUPI Ref No: 123456789012", "VISUAL_SUCCESS"),
    ("Paid to: other@example\nUPI Ref No: 123456789012", "RECIPIENT_UNCONFIRMED"),
    ("Paid from: fixture@example\nUPI Ref No: 123456789012", "RECIPIENT_UNCONFIRMED"),
    ("Paid to: fixture@example\nPaid to: other@example\nUTR: 123456789012", "RECIPIENT_UNCONFIRMED"),
    ("Paid to: fixture@example\nUTR: 12345678901", "REFERENCE_UNCONFIRMED"),
    ("Paid to: fixture@example\nUTR: 123456789012\nRRN: 999999999999", "REFERENCE_UNCONFIRMED"),
    ("Paid to:\nfixture@example\nRRN:\n123456789012", "VISUAL_SUCCESS"),
])
def test_strict_receipt_fields(tail, decision):
    from checkout.agentic_vision import match_receipt
    result = match_receipt("Payment Successful\nINR 1.00\n" + tail,100,"fixture@example")
    assert result["decision"] == decision
    assert result["financially_verified"] is False
    assert ("reference_digest" in result) == (decision == "VISUAL_SUCCESS")
