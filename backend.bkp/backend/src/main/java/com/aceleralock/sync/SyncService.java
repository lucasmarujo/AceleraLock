package com.aceleralock.sync;

import com.aceleralock.account.AccountService;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.BlockTargetRepository;
import com.aceleralock.device.Device;
import com.aceleralock.profile.BlockProfile;
import com.aceleralock.profile.BlockProfileRepository;
import com.aceleralock.time.TimeAuthority;
import com.aceleralock.unlock.UnlockRequest;
import com.aceleralock.unlock.UnlockRequestService;
import com.aceleralock.unlock.UnlockRequestStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SyncService {

    private final BlockTargetRepository blockTargetRepository;
    private final BlockProfileRepository blockProfileRepository;
    private final UnlockRequestService unlockRequestService;
    private final AccountService accountService;
    private final TimeAuthority timeAuthority;
    private final UnlockProperties properties;

    public SyncService(BlockTargetRepository blockTargetRepository, BlockProfileRepository blockProfileRepository,
                       UnlockRequestService unlockRequestService, AccountService accountService,
                       TimeAuthority timeAuthority, UnlockProperties properties) {
        this.blockTargetRepository = blockTargetRepository;
        this.blockProfileRepository = blockProfileRepository;
        this.unlockRequestService = unlockRequestService;
        this.accountService = accountService;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @Transactional
    public SyncResponse snapshot(Device device) {
        UUID accountId = device.getAccount().getId();
        Instant now = timeAuthority.now();

        List<BlockTarget> deviceTargets = blockTargetRepository.findByDeviceId(device.getId());
        Set<UUID> deviceTargetIds = deviceTargets.stream().map(BlockTarget::getId).collect(Collectors.toSet());

        List<SyncResponse.TargetView> targets = deviceTargets.stream()
                .map(target -> new SyncResponse.TargetView(target.getId(), target.getLabel()))
                .toList();

        List<SyncResponse.ProfileView> profiles = blockProfileRepository.findByAccountId(accountId).stream()
                .map(profile -> toProfileView(profile, deviceTargetIds, now))
                .toList();

        List<UnlockRequest> open = unlockRequestService.openRequestsForDevice(device.getId());

        List<SyncResponse.GrantView> grants = open.stream()
                .filter(request -> request.isGrantActive(now))
                .map(request -> new SyncResponse.GrantView(request.getTarget().getId(), request.getId(),
                        request.getGrantEndsAt(), request.isGrantedUnilaterally()))
                .toList();

        List<SyncResponse.PendingUnlockView> pending = open.stream()
                .filter(request -> request.getStatus() == UnlockRequestStatus.PENDING)
                .map(request -> new SyncResponse.PendingUnlockView(request.getId(), request.getTarget().getId(),
                        request.getStatus().name(), request.getCooldownEndsAt(), request.getUnilateralEndsAt(),
                        request.getApprovedAt()))
                .toList();

        return new SyncResponse(accountService.currentSyncVersion(accountId), now, properties.failsafeDays(),
                targets, profiles, grants, pending);
    }

    private SyncResponse.ProfileView toProfileView(BlockProfile profile, Set<UUID> deviceTargetIds, Instant now) {
        List<SyncResponse.WindowView> windows = profile.getWindows().stream()
                .map(window -> new SyncResponse.WindowView(window.getDayOfWeek(), window.getStartTime(),
                        window.getEndTime()))
                .toList();
        List<UUID> targetIds = profile.getTargets().stream()
                .map(BlockTarget::getId)
                .filter(deviceTargetIds::contains)
                .toList();
        return new SyncResponse.ProfileView(profile.getId(), profile.getName(), profile.isEnabled(),
                profile.getTimeZone(), profile.effectiveCooldownMinutes(now), profile.getPendingCooldownMinutes(),
                profile.getCooldownEffectiveAt(), windows, targetIds);
    }
}
