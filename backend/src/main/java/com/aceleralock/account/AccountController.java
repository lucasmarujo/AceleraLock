package com.aceleralock.account;

import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.partner.PartnerService;
import com.aceleralock.push.PushDispatcher;
import com.aceleralock.push.PushNotificationType;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/v1/accounts")
public class AccountController {

    private final AccountRepository accountRepository;
    private final AccountService accountService;
    private final PartnerService partnerService;
    private final PushDispatcher pushDispatcher;
    private final AuditService auditService;

    public AccountController(AccountRepository accountRepository, AccountService accountService,
                             PartnerService partnerService, PushDispatcher pushDispatcher,
                             AuditService auditService) {
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.partnerService = partnerService;
        this.pushDispatcher = pushDispatcher;
        this.auditService = auditService;
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt) {
        UUID accountId = AuthenticatedCaller.from(jwt).accountId();
        accountService.require(accountId);

        List<UUID> counterpartIds = new ArrayList<>();
        partnerService.findActiveLinkOwnedBy(accountId)
                .map(link -> link.getPartnerAccount())
                .filter(Objects::nonNull)
                .ifPresent(counterpart -> counterpartIds.add(counterpart.getId()));
        partnerService.findActiveLinksWhereCallerIsPartner(accountId).stream()
                .map(link -> link.getOwnerAccount())
                .filter(Objects::nonNull)
                .forEach(counterpart -> counterpartIds.add(counterpart.getId()));

        partnerService.removeAllLinksOf(accountId);

        for (UUID counterpartId : counterpartIds) {
            Account counterpart = accountService.require(counterpartId);
            auditService.recordServerEvent(counterpart, null, AuditEventType.ACCOUNT_DELETED, null);
            pushDispatcher.notifyAccount(counterpart, PushNotificationType.ACCOUNT_DELETED, null);
        }

        accountRepository.deleteById(accountId);
    }
}
