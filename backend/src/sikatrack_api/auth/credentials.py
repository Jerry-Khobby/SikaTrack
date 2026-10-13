"""One-time codes, refresh tokens and access tokens.

- Codes: 6 random digits, stored as HMAC-SHA256 keyed with OTP_PEPPER and bound to their
  request. A million possibilities is too few for a slow hash to help; the pepper (a server
  secret a database leak doesn't reveal), 5 attempts and a 5-minute expiry are what protect them.
- Refresh tokens: 256 random bits; stored as SHA-256 (enough for a value that can't be guessed).
- Access tokens: HS256 JWTs, 15 minutes, carrying the user (`sub`) and the session (`sid`).
"""

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt

from sikatrack_api.config import Settings

CODE_DIGITS = 6
REFRESH_PREFIX = "rt_"


def new_code() -> str:
    return f"{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}"


def hash_code(settings: Settings, request_id: uuid.UUID, code: str) -> str:
    key = settings.otp_pepper.get_secret_value().encode()
    return hmac.new(key, f"{request_id}:{code}".encode(), hashlib.sha256).hexdigest()


def code_matches(settings: Settings, request_id: uuid.UUID, code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(settings, request_id, code), stored_hash)  # constant time


def new_refresh_token() -> str:
    return REFRESH_PREFIX + secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID


def new_access_token(settings: Settings, claims: AccessClaims, now: datetime) -> str:
    payload = {
        "iss": settings.jwt_issuer,
        "sub": str(claims.user_id),
        "sid": str(claims.session_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.access_token_ttl_s)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm="HS256")


def read_access_token(settings: Settings, token: str, now: datetime) -> AccessClaims:
    """Raises jwt.InvalidTokenError for anything but a valid, unexpired token we issued.

    Expiry is checked against `now` (the API's clock), not PyJWT's own reading of the system
    clock, so every time decision in the API comes from one place.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=["HS256"],  # pinned: never trust the token's own "alg"
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "iat", "iss", "sub", "sid"], "verify_exp": False, "verify_iat": False},
    )
    if not isinstance(payload["exp"], int) or payload["exp"] <= now.timestamp():
        raise jwt.ExpiredSignatureError("token has expired")
    try:
        return AccessClaims(uuid.UUID(payload["sub"]), uuid.UUID(payload["sid"]))
    except (ValueError, TypeError) as exc:
        raise jwt.InvalidTokenError("malformed subject") from exc
