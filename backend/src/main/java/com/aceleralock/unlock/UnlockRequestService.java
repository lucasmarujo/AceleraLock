package com.aceleralock.unlock;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountService;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.common.ConflictException;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.BlockTargetRepository;
import com.aceleralock.device.Device;
import com.aceleralock.partner.PartnerLink;
import com.aceleralock.partner.PartnerService;
import com.aceleralock.profile.BlockProfile;
import com.aceleralock.profile.BlockProfileRepository;
import com.aceleralock.push.PushDispatcher;
import com.aceleralock.push.PushNotificationType;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UnlockRequestService {

    private final UnlockRequestRepository unlockRequestRepository;
    private final BlockTargetRepository blockTargetRepository;
    private final BlockProfileRepository blockProfileRepository;
    private final PartnerService partnerService;
    private final AccountService accountService;
    private final AuditService auditService;
    private final PushDispatcher pushDispatcher;
    private final TimeAuthority timeAuthority;
    private final UnlockProperties properties;

    public UnlockRequestService(UnlockRequestRepository unlockRequestRepository,
                                BlockTargetRepository blockTargetRepository,
                                BlockProfileRepository blockProfileRepository,
                                PartnerService partnerService, AccountService accountService,
                                AuditService auditService, PushDispatcher pushDispatcher,
                                TimeAuthority timeAuthority, UnlockProperties properties) {
        this.unlockRequestRepository = unlockRequestRepository;
        this.blockTargetRepository = blockTargetRepository;
        this.blockProfileRepository = blockProfileRepository;
        this.partnerService = partnerService;
        this.accountService = accountService;
        this.auditService = auditService;
        this.pushDispatcher = pushDispatcher;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @Transactional
    public UnlockRequest create(Device device, UUID targetId, String reason) {
        BlockTarget target = blockTargetRepository.findByIdAndDeviceId(targetId, device.getId())
                .orElseThrow(() -> new NotFoundException("alvo nao encontrado"));

        Optional<UnlockRequest> open = unlockRequestRepository.findOpenByDeviceAndTarget(device.getId(), targetId);
        if (open.isPresent()) {
            UnlockRequest existing = open.get();
            evaluate(existing);
            return existing;
        }

        Account account = device.getAccount();
        PartnerLink link = partnerService.findActiveLinkOwnedBy(account.getId()).orElse(null);
        Duration cooldown = Duration.ofMinutes(resolveCooldownMinutes(account.getId(), targetId));

        UnlockRequest request = new UnlockRequest(account, device, target, link, reason, timeAuthority.now(),
                cooldown, properties.unilateralCooldown());
        unlockRequestRepository.save(request);
        auditService.recordServerEvent(account, device, AuditEventType.UNLOCK_REQUESTED, target);

        if (link != null && link.getPartnerAccount() != null) {
            pushDispatcher.notifyAccount(link.getPartnerAccount(),
                    PushNotificationType.UNLOCK_REQUESTED, request.getId());
        }
        return request;
    }

    @Transactional
    public UnlockRequest approve(UUID partnerAccountId, UUID requestId) {
        UnlockRequest request = requirePartnerRequest(partnerAccountId, requestId);
        PartnerLink link = request.getPartnerLink();
        if (!link.isMatureAt(timeAuthority.now(), properties.partnerMinAge())) {
            throw new ConflictException("vinculo de parceiro ainda nao maduro para aprovar");
        }
        request.approve(accountService.require(partnerAccountId), timeAuthority.now());
        auditService.recordServerEvent(request.getAccount(), request.getDevice(),
                AuditEventType.UNLOCK_APPROVED_BY_PARTNER, request.getTarget());
        evaluate(request);
        pushDispatcher.notifyAccount(request.getAccount(), PushNotificationType.UNLOCK_APPROVED, request.getId());
        return request;
    }

    @Transactional
    public UnlockRequest deny(UUID partnerAccountId, UUID requestId) {
        UnlockRequest request = requirePartnerRequest(partnerAccountId, requestId);
        request.deny(accountService.require(partnerAccountId), timeAuthority.now());
        auditService.recordServerEvent(request.getAccount(), request.getDevice(),
                AuditEventType.UNLOCK_DENIED, request.getTarget());
        pushDispatcher.notifyAccount(request.getAccount(), PushNotificationType.UNLOCK_DENIED, request.getId());
        return request;
    }

    @Transactional
    public UnlockRequest cancel(UUID accountId, UUID requestId) {
        UnlockRequest request = requireOwnRequest(accountId, requestId);
        evaluate(request);
        request.cancel();
        auditService.recordServerEvent(request.getAccount(), request.getDevice(),
                AuditEventType.UNLOCK_CANCELLED, request.getTarget());
        return request;
    }

    @Transactional
    public UnlockRequest get(UUID accountId, UUID requestId) {
        UnlockRequest request = requireOwnRequest(accountId, requestId);
        evaluate(request);
        return request;
    }

    @Transactional
    public List<UnlockRequest> openRequestsForDevice(UUID deviceId) {
        List<UnlockRequest> requests = unlockRequestRepository.findOpenByDevice(deviceId);
        requests.forEach(this::evaluate);
        return requests;
    }

    @Transactional(readOnly = true)
    public List<UnlockRequest> pendingForPartner(UUID partnerAccountId) {
        return unlockRequestRepository.findPendingForPartner(partnerAccountId);
    }

    @Transactional
    public List<UnlockRequest> activeGrants(UUID deviceId) {
        Instant now = timeAuthority.now();
        List<UnlockRequest> grants = new ArrayList<>();
        for (UnlockRequest request : openRequestsForDevice(deviceId)) {
            if (request.isGrantActive(now)) {
                grants.add(request);
            }
        }
        return grants;
    }

    private void evaluate(UnlockRequest request) {
        UnlockRequestStatus before = request.getStatus();
        if (!request.evaluate(timeAuthority.now(), properties.grantDuration())) {
            return;
        }
        if (before == UnlockRequestStatus.PENDING && request.getStatus() == UnlockRequestStatus.GRANTED) {
            AuditEventType type = request.isGrantedUnilaterally()
                    ? AuditEventType.UNLOCK_GRANTED_UNILATERALLY
                    : AuditEventType.UNLOCK_GRANTED;
            auditService.recordServerEvent(request.getAccount(), request.getDevice(), type, request.getTarget());
            if (request.isGrantedUnilaterally() && request.getPartnerLink() != null) {
                pushDispatcher.notifyAccount(request.getPartnerLink().getPartnerAccount(),
                        PushNotificationType.UNLOCK_GRANTED_UNILATERALLY, request.getId());
            }
        } else if (request.getStatus() == UnlockRequestStatus.CONSUMED) {
            auditService.recordServerEvent(request.getAccount(), request.getDevice(),
                    AuditEventType.UNLOCK_CONSUMED, request.getTarget());
        }
    }

    private int resolveCooldownMinutes(UUID accountId, UUID targetId) {
        Instant now = timeAuthority.now();
        return blockProfileRepository.findByAccountId(accountId).stream()
                .filter(profile -> profile.getTargets().stream()
                        .anyMatch(target -> target.getId().equals(targetId)))
                .mapToInt(profile -> profile.effectiveCooldownMinutes(now))
                .max()
                .orElse(properties.defaultCooldownMinutes());
    }

    private UnlockRequest requireOwnRequest(UUID accountId, UUID requestId) {
        UnlockRequest request = unlockRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("pedido nao encontrado"));
        if (!request.getAccount().getId().equals(accountId)) {
            throw new NotFoundException("pedido nao encontrado");
        }
        return request;
    }

    private UnlockRequest requirePartnerRequest(UUID partnerAccountId, UUID requestId) {
        UnlockRequest request = unlockRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("pedido nao encontrado"));
        PartnerLink link = request.getPartnerLink();
        if (link == null || !link.isActive() || link.getPartnerAccount() == null
                || !link.getPartnerAccount().getId().equals(partnerAccountId)) {
            throw new NotFoundException("pedido nao encontrado");
        }
        evaluate(request);
        return request;
    }
}
