# SikaTrack — Data Collection Guide

**Scope:** getting real MoMo SMS off your phone, cleaning it, and handing it off to the data engineering layer in a format it can consume. This is the entry point of the whole pipeline — everything downstream depends on this being done carefully.

---

## 1. Goal of This Layer

Turn "SMS sitting on a phone" into "a file on disk with a defined structure, ready for parsing." Nothing in this layer does parsing or categorization — it only collects, filters, and sanitizes.

**Output of this layer:** a folder of raw SMS records (one file or one row per message) that the data engineering layer reads as its input. That's the contract between the two layers.

---

## 2. Step-by-Step: Getting Data Off Your Phone

1. **Install SMS Backup & Restore** (SyncTech, Play Store, free, no root required)
2. **Run a full local backup** — don't try to filter inside the app, it's unreliable. Back up everything.
3. **Export as XML**, choose local storage (not an automatic Drive backup you can't easily get a raw file from)
4. **Move the file to your laptop** — USB cable, email-to-self, or a file share. You now have your entire SMS history in one `.xml` file.

**Done when:** you have a single XML file on your laptop containing your full SMS history.

---

## 3. Filtering to MoMo-Only Messages

Write a small Python script (this can live in `/data-collection/filter_sms.py` in your repo) that:

1. Parses the XML using Python's built-in `xml.etree.ElementTree`
2. Checks each message's `address` field (the sender ID) against your actual MoMo sender names — open the raw XML and search for your real provider messages first to find the exact sender string(s) used (e.g., it might be `MTN Mobile Money`, `MMONEY`, or a numeric shortcode — check your own data, don't guess)
3. Keeps only matching messages, discards everything else
4. Writes the filtered result to `data/raw/momo_sms_raw.json`, one record per message:
   ```json
   {
     "raw_text": "You have received GHS 50.00 from...",
     "sender": "MTN Mobile Money",
     "received_at": "2026-08-14T09:32:00"
   }
   ```

**Done when:** `momo_sms_raw.json` contains only MoMo-related messages, nothing else.

---

## 4. Sanitization Checklist (before anything touches GitHub)

- [ ] Raw unfiltered SMS export is **never** committed to the repo — it contains OTPs, personal conversations, everything
- [ ] Even the filtered MoMo-only file should not go into a **public** repo with real phone numbers/names intact — either keep this repo private, or write a second sanitization pass that hashes/masks counterparty numbers and names before anything is shared publicly
- [ ] If you later collect SMS from friends/family for testing, get their explicit consent first, and sanitize their data the same way (or more strictly) than your own

---

## 5. Folder Structure

```
/data-collection
  filter_sms.py
  sanitize.py
/data
  /raw
    momo_sms_raw.json        ← filtered, unsanitized (private, local only)
  /labeled
    labeled_samples.json     ← hand-labeled subset for parser tests
  /sanitized
    momo_sms_sanitized.json  ← safe to reference in public repo/docs
```

---

## 6. Hand-Labeling a Test Set

Pick 20-30 messages covering every transaction type you actually receive (money received, money sent, airtime purchase, bill payment, cash-out). For each, manually write the correct structured output:

```json
{
  "raw_text": "You have received GHS 50.00 from Kojo Mensah. New balance: GHS 320.15",
  "expected": {
    "provider": "mtn_momo",
    "direction": "credit",
    "amount": 50.00,
    "counterparty": "Kojo Mensah",
    "transaction_type": "transfer",
    "balance_after": 320.15
  }
}
```

Save this as `data/labeled/labeled_samples.json`. **This file is the contract the data engineering layer's parser is built and tested against** — see the Data Engineering Layer doc.

---

## 7. Handoff to the Data Engineering Layer

What the next layer expects from you:
- `data/raw/momo_sms_raw.json` — as much real volume as possible, unlabeled is fine
- `data/labeled/labeled_samples.json` — smaller, hand-labeled, covers all transaction types

Once both exist, you're ready to start the Data Engineering Layer doc.

**Done when (full layer checklist):**
- [ ] Full SMS history exported from phone
- [ ] Filtered to MoMo-only messages
- [ ] Sanitization pass exists (even if not yet run on everything)
- [ ] At least 20-30 messages hand-labeled across all transaction types
- [ ] Folder structure in place in the repo
