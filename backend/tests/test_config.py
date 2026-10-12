import pytest
from pydantic import ValidationError

from sikatrack_api.config import Settings
from sikatrack_api.main import create_app


def test_secrets_are_required(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("DATABASE_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None)  # type: ignore[call-arg]

    missing = {e["loc"][0] for e in exc.value.errors()}
    assert missing == {"database_password", "s3_access_key", "s3_secret_key"}


def test_secrets_never_print(settings: Settings) -> None:
    assert "unused" not in repr(settings)
    assert "unused" not in str(settings.database_url)  # SQLAlchemy masks the password too


def test_passwords_with_special_characters_need_no_escaping(settings: Settings) -> None:
    tricky = settings.model_copy(
        update={"database_password": settings.database_password.__class__("p@ss:w/rd#1")}
    )

    assert tricky.database_url.password == "p@ss:w/rd#1"


def test_api_docs_are_off_in_production(settings: Settings) -> None:
    production = settings.model_copy(update={"environment": "production"})

    app = create_app(production)

    assert app.docs_url is None
    assert app.openapi_url is None
