package com.aceleralock.auth;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountService;
import com.aceleralock.config.IdentityProviderProperties;
import com.aceleralock.device.Device;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private final IdentityTokenVerifier identityTokenVerifier;
    private final AccountService accountService;
    private final TokenIssuer tokenIssuer;
    private final RefreshTokenService refreshTokenService;
    private final TimeAuthority timeAuthority;
    private final IdentityProviderProperties properties;

    public AuthService(IdentityTokenVerifier identityTokenVerifier, AccountService accountService,
                       TokenIssuer tokenIssuer, RefreshTokenService refreshTokenService,
                       TimeAuthority timeAuthority, IdentityProviderProperties properties) {
        this.identityTokenVerifier = identityTokenVerifier;
        this.accountService = accountService;
        this.tokenIssuer = tokenIssuer;
        this.refreshTokenService = refreshTokenService;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @Transactional
    public BootstrapSession startSession(IdentityProvider provider, String idToken) {
        IdentityTokenVerifier.VerifiedIdentity identity = identityTokenVerifier.verify(provider, idToken);
        Account account = accountService.findOrCreate(provider, identity.subject(), identity.email());
        return new BootstrapSession(tokenIssuer.issueBootstrapToken(account.getId()),
                properties.bootstrapTokenTtl().getSeconds(), account.getId(), timeAuthority.now());
    }

    @Transactional
    public DeviceSession issueDeviceSession(Device device) {
        RefreshTokenService.IssuedRefreshToken refresh = refreshTokenService.issueNewFamily(device);
        return buildSession(device.getAccount().getId(), device.getId(), refresh.token());
    }

    @Transactional
    public DeviceSession refresh(String refreshToken) {
        RefreshTokenService.IssuedRefreshToken rotated = refreshTokenService.rotate(refreshToken);
        Device device = rotated.entity().getDevice();
        return buildSession(device.getAccount().getId(), device.getId(), rotated.token());
    }

    private DeviceSession buildSession(UUID accountId, UUID deviceId, String refreshToken) {
        return new DeviceSession(tokenIssuer.issueAccessToken(accountId, deviceId),
                properties.accessTokenTtl().getSeconds(), refreshToken, accountId, deviceId, timeAuthority.now());
    }

    public record BootstrapSession(String bootstrapToken, long expiresIn, UUID accountId, Instant serverTime) {
    }

    public record DeviceSession(String accessToken, long expiresIn, String refreshToken, UUID accountId,
                                UUID deviceId, Instant serverTime) {
    }
}
