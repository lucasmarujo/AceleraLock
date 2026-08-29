package com.aceleralock.blocker

import com.aceleralock.blocker.core.ActiveGrant
import com.aceleralock.blocker.core.BlockProfile
import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.BlockWindow
import com.aceleralock.blocker.core.TokenPair
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

data class SyncResult(
    val policy: BlockPolicy,
    val serverTime: Instant,
    val failsafeDays: Int,
    val syncVersion: Long,
    val notModified: Boolean
)

/**
 * Cliente HTTP do backend. Quem chama e o servico nativo, nao o JavaScript — o JS
 * esta morto enquanto o app esta fechado, que e o estado normal deste produto.
 */
class BackendClient(private val baseUrl: String) {

    private val http = OkHttpClient.Builder()
        .callTimeout(Duration.ofSeconds(20))
        .build()

    private var etag: String? = null

    fun refresh(refreshToken: String): TokenPair {
        val body = JSONObject().put("refreshToken", refreshToken).toString()
        val request = Request.Builder()
            .url("$baseUrl/v1/auth/refresh")
            .post(body.toRequestBody(JSON))
            .build()
        http.newCall(request).execute().use { response ->
            val payload = JSONObject(response.body?.string().orEmpty())
            if (!response.isSuccessful) {
                throw BackendException("refresh recusado: ${response.code}")
            }
            return TokenPair(
                accessToken = payload.getString("accessToken"),
                accessExpiresAt = Instant.now().plusSeconds(payload.getLong("expiresIn")),
                refreshToken = payload.getString("refreshToken")
            )
        }
    }

    /**
     * 304 conta como sync completo: significa que falamos com o servidor e o
     * relogio veio no header. E so isso que reancora o tempo e zera o contador
     * de failsafe.
     */
    fun sync(deviceId: String, accessToken: String, deviceTime: Instant): SyncResult {
        val builder = Request.Builder()
            .url("$baseUrl/v1/devices/$deviceId/sync")
            .header("Authorization", "Bearer $accessToken")
            .header(HEADER_DEVICE_TIME, deviceTime.toString())
        etag?.let { builder.header("If-None-Match", it) }

        http.newCall(builder.build()).execute().use { response ->
            val serverTime = response.header(HEADER_SERVER_TIME)?.let(Instant::parse)
                ?: throw BackendException("resposta sem $HEADER_SERVER_TIME")

            if (response.code == 304) {
                return SyncResult(BlockPolicy(), serverTime, 0, 0, notModified = true)
            }
            if (!response.isSuccessful) {
                throw BackendException("sync falhou: ${response.code}")
            }
            response.header("ETag")?.let { etag = it }
            val payload = JSONObject(response.body?.string().orEmpty())
            return SyncResult(
                policy = parsePolicy(payload),
                serverTime = serverTime,
                failsafeDays = payload.optInt("failsafeDays", 0),
                syncVersion = payload.optLong("syncVersion", 0L),
                notModified = false
            )
        }
    }

    private fun parsePolicy(payload: JSONObject): BlockPolicy {
        val targetLabels = mutableMapOf<String, String>()
        val targets = payload.optJSONArray("targets")
        if (targets != null) {
            for (index in 0 until targets.length()) {
                val target = targets.getJSONObject(index)
                targetLabels[target.getString("targetId")] = target.optString("label", "")
            }
        }

        val profiles = mutableListOf<BlockProfile>()
        val profilesJson = payload.optJSONArray("profiles")
        if (profilesJson != null) {
            for (index in 0 until profilesJson.length()) {
                val profile = profilesJson.getJSONObject(index)
                profiles += BlockProfile(
                    profileId = profile.getString("profileId"),
                    enabled = profile.optBoolean("enabled", true),
                    zone = ZoneId.of(profile.getString("timeZone")),
                    windows = parseWindows(profile),
                    targetPackages = parseTargetPackages(profile)
                )
            }
        }

        val grants = mutableListOf<ActiveGrant>()
        val grantsJson = payload.optJSONArray("activeGrants")
        if (grantsJson != null) {
            for (index in 0 until grantsJson.length()) {
                val grant = grantsJson.getJSONObject(index)
                grants += ActiveGrant(
                    packageName = LocalTargetMap.packageFor(grant.getString("targetId")),
                    grantEndsAt = Instant.parse(grant.getString("grantEndsAt"))
                )
            }
        }
        return BlockPolicy(profiles, grants)
    }

    private fun parseWindows(profile: JSONObject): List<BlockWindow> {
        val windows = mutableListOf<BlockWindow>()
        val array = profile.optJSONArray("windows") ?: return windows
        for (index in 0 until array.length()) {
            val window = array.getJSONObject(index)
            windows += BlockWindow(
                dayOfWeek = DayOfWeek.valueOf(window.getString("dayOfWeek")),
                startTime = LocalTime.parse(window.getString("startTime")),
                endTime = LocalTime.parse(window.getString("endTime"))
            )
        }
        return windows
    }

    private fun parseTargetPackages(profile: JSONObject): Set<String> {
        val packages = mutableSetOf<String>()
        val array = profile.optJSONArray("targetIds") ?: return packages
        for (index in 0 until array.length()) {
            packages += LocalTargetMap.packageFor(array.getString(index))
        }
        return packages
    }

    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
        const val HEADER_SERVER_TIME = "X-Aceleralock-Server-Time"
        const val HEADER_DEVICE_TIME = "X-Aceleralock-Device-Time"
    }
}

class BackendException(message: String) : RuntimeException(message)
