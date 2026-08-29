package com.aceleralock.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "aceleralock.unlock")
public record UnlockProperties(
        Duration unilateralCooldown,
        Duration grantDuration,
        Duration partnerMinAge,
        Duration inviteTtl,
        Duration clockSkewThreshold,
        Duration refreshGrace,
        int defaultCooldownMinutes,
        int maxDevicesPerAccount,
        int failsafeDays) {

    public UnlockProperties {
        unilateralCooldown = unilateralCooldown == null ? Duration.ofHours(48) : unilateralCooldown;
        grantDuration = grantDuration == null ? Duration.ofMinutes(15) : grantDuration;
        partnerMinAge = partnerMinAge == null ? Duration.ofHours(48) : partnerMinAge;
        inviteTtl = inviteTtl == null ? Duration.ofHours(24) : inviteTtl;
        clockSkewThreshold = clockSkewThreshold == null ? Duration.ofSeconds(60) : clockSkewThreshold;
        refreshGrace = refreshGrace == null ? Duration.ofSeconds(30) : refreshGrace;
        defaultCooldownMinutes = defaultCooldownMinutes == 0 ? 30 : defaultCooldownMinutes;
        maxDevicesPerAccount = maxDevicesPerAccount == 0 ? 3 : maxDevicesPerAccount;
        failsafeDays = failsafeDays == 0 ? 7 : failsafeDays;
    }
}
