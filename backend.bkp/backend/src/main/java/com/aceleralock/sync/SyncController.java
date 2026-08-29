package com.aceleralock.sync;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.config.DeviceAccessGuard;
import com.aceleralock.device.Device;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.ServletWebRequest;

import java.util.UUID;

@RestController
@RequestMapping("/v1/devices/{deviceId}/sync")
public class SyncController {

    private final SyncService syncService;
    private final DeviceAccessGuard deviceAccessGuard;

    public SyncController(SyncService syncService, DeviceAccessGuard deviceAccessGuard) {
        this.syncService = syncService;
        this.deviceAccessGuard = deviceAccessGuard;
    }

    @GetMapping
    @Transactional
    public ResponseEntity<SyncResponse> sync(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deviceId,
                                             HttpServletRequest request,
                                             org.springframework.web.context.request.WebRequest webRequest) {
        Device device = deviceAccessGuard.require(AuthenticatedCaller.from(jwt), deviceId);
        SyncResponse snapshot = syncService.snapshot(device);
        if (webRequest.checkNotModified(Long.toString(snapshot.syncVersion()))) {
            return null;
        }
        return ResponseEntity.ok().eTag("\"" + snapshot.syncVersion() + "\"").body(snapshot);
    }
}
