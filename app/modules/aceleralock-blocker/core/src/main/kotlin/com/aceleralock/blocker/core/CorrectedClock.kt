package com.aceleralock.blocker.core

import java.time.Duration
import java.time.Instant

interface MonotonicClock {
    fun elapsedMillis(): Long
}

interface WallClock {
    fun nowMillis(): Long
}

data class ClockAnchor(val serverTime: Instant, val elapsedAtAnchor: Long)

sealed interface CorrectedTime {
    data class Anchored(val instant: Instant) : CorrectedTime

    data object Unanchored : CorrectedTime
}

class CorrectedClock(
    private val monotonic: MonotonicClock,
    private val wall: WallClock,
    private val skewThreshold: Duration = Duration.ofSeconds(60)
) {

    private var anchor: ClockAnchor? = null
    private var lastSkewSeconds: Long = 0

    fun anchorTo(serverTime: Instant): Long {
        val deviceNow = Instant.ofEpochMilli(wall.nowMillis())
        lastSkewSeconds = Duration.between(serverTime, deviceNow).seconds
        anchor = ClockAnchor(serverTime, monotonic.elapsedMillis())
        return lastSkewSeconds
    }

    fun dropAnchor() {
        anchor = null
    }

    fun isAnchored(): Boolean = anchor != null

    fun lastSkewSeconds(): Long = lastSkewSeconds

    fun isSkewSuspicious(): Boolean = Math.abs(lastSkewSeconds) > skewThreshold.seconds

    fun now(): CorrectedTime {
        val current = anchor ?: return CorrectedTime.Unanchored
        val elapsed = monotonic.elapsedMillis() - current.elapsedAtAnchor
        if (elapsed < 0) {
            return CorrectedTime.Unanchored
        }
        return CorrectedTime.Anchored(current.serverTime.plusMillis(elapsed))
    }
}
