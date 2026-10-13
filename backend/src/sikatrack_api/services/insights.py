"""Short, ready-to-show cards, written from the same numbers as the summaries (the dashboards'
insight measures, in sentences)."""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api.schemas.reads import Insight, InsightList
from sikatrack_api.services import recurring, summaries, warehouse
from sikatrack_api.services.transactions import TX
from sikatrack_api.services.warehouse import DateRange

SPENDING_UP = 0.20  # warn when spending is this much above the previous period


async def insights(session: AsyncSession, user_id: uuid.UUID, period: DateRange) -> InsightList:
    summary = await summaries.summary(session, user_id, period, provider=None)
    cards: list[Insight] = []

    change = summary.compare.money_out_change
    if change is not None and change > SPENDING_UP:
        cards.append(Insight(
            id="spending_up", severity="warning",
            title=f"Spending is up {change:.0%}",
            body=f"GHS {summary.money_out:,.0f} so far, against GHS {summary.compare.money_out:,.0f} "
                 "in the same number of days before.",
            link="sikatrack://summary",
        ))  # fmt: skip

    await warehouse.scope(session, user_id)
    fees = (
        await session.execute(
            text(f"""{TX} SELECT COALESCE(sum(total_cost), 0) AS fees,
                     COALESCE(sum(total_cost) FILTER (WHERE transaction_type = 'cashout'), 0) AS cashout
                     FROM txc WHERE date BETWEEN :start AND :end"""),
            {"uid": user_id, "start": period.start, "end": period.end},
        )
    ).one()
    if fees.fees > 0 and fees.cashout / fees.fees >= 0.5:
        cards.append(Insight(
            id="fees_cashout", severity="tip",
            title="Cash-outs cost you the most",
            body=f"{fees.cashout / fees.fees:.0%} of your fees come from cash-outs. "
                 "Paying merchants directly avoids them.",
            link="sikatrack://fees",
        ))  # fmt: skip

    if summary.top_category is not None:
        cards.append(Insight(
            id="top_category", severity="info",
            title=f"{summary.top_category.name} leads",
            body=f"{summary.top_category.share:.0%} of your spending in this period.",
            link=f"sikatrack://categories/{summary.top_category.id}",
        ))  # fmt: skip

    active = await recurring.list_series(session, user_id, status="active")
    if active.items:
        count = len(active.items)
        cards.append(Insight(
            id="recurring", severity="info",
            title=f"{count} recurring payment{'s' if count != 1 else ''}",
            body=f"Still active, costing about GHS {active.monthly_cost:,.0f} a month.",
            link="sikatrack://recurring",
        ))  # fmt: skip
    return InsightList(items=cards)
