package com.aceleralock.device;

import com.aceleralock.account.AccountService;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.time.TimeAuthority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/devices/{deviceId}/targets")
public class BlockTargetController {

    private final BlockTargetRepository blockTargetRepository;
    private final DeviceAccessGuard deviceAccessGuard;
    private final AccountService accountService;
    private final AuditService auditService;
    private final TimeAuthority timeAuthority;

    public BlockTargetController(BlockTargetRepository blockTargetRepository, DeviceAccessGuard deviceAccessGuard,
                                 AccountService accountService, AuditService auditService,
                                 TimeAuthority timeAuthority) {
        this.blockTargetRepository = blockTargetRepository;
        this.deviceAccessGuard = deviceAccessGuard;
        this.accountService = accountService;
        this.auditService = auditService;
        this.timeAuthority = timeAuthority;
    }

    @PostMapping
    @Transactional
    public RegisterTargetsResponse register(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                            @Valid @RequestBody RegisterTargetsRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        Device device = deviceAccessGuard.require(caller, deviceId);
        Instant now = timeAuthority.now();

        List<TargetView> views = new ArrayList<>();
        for (TargetSpec spec : request.targets()) {
            BlockTarget target = blockTargetRepository.findByDeviceIdAndClientRef(deviceId, spec.clientRef())
                    .orElseGet(() -> {
                        BlockTarget created = blockTargetRepository.save(
                                new BlockTarget(device, spec.clientRef(), spec.label(), now));
                        auditService.recordServerEvent(device.getAccount(), device,
                                AuditEventType.TARGET_ADDED, created);
                        return created;
                    });
            views.add(new TargetView(spec.clientRef(), target.getId(), target.getLabel()));
        }
        accountService.bumpSyncVersion(device.getAccount().getId());
        return new RegisterTargetsResponse(views, accountService.currentSyncVersion(device.getAccount().getId()), now);
    }

    @DeleteMapping("/{targetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId, @PathVariable UUID targetId) {
        Device device = deviceAccessGuard.require(AuthenticatedCaller.from(jwt), deviceId);
        BlockTarget target = blockTargetRepository.findByIdAndDeviceId(targetId, deviceId)
                .orElseThrow(() -> new NotFoundException("alvo nao encontrado"));
        auditService.recordServerEvent(device.getAccount(), device, AuditEventType.TARGET_REMOVED, target);
        blockTargetRepository.delete(target);
        accountService.bumpSyncVersion(device.getAccount().getId());
    }

    public record RegisterTargetsRequest(@NotEmpty List<@Valid TargetSpec> targets) {
    }

    public record TargetSpec(@NotBlank @Size(max = 64) String clientRef, @Size(max = 80) String label) {
    }

    public record TargetView(String clientRef, UUID targetId, String label) {
    }

    public record RegisterTargetsResponse(List<TargetView> targets, long syncVersion, Instant serverTime) {
    }
}
