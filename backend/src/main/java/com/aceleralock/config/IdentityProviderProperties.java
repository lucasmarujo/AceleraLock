package com.aceleralock.config;

import com.aceleralock.auth.IdentityProvider;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Map;

@ConfigurationProperties(prefix = "aceleralock.auth")
public record IdentityProviderProperties(
        Map<IdentityProvider, ProviderSettings> providers,
        Duration bootstrapTokenTtl,
        Duration accessTokenTtl,
        Duration refreshTokenTtl) {

    public IdentityProviderProperties {
        providers = providers == null ? Map.of() : providers;
        bootstrapTokenTtl = bootstrapTokenTtl == null ? Duration.ofMinutes(5) : bootstrapTokenTtl;
        accessTokenTtl = accessTokenTtl == null ? Duration.ofMinutes(15) : accessTokenTtl;
        refreshTokenTtl = refreshTokenTtl == null ? Duration.ofDays(60) : refreshTokenTtl;
    }

    public record ProviderSettings(String issuer, String jwkSetUri, String audience) {
    }
}
