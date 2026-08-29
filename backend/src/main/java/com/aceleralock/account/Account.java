package com.aceleralock.account;

import com.aceleralock.auth.IdentityProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account")
public class Account {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private IdentityProvider provider;

    @Column(name = "external_subject", nullable = false)
    private String externalSubject;

    private String email;

    @Column(name = "sync_version", nullable = false)
    private long syncVersion;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Account() {
    }

    public Account(IdentityProvider provider, String externalSubject, String email, Instant createdAt) {
        this.provider = provider;
        this.externalSubject = externalSubject;
        this.email = email;
        this.createdAt = createdAt;
        this.syncVersion = 0L;
    }

    public UUID getId() {
        return id;
    }

    public IdentityProvider getProvider() {
        return provider;
    }

    public String getExternalSubject() {
        return externalSubject;
    }

    public String getEmail() {
        return email;
    }

    public long getSyncVersion() {
        return syncVersion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
