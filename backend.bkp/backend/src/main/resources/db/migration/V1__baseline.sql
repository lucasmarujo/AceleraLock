CREATE TABLE account (
    id               UUID         PRIMARY KEY,
    provider         VARCHAR(16)  NOT NULL,
    external_subject VARCHAR(255) NOT NULL,
    email            VARCHAR(320),
    sync_version     BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_account_provider_subject UNIQUE (provider, external_subject)
);

CREATE TABLE device (
    id                UUID         PRIMARY KEY,
    account_id        UUID         NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    device_install_id VARCHAR(64)  NOT NULL,
    platform          VARCHAR(16)  NOT NULL,
    label             VARCHAR(80)  NOT NULL,
    time_zone         VARCHAR(64)  NOT NULL,
    app_version       VARCHAR(32)  NOT NULL,
    os_version        VARCHAR(32)  NOT NULL,
    status            VARCHAR(16)  NOT NULL,
    push_token        VARCHAR(512),
    push_provider     VARCHAR(16),
    registered_at     TIMESTAMPTZ  NOT NULL,
    last_seen_at      TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_device_account_install UNIQUE (account_id, device_install_id)
);

CREATE TABLE refresh_token (
    id           UUID        PRIMARY KEY,
    device_id    UUID        NOT NULL REFERENCES device (id) ON DELETE CASCADE,
    token_hash   BYTEA       NOT NULL,
    family_id    UUID        NOT NULL,
    successor_id UUID        REFERENCES refresh_token (id) ON DELETE SET NULL,
    issued_at    TIMESTAMPTZ NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_token_family ON refresh_token (family_id);

CREATE TABLE block_target (
    id         UUID         PRIMARY KEY,
    device_id  UUID         NOT NULL REFERENCES device (id) ON DELETE CASCADE,
    client_ref VARCHAR(64)  NOT NULL,
    label      VARCHAR(80),
    created_at TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_block_target_device_client_ref UNIQUE (device_id, client_ref)
);

CREATE TABLE block_profile (
    id                    UUID        PRIMARY KEY,
    account_id            UUID        NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    name                  VARCHAR(80) NOT NULL,
    enabled               BOOLEAN     NOT NULL,
    time_zone             VARCHAR(64) NOT NULL,
    cooldown_minutes         INTEGER     NOT NULL,
    pending_cooldown_minutes INTEGER,
    cooldown_effective_at    TIMESTAMPTZ NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_block_profile_account ON block_profile (account_id);

CREATE TABLE block_window (
    id          UUID        PRIMARY KEY,
    profile_id  UUID        NOT NULL REFERENCES block_profile (id) ON DELETE CASCADE,
    day_of_week VARCHAR(16) NOT NULL,
    start_time  TIME        NOT NULL,
    end_time    TIME        NOT NULL
);

CREATE INDEX ix_block_window_profile ON block_window (profile_id);

CREATE TABLE block_profile_target (
    profile_id UUID NOT NULL REFERENCES block_profile (id) ON DELETE CASCADE,
    target_id  UUID NOT NULL REFERENCES block_target (id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, target_id)
);

CREATE TABLE partner_link (
    id                 UUID        PRIMARY KEY,
    owner_account_id   UUID        NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    partner_account_id UUID        REFERENCES account (id) ON DELETE CASCADE,
    invite_code_hash   BYTEA       NOT NULL,
    invite_expires_at  TIMESTAMPTZ NOT NULL,
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL,
    accepted_at        TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ,
    CONSTRAINT uq_partner_link_invite_code UNIQUE (invite_code_hash)
);

CREATE UNIQUE INDEX uq_partner_link_owner_open
    ON partner_link (owner_account_id)
    WHERE status IN ('PENDING', 'ACTIVE');

CREATE INDEX ix_partner_link_partner ON partner_link (partner_account_id);

CREATE TABLE unlock_request (
    id                     UUID        PRIMARY KEY,
    account_id             UUID        NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    device_id              UUID        NOT NULL REFERENCES device (id) ON DELETE CASCADE,
    target_id              UUID        NOT NULL REFERENCES block_target (id) ON DELETE CASCADE,
    partner_link_id        UUID        REFERENCES partner_link (id) ON DELETE SET NULL,
    status                 VARCHAR(16) NOT NULL,
    reason                 VARCHAR(500),
    requested_at           TIMESTAMPTZ NOT NULL,
    cooldown_ends_at       TIMESTAMPTZ NOT NULL,
    unilateral_ends_at     TIMESTAMPTZ NOT NULL,
    approved_at            TIMESTAMPTZ,
    decided_by_account_id  UUID        REFERENCES account (id) ON DELETE SET NULL,
    granted_at             TIMESTAMPTZ,
    grant_ends_at          TIMESTAMPTZ,
    granted_unilaterally   BOOLEAN     NOT NULL DEFAULT FALSE,
    version                INTEGER     NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX uq_unlock_request_open
    ON unlock_request (device_id, target_id)
    WHERE status IN ('PENDING', 'GRANTED');

CREATE INDEX ix_unlock_request_partner_link ON unlock_request (partner_link_id);

CREATE TABLE audit_event (
    id              UUID        PRIMARY KEY,
    account_id      UUID        NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    device_id       UUID        REFERENCES device (id) ON DELETE CASCADE,
    client_event_id UUID,
    source          VARCHAR(16) NOT NULL,
    type            VARCHAR(48) NOT NULL,
    occurred_at     TIMESTAMPTZ,
    received_at     TIMESTAMPTZ NOT NULL,
    target_id       UUID        REFERENCES block_target (id) ON DELETE SET NULL,
    details         JSONB
);

CREATE UNIQUE INDEX uq_audit_event_device_client
    ON audit_event (device_id, client_event_id)
    WHERE client_event_id IS NOT NULL;

CREATE INDEX ix_audit_event_account_received ON audit_event (account_id, received_at DESC);
