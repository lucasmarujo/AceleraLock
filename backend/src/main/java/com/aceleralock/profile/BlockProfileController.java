package com.aceleralock.profile;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.Device;
import com.aceleralock.time.TimeAuthority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class BlockProfileController {

    private final BlockProfileService blockProfileService;
    private final DeviceAccessGuard deviceAccessGuard;
    private final TimeAuthority timeAuthority;

    public BlockProfileController(BlockProfileService blockProfileService, DeviceAccessGuard deviceAccessGuard,
                                  TimeAuthority timeAuthority) {
        this.blockProfileService = blockProfileService;
        this.deviceAccessGuard = deviceAccessGuard;
        this.timeAuthority = timeAuthority;
    }

    @GetMapping("/profiles")
    @Transactional(readOnly = true)
    public List<ProfileResponse> list(@AuthenticationPrincipal Jwt jwt) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        Instant now = timeAuthority.now();
        return blockProfileService.list(caller.accountId()).stream()
                .map(profile -> ProfileResponse.of(profile, now))
                .toList();
    }

    @PostMapping("/profiles")
    @Transactional
    public ProfileResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        BlockProfile profile = blockProfileService.create(caller.accountId(), request.name(), request.enabled(),
                request.timeZone(), request.cooldownMinutes(), request.toWindowSpecs());
        return ProfileResponse.of(profile, timeAuthority.now());
    }

    @PutMapping("/profiles/{profileId}")
    @Transactional
    public ProfileResponse replace(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID profileId,
                                   @Valid @RequestBody ProfileRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        BlockProfile profile = blockProfileService.replace(caller.accountId(), profileId, request.name(),
                request.enabled(), request.timeZone(), request.cooldownMinutes(), request.toWindowSpecs());
        return ProfileResponse.of(profile, timeAuthority.now());
    }

    @DeleteMapping("/profiles/{profileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID profileId) {
        blockProfileService.delete(AuthenticatedCaller.from(jwt).accountId(), profileId);
    }

    @PutMapping("/devices/{deviceId}/profiles/{profileId}/targets")
    @Transactional
    public ProfileResponse replaceDeviceTargets(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                                @PathVariable UUID profileId,
                                                @Valid @RequestBody DeviceTargetsRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        Device device = deviceAccessGuard.require(caller, deviceId);
        BlockProfile profile = blockProfileService.replaceDeviceTargets(caller.accountId(), device, profileId,
                request.targetIds());
        return ProfileResponse.of(profile, timeAuthority.now(), device.getId());
    }

    public record ProfileRequest(
            @NotBlank @Size(max = 80) String name,
            boolean enabled,
            @NotBlank @Size(max = 64) String timeZone,
            @Min(0) int cooldownMinutes,
            @NotNull List<@Valid WindowRequest> windows) {

        List<BlockProfileService.WindowSpec> toWindowSpecs() {
            return windows.stream()
                    .map(window -> new BlockProfileService.WindowSpec(window.dayOfWeek(), window.startTime(),
                            window.endTime()))
                    .toList();
        }
    }

    public record WindowRequest(@NotNull DayOfWeek dayOfWeek, @NotNull LocalTime startTime,
                                @NotNull LocalTime endTime) {
    }

    public record DeviceTargetsRequest(@NotNull List<UUID> targetIds) {
    }

    public record ProfileResponse(UUID profileId, String name, boolean enabled, String timeZone,
                                  int cooldownMinutes, Integer pendingCooldownMinutes, Instant cooldownEffectiveAt,
                                  List<WindowRequest> windows, List<UUID> targetIds) {

        static ProfileResponse of(BlockProfile profile, Instant now) {
            return of(profile, now, null);
        }

        static ProfileResponse of(BlockProfile profile, Instant now, UUID deviceId) {
            List<WindowRequest> windows = profile.getWindows().stream()
                    .map(window -> new WindowRequest(window.getDayOfWeek(), window.getStartTime(),
                            window.getEndTime()))
                    .toList();
            List<UUID> targetIds = profile.getTargets().stream()
                    .filter(target -> deviceId == null || target.getDevice().getId().equals(deviceId))
                    .map(BlockTarget::getId)
                    .toList();
            return new ProfileResponse(profile.getId(), profile.getName(), profile.isEnabled(),
                    profile.getTimeZone(), profile.effectiveCooldownMinutes(now),
                    profile.getPendingCooldownMinutes(), profile.getCooldownEffectiveAt(), windows, targetIds);
        }
    }
}
