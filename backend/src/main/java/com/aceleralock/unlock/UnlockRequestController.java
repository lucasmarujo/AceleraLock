package com.aceleralock.unlock;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.device.Device;
import com.aceleralock.time.TimeAuthority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class UnlockRequestController {

    private final UnlockRequestService unlockRequestService;
    private final DeviceAccessGuard deviceAccessGuard;
    private final TimeAuthority timeAuthority;

    public UnlockRequestController(UnlockRequestService unlockRequestService, DeviceAccessGuard deviceAccessGuard,
                                   TimeAuthority timeAuthority) {
        this.unlockRequestService = unlockRequestService;
        this.deviceAccessGuard = deviceAccessGuard;
        this.timeAuthority = timeAuthority;
    }

    @PostMapping("/devices/{deviceId}/unlock-requests")
    @Transactional
    public UnlockRequestResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                        @Valid @RequestBody CreateUnlockRequest request) {
        Device device = deviceAccessGuard.require(AuthenticatedCaller.from(jwt), deviceId);
        return response(unlockRequestService.create(device, request.targetId(), request.reason()));
    }

    @GetMapping("/unlock-requests/{requestId}")
    @Transactional
    public UnlockRequestResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID requestId) {
        return response(unlockRequestService.get(AuthenticatedCaller.from(jwt).accountId(), requestId));
    }

    @DeleteMapping("/unlock-requests/{requestId}")
    @Transactional
    public UnlockRequestResponse cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID requestId) {
        return response(unlockRequestService.cancel(AuthenticatedCaller.from(jwt).accountId(), requestId));
    }

    @PostMapping("/unlock-requests/{requestId}/approve")
    @Transactional
    public UnlockRequestResponse approve(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID requestId) {
        return response(unlockRequestService.approve(AuthenticatedCaller.from(jwt).accountId(), requestId));
    }

    @PostMapping("/unlock-requests/{requestId}/deny")
    @Transactional
    public UnlockRequestResponse deny(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID requestId) {
        return response(unlockRequestService.deny(AuthenticatedCaller.from(jwt).accountId(), requestId));
    }

    private UnlockRequestResponse response(UnlockRequest request) {
        return new UnlockRequestResponse(request.getId(), request.getTarget().getId(), request.getStatus().name(),
                request.getRequestedAt(), request.getCooldownEndsAt(), request.getUnilateralEndsAt(),
                request.getApprovedAt(), request.getGrantEndsAt(), request.isGrantedUnilaterally(),
                timeAuthority.now());
    }

    public record CreateUnlockRequest(@NotNull UUID targetId, @Size(max = 500) String reason) {
    }

    public record UnlockRequestResponse(UUID requestId, UUID targetId, String status, Instant requestedAt,
                                        Instant cooldownEndsAt, Instant unilateralEndsAt, Instant approvedAt,
                                        Instant grantEndsAt, boolean grantedUnilaterally, Instant serverTime) {
    }
}
