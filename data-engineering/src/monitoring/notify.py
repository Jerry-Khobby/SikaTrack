"""Send alert emails over SMTP (Gmail by default). Everything is configured in .env:

    EMAIL_USER        sender account, e.g. you@gmail.com
    EMAIL_PASS        a Gmail app password (spaces are fine; Google shows it in groups of 4)
    ALERT_EMAIL_TO    recipients, comma-separated (default: EMAIL_USER)
    SMTP_HOST / SMTP_PORT   default smtp.gmail.com / 587 (STARTTLS)
    ALERTS_ENABLED    false to stop all emails (they're logged instead)
"""

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def alerts_enabled() -> bool:
    return os.getenv("ALERTS_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")


def recipients() -> list[str]:
    raw = os.getenv("ALERT_EMAIL_TO") or os.getenv("EMAIL_USER", "")
    return [a.strip() for a in raw.split(",") if a.strip()]


def send_email(subject: str, body: str) -> bool:
    """Send a plain-text email. Returns False (and logs) when alerts are switched off."""
    subject = f"[SikaTrack] {subject}"
    if not alerts_enabled():
        log.info("ALERTS_ENABLED is off; not sending: %s", subject)
        return False

    user = os.getenv("EMAIL_USER", "").strip()
    password = os.getenv("EMAIL_PASS", "").replace(" ", "")
    to = recipients()
    if not (user and password and to):
        raise RuntimeError("Set EMAIL_USER and EMAIL_PASS (and optionally ALERT_EMAIL_TO) in .env")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = user
    message["To"] = ", ".join(to)
    message.set_content(body)

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(user, password)
        smtp.send_message(message)
    log.info("Sent email to %d recipient(s): %s", len(to), subject)
    return True
