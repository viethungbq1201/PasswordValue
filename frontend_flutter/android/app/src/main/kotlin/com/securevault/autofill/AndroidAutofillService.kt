package com.securevault.autofill

import android.app.assist.AssistStructure
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * SecureVault Android Autofill Service.
 *
 * Supports both:
 * - Web login forms (extracts web domain from AssistStructure)
 * - Native mobile applications (extracts app package name)
 *
 * Requires registration in AndroidManifest.xml and a FlutterEngine instance
 * to communicate with Dart's AutofillService via MethodChannel.
 */
class AndroidAutofillService : AutofillService() {

    private val CHANNEL = "com.securevault/autofill"
    private var flutterEngine: FlutterEngine? = null

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        val structure = request.fillContexts.lastOrNull()?.structure
        if (structure == null) {
            callback.onSuccess(null)
            return
        }

        // Extract domain from web view OR app package name
        val identifiers = extractIdentifiers(structure)
        val domain = identifiers.first  // Web domain or package name
        val fullUrl = identifiers.second // Full URL if available

        // Find username/password autofill IDs in the view structure
        val autofillFields = parseStructure(structure)
        if (autofillFields.usernameId == null && autofillFields.passwordId == null) {
            callback.onSuccess(null)
            return
        }

        // Query Flutter Engine for matching credentials
        flutterEngine?.let { engine ->
            val methodChannel = MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL)
            val args = mutableMapOf<String, Any>("domain" to domain)
            if (fullUrl.isNotEmpty()) args["fullUrl"] = fullUrl

            methodChannel.invokeMethod("getMatchingCredentials", args, object : MethodChannel.Result {
                override fun success(result: Any?) {
                    val credentials = result as? List<Map<String, String>> ?: emptyList()
                    if (credentials.isEmpty()) {
                        callback.onSuccess(null)
                        return
                    }

                    val responseBuilder = FillResponse.Builder()
                    for (cred in credentials) {
                        val username = cred["username"] ?: ""
                        val password = cred["password"] ?: ""
                        val name = cred["name"] ?: domain

                        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
                        presentation.setTextViewText(android.R.id.text1, "$name ($username)")

                        val datasetBuilder = Dataset.Builder(presentation)
                        autofillFields.usernameId?.let {
                            datasetBuilder.setValue(it, AutofillValue.forText(username))
                        }
                        autofillFields.passwordId?.let {
                            datasetBuilder.setValue(it, AutofillValue.forText(password))
                        }
                        responseBuilder.addDataset(datasetBuilder.build())
                    }

                    callback.onSuccess(responseBuilder.build())
                }

                override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {
                    callback.onSuccess(null)
                }

                override fun notImplemented() {
                    callback.onSuccess(null)
                }
            })
        } ?: run {
            callback.onSuccess(null)
        }
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val structure = request.fillContexts.lastOrNull()?.structure
        if (structure == null) {
            callback.onSuccess()
            return
        }

        val identifiers = extractIdentifiers(structure)
        val autofillFields = parseStructure(structure)

        flutterEngine?.let { engine ->
            val methodChannel = MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL)
            methodChannel.invokeMethod("saveCredential", mapOf(
                "domain" to identifiers.first,
                "username" to (autofillFields.usernameValue ?: ""),
                "password" to (autofillFields.passwordValue ?: "")
            ))
        }
        callback.onSuccess()
    }

    /**
     * Extract web domain and full URL from AssistStructure.
     * Returns Pair(domain, fullUrl).
     * Falls back to app package name if no web domain found.
     */
    private fun extractIdentifiers(structure: AssistStructure): Pair<String, String> {
        var webDomain = ""
        var fullUrl = ""

        for (i in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            val viewNode = windowNode.rootViewNode
            extractFromViewNode(viewNode)?.let { (domain, url) ->
                webDomain = domain
                fullUrl = url
            }
        }

        // Fallback to package name for native apps
        if (webDomain.isEmpty()) {
            webDomain = structure.activityComponent?.packageName ?: ""
        }

        return Pair(webDomain, fullUrl)
    }

    private fun extractFromViewNode(node: android.app.assist.AssistStructure.ViewNode?): Pair<String, String>? {
        if (node == null) return null

        node.webDomain?.let { domain ->
            if (domain.isNotEmpty()) {
                return Pair(domain, node.text?.toString() ?: "")
            }
        }

        for (i in 0 until node.childCount) {
            extractFromViewNode(node.getChildAt(i))?.let { return it }
        }
        return null
    }

    data class AutofillFields(
        val usernameId: AutofillId? = null,
        val passwordId: AutofillId? = null,
        val usernameValue: String? = null,
        val passwordValue: String? = null
    )

    private fun parseStructure(structure: AssistStructure): AutofillFields {
        var usernameId: AutofillId? = null
        var passwordId: AutofillId? = null
        var usernameValue: String? = null
        var passwordValue: String? = null

        for (i in 0 until structure.windowNodeCount) {
            val viewNode = structure.getWindowNodeAt(i).rootViewNode
            parseViewNode(viewNode) { hints, id, value ->
                if (hints.any { it.contains("username", true) || it.contains("email", true) }) {
                    usernameId = id
                    usernameValue = value
                } else if (hints.any { it.contains("password", true) }) {
                    passwordId = id
                    passwordValue = value
                }
            }
        }

        return AutofillFields(usernameId, passwordId, usernameValue, passwordValue)
    }

    private fun parseViewNode(
        node: android.app.assist.AssistStructure.ViewNode?,
        callback: (List<String>, AutofillId, String?) -> Unit
    ) {
        if (node == null) return

        val hints = node.autofillHints?.toList() ?: emptyList()
        val id = node.autofillId

        if (hints.isNotEmpty() && id != null) {
            callback(hints, id, node.text?.toString())
        }

        for (i in 0 until node.childCount) {
            parseViewNode(node.getChildAt(i), callback)
        }
    }
}
