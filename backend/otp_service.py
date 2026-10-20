"""
otp_service.py — Cart pickup OTP helpers for CartMate

- OTPs are 6 digits generated with the `secrets` module (cryptographically secure).
- The OTP is stored ENCRYPTED (cryptography.Fernet) so the same code can be shown in the customer's
  app and on the cart's OLED display. Key: env OTP_ENC_KEY (a Fernet key).
  If OTP_ENC_KEY is missing, a development key is generated once and kept in instance/otp_dev.key
  so OTPs survive restarts / the debug reloader. Set OTP_ENC_KEY in production.
- Comparison uses hmac.compare_digest. The plain OTP is never logged.
"""

import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

OTP_LENGTH = 6
OTP_TTL_HOURS = float(os.environ.get('OTP_TTL_HOURS', '24'))
OTP_MAX_ATTEMPTS = int(os.environ.get('OTP_MAX_ATTEMPTS', '3'))

DEV_KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'otp_dev.key')

_fernet = None


class OtpDecryptError(Exception):
    """The stored OTP cannot be decrypted (e.g. OTP_ENC_KEY changed)."""


def _load_dev_key() -> bytes:
    if os.path.isfile(DEV_KEY_PATH):
        with open(DEV_KEY_PATH, 'rb') as f:
            return f.read().strip()
    key = Fernet.generate_key()
    os.makedirs(os.path.dirname(DEV_KEY_PATH), exist_ok=True)
    with open(DEV_KEY_PATH, 'wb') as f:
        f.write(key)
    return key


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = os.environ.get('OTP_ENC_KEY')
        if not key:
            logger.warning("[CartMate OTP] OTP_ENC_KEY is not set; using a generated development key "
                           f"stored in {DEV_KEY_PATH}. Set OTP_ENC_KEY in production.")
            key = _load_dev_key()
        _fernet = Fernet(key)
    return _fernet


def generate_otp() -> str:
    """Return a zero-padded 6-digit OTP, e.g. '048213'."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def encrypt_otp(otp: str) -> str:
    return _get_fernet().encrypt(otp.encode('utf-8')).decode('ascii')


def decrypt_otp(token: str) -> str:
    try:
        return _get_fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError, AttributeError) as e:
        raise OtpDecryptError("Stored OTP cannot be decrypted (was OTP_ENC_KEY changed?)") from e


def otp_matches(candidate: str, encrypted: str) -> bool:
    """Constant-time comparison of a submitted OTP with the stored (encrypted) one."""
    if not candidate or not encrypted:
        return False
    return hmac.compare_digest(candidate.encode('utf-8'), decrypt_otp(encrypted).encode('utf-8'))


def otp_expiry_from(now: datetime = None) -> datetime:
    return (now or datetime.now(timezone.utc)) + timedelta(hours=OTP_TTL_HOURS)
