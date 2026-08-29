package com.aceleralock.device;

import com.aceleralock.account.AccountService;
import com.aceleralock.auth.AuthService;
import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.push.PushProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/v1/devices")
public class DeviceController {

    private final DeviceService deviceService;
    private final AuthService authService;
    private final AccountService accountService;
    private final DeviceAccessGuard deviceAccessGuard;

    public DeviceController(DeviceService deviceService, AuthService authService, AccountService accountService,
                            DeviceAccessGuard deviceAccessGuard) {
        this.deviceService = deviceService;
        this.authService = authService;
        this.accountService = accountService;
        this.deviceAccessGuard = deviceAccessGuard;
    }

    @PostMapping
    public AuthService.DeviceSession register(@AuthenticationPrincipal Jwt jwt,
                                              @Valid @RequestBody RegisterDeviceRequest request) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        Device device = deviceService.register(accountService.require(caller.accountId()),
                request.deviceInstallId(), request.platform(), request.label(), request.timeZone(),
                request.appVersion(), request.osVersion());
        return authService.issueDeviceSession(device);
    }

    @DeleteMapping("/{deviceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        deviceAccessGuard.require(caller, deviceId);
        deviceService.revoke(accountService.require(caller.accountId()), deviceId);
    }

    @PutMapping("/{deviceId}/push-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updatePushToken(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                @Valid @RequestBody PushTokenRequest request) {
        Device device = deviceAccessGuard.require(AuthenticatedCaller.from(jwt), deviceId);
        deviceService.updatePushToken(device, request.token(), request.provider());
    }

    public record RegisterDeviceRequest(
            @NotBlank @Size(max = 64) String deviceInstallId,
            @NotNull DevicePlatform platform,
            @NotBlank @Size(max = 80) String label,
            @NotBlank @Size(max = 64) String timeZone,
            @NotBlank @Size(max = 32) String appVersion,
            @NotBlank @Size(max = 32) String osVersion) {
    }

    public record PushTokenRequest(@NotBlank @Size(max = 512) String token, @NotNull PushProvider provider) {
    }
}
