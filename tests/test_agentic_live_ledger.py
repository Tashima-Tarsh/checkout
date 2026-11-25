import pytest

from checkout.agentic_vision import observe_live_text


def test_live_observation_contains_only_required_transient_fields():
    result = observe_live_text(
        "Payment Successful\nINR 100.37\nPaid to: merchant@example\n"
        "UPI Ref No: 123456789012\nPayer name: Not Retained\nRemarks: Not Retained"
    )
    assert result == {
        "sensitive_content": False,
        "success": True,
        "amount_minor": 10037,
        "payee": "merchant@example",
        "reference": "123456789012",
    }
    assert "text" not in result and "payer_name" not in result and "remarks" not in result


@pytest.mark.parametrize("text", [
    "Payment Successful\nINR 100.37\nUPI PIN: 1234",
    "Payment Successful\nINR 100.37\nOTP: 123456",
    "Payment Successful\nINR 100.37\nAvailable balance: INR 900.00",
    "Payment Successful\nINR 100.37\nAccount number: 12345678901234",
    "Payment Successful\nINR 100.37\nCard: 1234567890123456",
])
def test_sensitive_content_is_rejected_before_settlement(text):
    assert observe_live_text(text) == {"sensitive_content": True}


def test_masked_last4_is_ignored_not_extracted():
    result = observe_live_text(
        "Payment Successful\nINR 100.37\nPaid to: merchant@example\n"
        "UPI Ref No: 123456789012\nAccount XXXXXXXX1234"
    )
    assert result["sensitive_content"] is False
    assert set(result) == {"sensitive_content", "success", "amount_minor", "payee", "reference"}
    assert "1234" not in str(result.get("account", ""))


def test_uncertain_success_amount_payee_and_reference_fail_closed():
    multiple = observe_live_text(
        "Payment Successful\nINR 100.37\nINR 900.00\nPaid to: merchant@example\n"
        "Paid to: other@example\nUTR: 123456789012\nRRN: 123456789013"
    )
    assert multiple["amount_minor"] is None
    assert multiple["payee"] is None
    assert multiple["reference"] is None
    assert observe_live_text("Payment pending\nINR 100.37")["success"] is False
