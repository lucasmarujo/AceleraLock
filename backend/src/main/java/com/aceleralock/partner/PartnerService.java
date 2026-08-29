package com.aceleralock.partner;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountService;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.common.ConflictException;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.common.ValidationException;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceRepository;
import com.aceleralock.push.PushDispatcher;
import com.aceleralock.push.PushNotificationType;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class PartnerService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;

    private final PartnerLinkRepository partnerLinkRepository;
    private final DeviceRepository deviceRepository;
    private final AccountService accountService;
    private final AuditService auditService;
    private final PushDispatcher pushDispatcher;
    private final TimeAuthority timeAuthority;
    private final UnlockProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public PartnerService(PartnerLinkRepository partnerLinkRepository, DeviceRepository deviceRepository,
                          AccountService accountService, AuditService auditService, PushDispatcher pushDispatcher,
                          TimeAuthority timeAuthority, UnlockProperties properties) {
        this.partnerLinkRepository = partnerLinkRepository;
        this.deviceRepository = deviceRepository;
        this.accountService = accountService;
        this.auditService = auditService;
        this.pushDispatcher = pushDispatcher;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @Transactional
    public CreatedInvite createInvite(UUID ownerAccountId) {
        Account owner = accountService.require(ownerAccountId);
        Instant now = timeAuthority.now();
        partnerLinkRepository.findByOwnerAccountIdAndStatus(ownerAccountId, PartnerLinkStatus.ACTIVE)
                .ifPresent(link -> {
                    throw new ConflictException("ja existe um parceiro ativo");
                });
        partnerLinkRepository.findByOwnerAccountIdAndStatus(ownerAccountId, PartnerLinkStatus.PENDING)
                .ifPresent(link -> link.revoke(now));

        String code = generateCode();
        PartnerLink link = new PartnerLink(owner, hash(code), now.plus(properties.inviteTtl()), now);
        partnerLinkRepository.save(link);
        return new CreatedInvite(code, link.getInviteExpiresAt());
    }

    @Transactional
    public PartnerLink accept(UUID partnerAccountId, String code) {
        Instant now = timeAuthority.now();
        PartnerLink link = partnerLinkRepository.findByInviteCodeHash(hash(code))
                .orElseThrow(() -> new NotFoundException("convite nao encontrado"));

        if (link.getStatus() != PartnerLinkStatus.PENDING) {
            throw new ConflictException("convite ja utilizado ou revogado");
        }
        if (now.isAfter(link.getInviteExpiresAt())) {
            throw new NotFoundException("convite nao encontrado");
        }
        UUID ownerId = link.getOwnerAccount().getId();
        if (ownerId.equals(partnerAccountId)) {
            throw new ValidationException("nao e possivel ser parceiro de si mesmo");
        }
        if (sharesInstallation(ownerId, partnerAccountId)) {
            throw new ValidationException("parceiro nao pode usar a mesma instalacao do dono");
        }

        Account partner = accountService.require(partnerAccountId);
        link.accept(partner, now);
        auditService.recordServerEvent(link.getOwnerAccount(), null, AuditEventType.PARTNER_LINKED, null);

        if (partnerLinkRepository.existsByOwnerAccountIdAndPartnerAccountIdAndStatus(
                partnerAccountId, ownerId, PartnerLinkStatus.ACTIVE)) {
            auditService.recordServerEvent(link.getOwnerAccount(), null,
                    AuditEventType.PARTNER_RECIPROCAL_DETECTED, null);
        }

        pushDispatcher.notifyAccount(link.getOwnerAccount(), PushNotificationType.PARTNER_INVITE_ACCEPTED, null);
        return link;
    }

    @Transactional
    public void revoke(UUID callerAccountId, UUID linkId) {
        PartnerLink link = partnerLinkRepository.findById(linkId)
                .orElseThrow(() -> new NotFoundException("vinculo nao encontrado"));
        boolean isOwner = link.getOwnerAccount().getId().equals(callerAccountId);
        boolean isPartner = link.getPartnerAccount() != null
                && link.getPartnerAccount().getId().equals(callerAccountId);
        if (!isOwner && !isPartner) {
            throw new NotFoundException("vinculo nao encontrado");
        }
        if (link.getStatus() == PartnerLinkStatus.REVOKED) {
            return;
        }
        link.revoke(timeAuthority.now());
        auditService.recordServerEvent(link.getOwnerAccount(), null, AuditEventType.PARTNER_REVOKED, null);
    }

    @Transactional(readOnly = true)
    public Optional<PartnerLink> findActiveLinkOwnedBy(UUID ownerAccountId) {
        return partnerLinkRepository.findByOwnerAccountIdAndStatus(ownerAccountId, PartnerLinkStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public List<PartnerLink> findActiveLinksWhereCallerIsPartner(UUID partnerAccountId) {
        return partnerLinkRepository.findByPartnerAccountIdAndStatus(partnerAccountId, PartnerLinkStatus.ACTIVE);
    }

    private boolean sharesInstallation(UUID ownerAccountId, UUID partnerAccountId) {
        Set<String> ownerInstalls = new HashSet<>();
        deviceRepository.findByAccountId(ownerAccountId)
                .forEach(device -> ownerInstalls.add(device.getDeviceInstallId()));
        if (ownerInstalls.isEmpty()) {
            return false;
        }
        return deviceRepository.findByAccountId(partnerAccountId).stream()
                .map(Device::getDeviceInstallId)
                .anyMatch(ownerInstalls::contains);
    }

    private String generateCode() {
        StringBuilder builder = new StringBuilder(CODE_LENGTH);
        for (int index = 0; index < CODE_LENGTH; index++) {
            builder.append(CODE_ALPHABET.charAt(secureRandom.nextInt(CODE_ALPHABET.length())));
        }
        return builder.toString();
    }

    static byte[] hash(String code) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(code.trim().toUpperCase(Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponivel", exception);
        }
    }

    public record CreatedInvite(String code, Instant expiresAt) {
    }
}
