package com.aceleralock.auth;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;
import java.util.UUID;

public record AuthenticatedCaller(UUID accountId, UUID deviceId) {

    public static AuthenticatedCaller from(Jwt jwt) {
        UUID accountId = UUID.fromString(jwt.getSubject());
        UUID deviceId = Optional.ofNullable(jwt.getClaimAsString(TokenIssuer.CLAIM_DEVICE_ID))
                .map(UUID::fromString)
                .orElse(null);
        return new AuthenticatedCaller(accountId, deviceId);
    }
}
