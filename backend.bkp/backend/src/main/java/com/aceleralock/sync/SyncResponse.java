package com.aceleralock.sync;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record SyncResponse(
        long syncVersion,
        Instant serverTime,
        int failsafeDays,
        List<TargetView> targets,
        List<ProfileView> profiles,
        List<GrantView> activeGrants,
        List<PendingUnlockView> pendingUnlockRequests) {

    public record TargetView(UUID targetId, String label) {
    }

    public record ProfileView(UUID profileId, String name, boolean enabled, String timeZone,
                              int cooldownMinutes, Integer pendingCooldownMinutes, Instant cooldownEffectiveAt,
                              List<WindowView> windows, List<UUID> targetIds) {
    }

    public record WindowView(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
    }

    public record GrantView(UUID targetId, UUID requestId, Instant grantEndsAt, boolean grantedUnilaterally) {
    }

    public record PendingUnlockView(UUID requestId, UUID targetId, String status, Instant cooldownEndsAt,
                                    Instant unilateralEndsAt, Instant approvedAt) {
    }
}
