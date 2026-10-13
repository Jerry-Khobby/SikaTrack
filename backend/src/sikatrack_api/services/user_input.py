"""The user's own changes on top of the pipeline's results.

Each change shows at once (the read queries apply it) and is also handed to the pipeline on
its next run (scheduled here), so the warehouse and the dashboards agree with the app.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import ids
from sikatrack_api.config import Settings
from sikatrack_api.errors import AppError
from sikatrack_api.models import CategoryOverride, CounterpartyPreference, RecurringPreference, User
from sikatrack_api.schemas.reads import Counterparty, RecurringSeries, TransactionDetail
from sikatrack_api.schemas.user_input import CounterpartyPatch, RecurringPatch, TransactionPatch
from sikatrack_api.services import catalog, pipeline, recurring, transactions, warehouse


async def selectable_category(session: AsyncSession, slug: str, field: str) -> str:
    """The category's name for an id the user may choose, or a validation error."""
    names = await transactions.category_names(session, [slug])
    if not names or names[0] in warehouse.NOT_SELECTABLE:
        raise warehouse.bad_request(field, f"'{slug}' isn't a category you can choose")
    return names[0]


async def correct_transaction(
    session: AsyncSession, settings: Settings, user: User, public_id: str, patch: TransactionPatch
) -> TransactionDetail:
    current = await transactions.get_transaction(session, user.id, public_id)  # 404 if not theirs
    nk = warehouse.transaction_nk(public_id)
    override = await session.get(CategoryOverride, (user.id, nk))
    if override is None:
        override = CategoryOverride(user_id=user.id, transaction_nk=nk)
        session.add(override)
    if "category" in patch.model_fields_set:
        override.category_name = (
            await selectable_category(session, patch.category, "category") if patch.category else None
        )
    if "note" in patch.model_fields_set:
        override.note = patch.note
    if patch.apply_to_counterparty:
        if current.counterparty is None or override.category_name is None:
            raise warehouse.bad_request("apply_to_counterparty", "Needs a counterparty and a category")
        name = warehouse.counterparty_name(current.counterparty.id)
        preference = await _preference(session, user.id, name)
        preference.default_category = override.category_name
    if override.category_name is None and override.note is None:
        await session.delete(override)  # nothing left to remember
    pipeline.mark_due(user, settings.pipeline_debounce_s)
    await session.commit()
    return await transactions.get_transaction(session, user.id, public_id)


async def _preference(session: AsyncSession, user_id: uuid.UUID, name: str) -> CounterpartyPreference:
    preference = await session.get(CounterpartyPreference, (user_id, name))
    if preference is None:
        preference = CounterpartyPreference(user_id=user_id, counterparty_name=name)
        session.add(preference)
    return preference


async def update_counterparty(
    session: AsyncSession, settings: Settings, user: User, public_id: str, patch: CounterpartyPatch
) -> Counterparty:
    name = warehouse.counterparty_name(public_id)
    if await catalog.counterparty(session, user.id, name) is None:
        raise ids.not_found()
    preference = await _preference(session, user.id, name)
    if "alias" in patch.model_fields_set:
        preference.alias = patch.alias
    if "default_category" in patch.model_fields_set:
        preference.default_category = (
            await selectable_category(session, patch.default_category, "default_category")
            if patch.default_category
            else None
        )
        pipeline.mark_due(user, settings.pipeline_debounce_s)
    await session.commit()
    found = await catalog.counterparty(session, user.id, name)
    if found is None:  # pragma: no cover - checked above, in the same request
        raise ids.not_found()
    return found


async def update_recurring(
    session: AsyncSession, user: User, public_id: str, patch: RecurringPatch
) -> RecurringSeries:
    await recurring.get_series(session, user.id, public_id)  # 404 if not theirs
    series = warehouse.recurring_series(public_id)
    preference = await session.get(RecurringPreference, (user.id, series))
    if preference is None:
        preference = RecurringPreference(user_id=user.id, recurring_series=series)
        session.add(preference)
    if "user_state" in patch.model_fields_set:
        preference.user_state = patch.user_state
    if "label" in patch.model_fields_set:
        preference.label = patch.label
    await session.commit()
    return await recurring.get_series(session, user.id, public_id)


def unknown_category(slug: str) -> AppError:
    return AppError(404, "not_found", "Not found", f"No category '{slug}'.")
