import csv
import xml.etree.ElementTree as ET
from pathlib import Path
from src.utils.constants import MOMO_KEYWORDS

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]

XML_FILE = BASE_DIR / "data" / "sms-20261003215510.xml"
OUTPUT_FILE = BASE_DIR / "data" / "momo_sms.csv"


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def is_momo_message(sender: str, body: str) -> bool:
    """
    Determine whether an SMS is likely to be a Mobile Money
    transaction based on its sender and message content.
    """

    text = f"{sender} {body}".lower()

    return any(keyword in text for keyword in MOMO_KEYWORDS)


def get_attribute(message, attribute_name: str) -> str:
    """
    Safely retrieve an attribute from an XML SMS element.
    """
    return message.attrib.get(attribute_name, "").strip()


# ---------------------------------------------------------
# Main filtering function
# ---------------------------------------------------------

def filter_momo_sms():
    if not XML_FILE.exists():
        raise FileNotFoundError(
            f"XML file not found: {XML_FILE}"
        )

    print(f"Reading XML file:")
    print(f"  {XML_FILE}")

    tree = ET.parse(XML_FILE)
    root = tree.getroot()

    total_messages = 0
    momo_messages = 0

    rows = []

    # SMS Backup & Restore normally stores messages as:
    #
    # <sms
    #     address="..."
    #     date="..."
    #     body="..."
    #     ...
    # />

    for message in root.findall(".//sms"):
        total_messages += 1

        sender = get_attribute(message, "address")
        body = get_attribute(message, "body")
        timestamp = get_attribute(message, "date")

        if not body:
            continue

        if is_momo_message(sender, body):
            momo_messages += 1

            rows.append({
                "raw_text": body,
                "sender": sender,
                "received_at": timestamp,
            })

    # -----------------------------------------------------
    # Write CSV
    # -----------------------------------------------------

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8",
    ) as csv_file:

        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "raw_text",
                "sender",
                "received_at",
            ],
        )

        writer.writeheader()
        writer.writerows(rows)

    # -----------------------------------------------------
    # Summary
    # -----------------------------------------------------

    print()
    print("Filtering complete!")
    print("-------------------")
    print(f"Total SMS messages: {total_messages}")
    print(f"MoMo messages:      {momo_messages}")
    print(f"Output file:        {OUTPUT_FILE}")


if __name__ == "__main__":
    filter_momo_sms()