package com.aceleralock.audit;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.BlockTargetRepository;
import com.aceleralock.device.Device;
import com.aceleralock.partner.PartnerService;
import com.aceleralock.push.PushDispatcher;
import com.aceleralock.push.PushNotificationType;
import com.aceleralock.time.TimeAuthority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/devices/{deviceId}/events")
public class AuditController {

    private final AuditService auditService;
    private final BlockTargetRepository blockTargetRepository;
    private final DeviceAccessGuard deviceAccessGuard;
    private final PartnerService partnerService;
    private final PushDispatcher pushDispatcher;
    private final TimeAuthority timeAuthority;
    private final UnlockProperties properties;

    public AuditController(AuditService auditService, BlockTargetRepository blockTargetRepository,
                           DeviceAccessGuard deviceAccessGuard, PartnerService partnerService,
                           PushDispatcher pushDispatcher, TimeAuthority timeAuthority,
                           UnlockProperties properties) {
        this.auditService = auditService;
        this.blockTargetRepository = blockTargetRepository;
        this.deviceAccessGuard = deviceAccessGuard;
        this.partnerService = partnerService;
        this.pushDispatcher = pushDispatcher;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @PostMapping
    @Transactional
    public IngestResponse ingest(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                 @Valid @RequestBody IngestRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        Device device = deviceAccessGuard.requireUntouched(caller, deviceId);
        Instant observedLastSeenAt = device.getLastSeenAt();

        int accepted = 0;
        int duplicates = 0;
        for (EventSpec spec : request.events()) {
            BlockTarget target = spec.targetId() == null ? null
                    : blockTargetRepository.findByIdAndDeviceId(spec.targetId(), deviceId).orElse(null);

            AuditEventType type = spec.type();
            String details = null;
            if (type == AuditEventType.UNLOCK_GRANTED_OFFLINE_FAILSAFE) {
                details = reconcileFailsafe(device, observedLastSeenAt);
            }

            boolean stored = auditService.recordDeviceEvent(device.getAccount(), device, spec.clientEventId(),
                    type, spec.occurredAt(), target, details);
            if (stored) {
                accepted++;
            } else {
                duplicates++;
            }
        }
        device.touch(timeAuthority.now());
        return new IngestResponse(accepted, duplicates, timeAuthority.now());
    }

    private String reconcileFailsafe(Device device, Instant observedLastSeenAt) {
        Instant now = timeAuthority.now();
        Duration observedGap = Duration.between(observedLastSeenAt, now);
        Duration requiredGap = Duration.ofDays(properties.failsafeDays());
        boolean plausible = observedGap.compareTo(requiredGap) >= 0;

        partnerService.findActiveLinkOwnedBy(device.getAccount().getId()).ifPresent(link -> {
            PushNotificationType type = plausible
                    ? PushNotificationType.UNLOCK_GRANTED_OFFLINE_FAILSAFE
                    : PushNotificationType.PARTNER_PROTECTION_INTERRUPTED;
            pushDispatcher.notifyAccount(link.getPartnerAccount(), type, null);
        });

        if (!plausible) {
            auditService.recordTamperEvidence(device.getAccount().getId(), device.getId(),
                    AuditEventType.PROTECTION_INTERRUPTED,
                    "{\"reason\":\"failsafe_gap_implausible\",\"observedGapSeconds\":" + observedGap.getSeconds()
                            + ",\"requiredGapSeconds\":" + requiredGap.getSeconds() + "}");
        }
        return "{\"observedGapSeconds\":" + observedGap.getSeconds() + ",\"plausible\":" + plausible + "}";
    }

    public record IngestRequest(@NotEmpty List<@Valid EventSpec> events) {
    }

    public record EventSpec(UUID clientEventId, @NotNull AuditEventType type, Instant occurredAt, UUID targetId) {
    }

    public record IngestResponse(int accepted, int duplicates, Instant serverTime) {
    }
}
