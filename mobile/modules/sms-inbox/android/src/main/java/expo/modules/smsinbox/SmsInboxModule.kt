package expo.modules.smsinbox

import android.content.ContentResolver
import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the phone's SMS inbox, only messages from the given senders (the MoMo senders from
 * `GET /v1/config`), so no other SMS ever leaves Android's content provider. Needs READ_SMS.
 */
class SmsInboxModule : Module() {
  private val resolver: ContentResolver
    get() = (appContext.reactContext ?: throw Exceptions.ReactContextLost()).contentResolver

  override fun definition() = ModuleDefinition {
    Name("SmsInbox")

    /** How many messages from `senders` arrived after `sinceMs`, for the progress bar. */
    AsyncFunction("count") { senders: List<String>, sinceMs: Double ->
      if (senders.isEmpty()) return@AsyncFunction 0
      val (selection, args) = where(senders, sinceMs.toLong(), null, 0)
      resolver.query(Telephony.Sms.Inbox.CONTENT_URI, arrayOf(Telephony.Sms._ID), selection, args, null)
        ?.use { it.count } ?: 0
    }

    /**
     * Up to `limit` messages from `senders` after `sinceMs`, oldest first. For the next page,
     * pass the last message's `dateMs` and `id` as `afterDateMs` and `afterId`.
     */
    AsyncFunction("read") { senders: List<String>, sinceMs: Double, afterDateMs: String?, afterId: Double, limit: Int ->
      val messages = mutableListOf<Map<String, Any>>()
      if (senders.isEmpty() || limit <= 0) return@AsyncFunction messages
      val (selection, args) = where(senders, sinceMs.toLong(), afterDateMs?.toLong(), afterId.toLong())
      val projection = arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.DATE, Telephony.Sms.BODY)
      val order = "${Telephony.Sms.DATE} ASC, ${Telephony.Sms._ID} ASC"
      resolver.query(Telephony.Sms.Inbox.CONTENT_URI, projection, selection, args, order)?.use { cursor ->
        while (messages.size < limit && cursor.moveToNext()) {
          messages.add(
            mapOf(
              "id" to cursor.getLong(0).toDouble(),
              "sender" to (cursor.getString(1) ?: ""),
              // Android's `date` exactly, as digits: it's part of the message ID on the server.
              "dateMs" to cursor.getLong(2).toString(),
              "body" to (cursor.getString(3) ?: ""),
            )
          )
        }
      }
      messages
    }
  }

  /** `address IN (...) AND date > since`, plus the page boundary after (afterDate, afterId). */
  private fun where(senders: List<String>, sinceMs: Long, afterDateMs: Long?, afterId: Long): Pair<String, Array<String>> {
    val placeholders = senders.joinToString(",") { "?" }
    var selection = "${Telephony.Sms.ADDRESS} IN ($placeholders) AND ${Telephony.Sms.DATE} > ?"
    val args = senders.toMutableList().apply { add(sinceMs.toString()) }
    if (afterDateMs != null) {
      selection += " AND (${Telephony.Sms.DATE} > ? OR (${Telephony.Sms.DATE} = ? AND ${Telephony.Sms._ID} > ?))"
      args.addAll(listOf(afterDateMs.toString(), afterDateMs.toString(), afterId.toString()))
    }
    return selection to args.toTypedArray()
  }
}
