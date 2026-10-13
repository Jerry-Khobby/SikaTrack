"""Per-user settings the pipeline reads from the backend's `app` schema.

An app user's own accounts (their wallets) decide which transfers are between their own
wallets, which OWNER_NAMES / OWNER_NUMBERS in .env did for the legacy owner.
"""

import logging

from src.transform.config import Owner, UserCategories

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def wallet_owner(user_id: str, dsn: str | None = None) -> Owner:
    """The user's wallets as an Owner. Empty if the backend's tables don't exist yet."""
    from src.load.warehouse import connect

    conn = connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT to_regclass('app.wallet') IS NOT NULL")
            if not cur.fetchone()[0]:
                log.warning("No app.wallet table: user %s has no wallets to match", user_id)
                return Owner()
            cur.execute("SELECT account_name, phone_number FROM app.wallet WHERE user_id = %s", (user_id,))
            rows = cur.fetchall()
    finally:
        conn.close()
    return Owner(
        names=frozenset(name for name, _ in rows if name),
        # Stored as +233XXXXXXXXX; the pipeline compares the local form 0XXXXXXXXX
        numbers=frozenset("0" + phone.removeprefix("+233") for _, phone in rows),
    )


def merge(*owners: Owner) -> Owner:
    return Owner(
        names=frozenset().union(*(o.names for o in owners)),
        numbers=frozenset().union(*(o.numbers for o in owners)),
    )


def user_categories(user_id: str, dsn: str | None = None) -> UserCategories:
    """The user's category corrections and counterparty defaults (empty before the backend exists)."""
    from src.load.warehouse import connect

    conn = connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT to_regclass('app.category_override') IS NOT NULL")
            if not cur.fetchone()[0]:
                return UserCategories()
            cur.execute("""SELECT transaction_nk, category_name FROM app.category_override
                           WHERE user_id = %s AND category_name IS NOT NULL""", (user_id,))
            overrides = dict(cur.fetchall())
            cur.execute("""SELECT counterparty_name, default_category FROM app.counterparty_preference
                           WHERE user_id = %s AND default_category IS NOT NULL""", (user_id,))
            defaults = dict(cur.fetchall())
    finally:
        conn.close()
    return UserCategories(overrides=overrides, counterparty_defaults=defaults)

