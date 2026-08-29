package com.aceleralock.blocker.core

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

data class BlockWindow(val dayOfWeek: DayOfWeek, val startTime: LocalTime, val endTime: LocalTime) {

    fun wrapsMidnight(): Boolean = endTime.isBefore(startTime)

    fun covers(instant: Instant, zone: ZoneId): Boolean {
        val zoned = instant.atZone(zone)
        val time = zoned.toLocalTime()
        if (startTime == endTime) {
            return zoned.dayOfWeek == dayOfWeek
        }
        if (wrapsMidnight()) {
            if (zoned.dayOfWeek == dayOfWeek && !time.isBefore(startTime)) {
                return true
            }
            return zoned.dayOfWeek == dayOfWeek.plus(1) && time.isBefore(endTime)
        }
        return zoned.dayOfWeek == dayOfWeek && !time.isBefore(startTime) && time.isBefore(endTime)
    }
}

data class BlockProfile(
    val profileId: String,
    val enabled: Boolean,
    val zone: ZoneId,
    val windows: List<BlockWindow>,
    val targetPackages: Set<String>
) {
    fun isActiveAt(instant: Instant): Boolean = enabled && windows.any { it.covers(instant, zone) }
}

data class ActiveGrant(val packageName: String, val grantEndsAt: Instant)

data class BlockPolicy(
    val profiles: List<BlockProfile> = emptyList(),
    val grants: List<ActiveGrant> = emptyList()
) {
    fun allTargetPackages(): Set<String> = profiles.flatMap { it.targetPackages }.toSet()
}
