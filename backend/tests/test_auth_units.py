"""Phone numbers, codes and tokens, without a database."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from sikatrack_api.auth import credentials
from sikatrack_api.auth.phone import InvalidPhoneNumber, mask, normalise_gh_mobile
from sikatrack_api.config import Settings


@pytest.mark.parametrize(
    "raw",
    ["0241234567", "024 123 4567", "024-123-4567", "233241234567", "+233241234567", "+233 (24) 123 4567"],
)
def test_ghanaian_numbers_normalise_to_one_form(raw: str) -> None:
    assert normalise_gh_mobile(raw) == "+233241234567"


@pytest.mark.parametrize("raw", ["024123456", "02412345678", "0311234567", "+44241234567", "024abc4567", ""])
def test_other_input_is_refused(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumber):
        normalise_gh_mobile(raw)


def test_masking_keeps_the_network_and_last_two_digits() -> None:
    assert mask("+233241234567") == "+23324*****67"


def test_codes_are_six_digits() -> None:
    codes = {credentials.new_code() for _ in range(200)}
    assert all(len(c) == 6 and c.isdigit() for c in codes)
    assert len(codes) > 150  # random, not repeating


def test_a_code_only_matches_its_own_request(settings: Settings) -> None:
    first, second = uuid.uuid4(), uuid.uuid4()
    stored = credentials.hash_code(settings, first, "123456")

    assert credentials.code_matches(settings, first, "123456", stored)
    assert not credentials.code_matches(settings, first, "123457", stored)
    assert not credentials.code_matches(settings, second, "123456", stored)


def test_code_hashes_depend_on_the_server_pepper(settings: Settings) -> None:
    other = settings.model_copy(update={"otp_pepper": settings.otp_pepper.__class__("x" * 40)})
    request = uuid.uuid4()

    assert credentials.hash_code(settings, request, "123456") != credentials.hash_code(
        other, request, "123456"
    )


def test_access_tokens_round_trip(settings: Settings) -> None:
    claims = credentials.AccessClaims(uuid.uuid4(), uuid.uuid4())
    token = credentials.new_access_token(settings, claims, datetime.now(UTC))

    assert credentials.read_access_token(settings, token, datetime.now(UTC)) == claims


def test_expired_access_tokens_are_refused(settings: Settings) -> None:
    claims = credentials.AccessClaims(uuid.uuid4(), uuid.uuid4())
    token = credentials.new_access_token(settings, claims, datetime.now(UTC) - timedelta(hours=1))

    with pytest.raises(jwt.ExpiredSignatureError):
        credentials.read_access_token(settings, token, datetime.now(UTC))


def test_tokens_signed_with_another_key_or_algorithm_are_refused(settings: Settings) -> None:
    claims = {
        "iss": "sikatrack-api",
        "sub": str(uuid.uuid4()),
        "sid": str(uuid.uuid4()),
        "iat": 0,
        "exp": 2**31,
    }
    forged = jwt.encode(claims, "some-other-secret-that-is-long-enough!!", algorithm="HS256")
    unsigned = jwt.encode(claims, None, algorithm="none")

    for token in (forged, unsigned):
        with pytest.raises(jwt.InvalidTokenError):
            credentials.read_access_token(settings, token, datetime.now(UTC))


def test_refresh_tokens_are_random_and_hashed() -> None:
    token = credentials.new_refresh_token()

    assert token.startswith("rt_")
    assert len(token) > 40
    assert credentials.hash_refresh_token(token) != token
    assert credentials.new_refresh_token() != token
