package com.aceleralock.auth;

import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.config.IdentityProviderProperties;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceStatus;
import com.aceleralock.time.TimeAuthority;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditService auditService;
    private final TimeAuthority timeAuthority;
    private final IdentityProviderProperties authProperties;
    private final UnlockProperties unlockProperties;
    private final SecureRandom secureRandom = new SecureRandom();
    private final org.springframework.transaction.support.TransactionTemplate revocationTransaction;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, AuditService auditService,
                               TimeAuthority timeAuthority, IdentityProviderProperties authProperties,
                               UnlockProperties unlockProperties,
                               org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.auditService = auditService;
        this.timeAuthority = timeAuthority;
        this.authProperties = authProperties;
        this.unlockProperties = unlockProperties;
        this.revocationTransaction =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        this.revocationTransaction.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional
    public IssuedRefreshToken issueNewFamily(Device device) {
        return issue(device, UUID.randomUUID());
    }

    @Transactional
    public IssuedRefreshToken rotate(String presentedToken) {
        byte[] hash = hash(presentedToken);
        RefreshToken current = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new JwtException("refresh token invalido"));
        Instant now = timeAuthority.now();

        if (current.isRevoked() || current.isExpiredAt(now)) {
            throw new JwtException("refresh token invalido");
        }
        if (current.getDevice().getStatus() != DeviceStatus.ACTIVE) {
            throw new JwtException("device revogado");
        }

        if (current.isUsed()) {
            RefreshToken successor = current.getSuccessorId() == null ? null
                    : refreshTokenRepository.findById(current.getSuccessorId()).orElse(null);
            boolean successorConsumed = successor != null && successor.isUsed();
            if (successorConsumed || !current.isWithinGrace(now, unlockProperties.refreshGrace())) {
                revokeFamilyOutsideCurrentTransaction(current, now);
                throw new JwtException("reuso de refresh token detectado");
            }
            if (successor != null) {
                successor.revoke(now);
            }
        }

        IssuedRefreshToken issued = issue(current.getDevice(), current.getFamilyId());
        current.markUsed(now, issued.entity().getId());
        return issued;
    }

    @Transactional
    public void revokeDevice(Device device) {
        refreshTokenRepository.revokeByDevice(device.getId(), timeAuthority.now());
    }

    private void revokeFamilyOutsideCurrentTransaction(RefreshToken current, Instant now) {
        UUID familyId = current.getFamilyId();
        UUID deviceId = current.getDevice().getId();
        revocationTransaction.executeWithoutResult(status -> {
            refreshTokenRepository.revokeFamily(familyId, now);
            refreshTokenRepository.findById(current.getId())
                    .map(RefreshToken::getDevice)
                    .ifPresent(device -> auditService.recordServerEvent(device.getAccount(), device,
                            AuditEventType.REFRESH_REUSE_DETECTED, null));
        });
    }

    private IssuedRefreshToken issue(Device device, UUID familyId) {
        byte[] raw = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        RefreshToken entity = new RefreshToken(device, hash(token), familyId, timeAuthority.now(),
                authProperties.refreshTokenTtl());
        return new IssuedRefreshToken(token, refreshTokenRepository.save(entity));
    }

    static byte[] hash(String token) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponivel", exception);
        }
    }

    public record IssuedRefreshToken(String token, RefreshToken entity) {
    }
}
