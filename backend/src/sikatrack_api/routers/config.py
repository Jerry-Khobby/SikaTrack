"""/v1/config: what the app needs before and after sign-in. Public; cache for an hour."""

from fastapi import APIRouter, Depends, Response
from src.utils.constants import MOMO_SENDERS, SENDER_TO_PROVIDER

from sikatrack_api.auth.dependencies import SettingsDep
from sikatrack_api.ratelimit import limit_public
from sikatrack_api.schemas.ingestion import ConfigLimits, ConfigOut, ProviderInfo

router = APIRouter(prefix="/v1/config", tags=["config"], dependencies=[Depends(limit_public)])

# Every provider the app may show; `supported` = the parser has templates for its SMS
PROVIDER_NAMES = {
    "mtn_momo": "MTN MoMo",
    "ghanapay": "GhanaPay",
    "telecel_cash": "Telecel Cash",
    "airteltigo": "AirtelTigo Money",
}


@router.get("", summary="Sender allowlist, supported providers, limits")
async def get_config(response: Response, settings: SettingsDep) -> ConfigOut:
    response.headers["Cache-Control"] = "public, max-age=3600"
    senders_by_provider: dict[str, list[str]] = {}
    for sender in sorted(MOMO_SENDERS):
        provider = SENDER_TO_PROVIDER.get(sender.lower())
        if provider:
            senders_by_provider.setdefault(provider, []).append(sender)
    return ConfigOut(
        min_app_version=settings.min_app_version,
        # The source of truth is the pipeline's allowlist: adding a provider there starts
        # collecting its SMS with no app release
        momo_senders=sorted(MOMO_SENDERS),
        providers=[
            ProviderInfo(
                code=code,
                name=name,
                senders=senders_by_provider.get(code, []),
                supported=code in senders_by_provider,
            )
            for code, name in PROVIDER_NAMES.items()
        ],
        limits=ConfigLimits(
            sms_batch_max_messages=settings.sms_batch_max_messages,
            sms_batch_max_bytes=settings.sms_batch_max_bytes,
        ),
        features={"budgets": True, "export": False},
        # The parser reads Ghanaian MoMo SMS only; add a country once its providers parse
        supported_countries=["GH"],
    )
