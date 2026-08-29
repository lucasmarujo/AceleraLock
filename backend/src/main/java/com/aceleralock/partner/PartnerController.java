package com.aceleralock.partner;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.unlock.UnlockRequestService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/partners")
public class PartnerController {

    private final PartnerService partnerService;
    private final UnlockRequestService unlockRequestService;

    public PartnerController(PartnerService partnerService, UnlockRequestService unlockRequestService) {
        this.partnerService = partnerService;
        this.unlockRequestService = unlockRequestService;
    }

    @PostMapping("/invites")
    public InviteResponse createInvite(@AuthenticationPrincipal Jwt jwt) {
        PartnerService.CreatedInvite invite =
                partnerService.createInvite(AuthenticatedCaller.from(jwt).accountId());
        return new InviteResponse(invite.code(), invite.expiresAt());
    }

    @PostMapping("/invites/{code}/accept")
    @Transactional
    public LinkResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable @NotBlank @Size(max = 16) String code) {
        PartnerLink link = partnerService.accept(AuthenticatedCaller.from(jwt).accountId(), code);
        return LinkResponse.of(link);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PartnersResponse list(@AuthenticationPrincipal Jwt jwt) {
        UUID accountId = AuthenticatedCaller.from(jwt).accountId();
        LinkResponse asOwner = partnerService.findActiveLinkOwnedBy(accountId)
                .map(LinkResponse::of)
                .orElse(null);
        List<LinkResponse> asPartner = partnerService.findActiveLinksWhereCallerIsPartner(accountId).stream()
                .map(LinkResponse::of)
                .toList();
        return new PartnersResponse(asOwner, asPartner);
    }

    @DeleteMapping("/{linkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID linkId) {
        partnerService.revoke(AuthenticatedCaller.from(jwt).accountId(), linkId);
    }

    @GetMapping("/unlock-requests")
    @Transactional(readOnly = true)
    public List<PendingRequestResponse> pendingRequests(@AuthenticationPrincipal Jwt jwt) {
        return unlockRequestService.pendingForPartner(AuthenticatedCaller.from(jwt).accountId()).stream()
                .map(request -> new PendingRequestResponse(request.getId(), request.getReason(),
                        request.getRequestedAt(), request.getCooldownEndsAt(), request.getUnilateralEndsAt(),
                        request.getApprovedAt()))
                .toList();
    }

    public record InviteResponse(String inviteCode, Instant expiresAt) {
    }

    public record LinkResponse(UUID linkId, UUID ownerAccountId, UUID partnerAccountId, String status,
                               Instant acceptedAt) {

        static LinkResponse of(PartnerLink link) {
            return new LinkResponse(link.getId(), link.getOwnerAccount().getId(),
                    link.getPartnerAccount() == null ? null : link.getPartnerAccount().getId(),
                    link.getStatus().name(), link.getAcceptedAt());
        }
    }

    public record PartnersResponse(LinkResponse asOwner, List<LinkResponse> asPartner) {
    }

    public record PendingRequestResponse(UUID requestId, String reason, Instant requestedAt,
                                         Instant cooldownEndsAt, Instant unilateralEndsAt, Instant approvedAt) {
    }
}
