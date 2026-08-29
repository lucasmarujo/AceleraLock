package com.aceleralock.profile;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountService;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.common.ValidationException;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.BlockTargetRepository;
import com.aceleralock.device.Device;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BlockProfileService {

    private final BlockProfileRepository blockProfileRepository;
    private final BlockTargetRepository blockTargetRepository;
    private final AccountService accountService;
    private final TimeAuthority timeAuthority;

    public BlockProfileService(BlockProfileRepository blockProfileRepository,
                               BlockTargetRepository blockTargetRepository,
                               AccountService accountService, TimeAuthority timeAuthority) {
        this.blockProfileRepository = blockProfileRepository;
        this.blockTargetRepository = blockTargetRepository;
        this.accountService = accountService;
        this.timeAuthority = timeAuthority;
    }

    @Transactional(readOnly = true)
    public List<BlockProfile> list(UUID accountId) {
        return blockProfileRepository.findByAccountId(accountId);
    }

    @Transactional
    public BlockProfile create(UUID accountId, String name, boolean enabled, String timeZone,
                               int cooldownMinutes, List<WindowSpec> windows) {
        Account account = accountService.require(accountId);
        BlockProfile profile = new BlockProfile(account, name, enabled, timeZone, cooldownMinutes,
                timeAuthority.now());
        profile.replaceWindows(buildWindows(profile, windows));
        blockProfileRepository.save(profile);
        accountService.bumpSyncVersion(accountId);
        return profile;
    }

    @Transactional
    public BlockProfile replace(UUID accountId, UUID profileId, String name, boolean enabled, String timeZone,
                                int cooldownMinutes, List<WindowSpec> windows) {
        BlockProfile profile = require(accountId, profileId);
        profile.rename(name, enabled, timeZone, timeAuthority.now());
        profile.applyCooldownChange(cooldownMinutes, timeAuthority.now());
        profile.replaceWindows(buildWindows(profile, windows));
        accountService.bumpSyncVersion(accountId);
        return profile;
    }

    @Transactional
    public void delete(UUID accountId, UUID profileId) {
        blockProfileRepository.delete(require(accountId, profileId));
        accountService.bumpSyncVersion(accountId);
    }

    @Transactional
    public BlockProfile replaceDeviceTargets(UUID accountId, Device device, UUID profileId, List<UUID> targetIds) {
        BlockProfile profile = require(accountId, profileId);
        List<BlockTarget> resolved = targetIds.isEmpty()
                ? List.of()
                : blockTargetRepository.findByDeviceIdAndIdIn(device.getId(), targetIds);
        if (resolved.size() != targetIds.size()) {
            throw new NotFoundException("alvo nao encontrado neste device");
        }
        Set<UUID> ownedByThisDevice = blockTargetRepository.findByDeviceId(device.getId()).stream()
                .map(BlockTarget::getId)
                .collect(Collectors.toSet());
        profile.getTargets().removeIf(target -> ownedByThisDevice.contains(target.getId()));
        profile.getTargets().addAll(resolved);
        accountService.bumpSyncVersion(accountId);
        return profile;
    }

    @Transactional(readOnly = true)
    public BlockProfile require(UUID accountId, UUID profileId) {
        return blockProfileRepository.findByIdAndAccountId(profileId, accountId)
                .orElseThrow(() -> new NotFoundException("perfil nao encontrado"));
    }

    private List<BlockWindow> buildWindows(BlockProfile profile, List<WindowSpec> specs) {
        List<BlockWindow> windows = new ArrayList<>();
        for (WindowSpec spec : specs) {
            if (spec.dayOfWeek() == null || spec.startTime() == null || spec.endTime() == null) {
                throw new ValidationException("janela precisa de dayOfWeek, startTime e endTime");
            }
            windows.add(new BlockWindow(profile, spec.dayOfWeek(), spec.startTime(), spec.endTime()));
        }
        return windows;
    }

    public record WindowSpec(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
    }
}
