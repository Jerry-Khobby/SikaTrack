"""The user's own changes: corrected categories, nicknames, recurring decisions, budgets."""

from fastapi import APIRouter, Response, status

from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep, SettingsDep
from sikatrack_api.schemas.reads import Counterparty, RecurringSeries, TransactionDetail
from sikatrack_api.schemas.user_input import (
    BudgetList,
    BudgetOut,
    BudgetPut,
    CounterpartyPatch,
    RecurringPatch,
    TransactionPatch,
)
from sikatrack_api.services import budgets, user_input

router = APIRouter(prefix="/v1")


@router.patch(
    "/transactions/{transaction_id}",
    tags=["transactions"],
    summary="Correct the category or add a note",
    description="Shows at once in the app, and in the warehouse and dashboards after the next run.",
)
async def patch_transaction(
    transaction_id: str,
    body: TransactionPatch,
    me: CurrentUserDep,
    session: SessionDep,
    settings: SettingsDep,
) -> TransactionDetail:
    return await user_input.correct_transaction(session, settings, me.user, transaction_id, body)


@router.patch(
    "/counterparties/{counterparty_id}", tags=["counterparties"], summary="Nickname or default category"
)
async def patch_counterparty(
    counterparty_id: str,
    body: CounterpartyPatch,
    me: CurrentUserDep,
    session: SessionDep,
    settings: SettingsDep,
) -> Counterparty:
    return await user_input.update_counterparty(session, settings, me.user, counterparty_id, body)


@router.patch(
    "/recurring/{recurring_id}", tags=["recurring"], summary="Mark as expected, to cancel, or a false match"
)
async def patch_recurring(
    recurring_id: str, body: RecurringPatch, me: CurrentUserDep, session: SessionDep
) -> RecurringSeries:
    return await user_input.update_recurring(session, me.user, recurring_id, body)


@router.get("/budgets", tags=["budgets"], summary="Your budgets, with this month's spending")
async def get_budgets(me: CurrentUserDep, session: SessionDep, month: str | None = None) -> BudgetList:
    return await budgets.list_budgets(session, me.id, budgets.month_of(month))


@router.put("/budgets/{category_id}", tags=["budgets"], summary="Set a category's monthly limit")
async def put_budget(category_id: str, body: BudgetPut, me: CurrentUserDep, session: SessionDep) -> BudgetOut:
    return await budgets.put_budget(session, me.id, category_id, body)


@router.delete("/budgets/{category_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["budgets"])
async def delete_budget(category_id: str, me: CurrentUserDep, session: SessionDep) -> Response:
    await budgets.delete_budget(session, me.id, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
