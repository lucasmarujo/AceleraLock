package com.aceleralock.account;

import com.aceleralock.auth.IdentityProvider;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final TimeAuthority timeAuthority;

    public AccountService(AccountRepository accountRepository, TimeAuthority timeAuthority) {
        this.accountRepository = accountRepository;
        this.timeAuthority = timeAuthority;
    }

    @Transactional
    public Account findOrCreate(IdentityProvider provider, String externalSubject, String email) {
        return accountRepository.findByProviderAndExternalSubject(provider, externalSubject)
                .orElseGet(() -> accountRepository.save(
                        new Account(provider, externalSubject, email, timeAuthority.now())));
    }

    @Transactional(readOnly = true)
    public Account require(UUID accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new NotFoundException("conta nao encontrada"));
    }

    @Transactional
    public void bumpSyncVersion(UUID accountId) {
        accountRepository.incrementSyncVersion(accountId);
    }

    @Transactional(readOnly = true)
    public long currentSyncVersion(UUID accountId) {
        return accountRepository.findSyncVersion(accountId);
    }
}
