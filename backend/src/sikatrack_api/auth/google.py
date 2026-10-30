"""Sign in with Google: checking the ID token the app gets from Google.

The app signs the user in with Google on the phone and sends the ID token here. It's a JWT that
Google signs with keys it publishes; the token is trusted only if its signature matches one of
those keys, it was issued by Google for one of our OAuth client IDs (GOOGLE_CLIENT_IDS), and it
hasn't expired. Its `sub` is the Google account's permanent ID, which the account is keyed on.
"""

import asyncio
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx2
import jwt

CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = frozenset({"accounts.google.com", "https://accounts.google.com"})
LEEWAY_S = 60  # clock differences between Google, the phone and this server
MIN_REFETCH_S = 60  # an unknown key ID refetches at most this often, so bad tokens can't hammer Google


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str | None  # only when Google says it's verified
    given_name: str | None


class InvalidGoogleToken(Exception):
    """Not a valid Google ID token for this app (bad signature, wrong audience, expired...)."""


class GoogleKeysUnavailable(Exception):
    """Google's public keys couldn't be fetched."""


class GoogleKeys:
    """Google's signing keys, cached for as long as Google's Cache-Control allows."""

    def __init__(self) -> None:
        self._keys: dict[str, jwt.PyJWK] = {}
        self._expires = 0.0
        self._fetched = 0.0
        self._lock = asyncio.Lock()

    async def get(self, kid: str) -> jwt.PyJWK:
        now = time.monotonic()
        stale = now >= self._expires
        unknown = kid not in self._keys and now - self._fetched >= MIN_REFETCH_S
        if stale or unknown:
            async with self._lock:
                if time.monotonic() >= self._expires or (kid not in self._keys and unknown):
                    await self._refresh()
        key = self._keys.get(kid)
        if key is None:
            raise InvalidGoogleToken("unknown signing key")
        return key

    async def _refresh(self) -> None:
        keys, max_age = await self._fetch()
        self._keys = {k["kid"]: jwt.PyJWK(k) for k in keys if "kid" in k}
        self._fetched = time.monotonic()
        self._expires = self._fetched + max_age

    async def _fetch(self) -> tuple[list[dict[str, Any]], float]:
        """Google's JWK set and how long to keep it (seconds)."""
        try:
            async with httpx2.AsyncClient(timeout=10) as client:
                response = await client.get(CERTS_URL)
                response.raise_for_status()
        except httpx2.HTTPError as exc:
            raise GoogleKeysUnavailable(type(exc).__name__) from exc
        match = re.search(r"max-age=(\d+)", response.headers.get("cache-control", ""))
        return response.json()["keys"], float(match.group(1)) if match else 3600.0


async def verify_id_token(token: str, audiences: tuple[str, ...], keys: GoogleKeys) -> GoogleIdentity:
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except jwt.PyJWTError as exc:
        raise InvalidGoogleToken("not a JWT") from exc
    if not isinstance(kid, str):
        raise InvalidGoogleToken("no key ID")
    key = await keys.get(kid)
    try:
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=list(audiences),
            leeway=LEEWAY_S,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidGoogleToken(type(exc).__name__) from exc
    if claims["iss"] not in ISSUERS:
        raise InvalidGoogleToken("not issued by Google")
    return GoogleIdentity(
        sub=str(claims["sub"]),
        email=claims.get("email") if claims.get("email_verified") is True else None,
        given_name=claims.get("given_name"),
    )
