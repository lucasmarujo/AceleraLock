package com.aceleralock;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountRepository;
import com.aceleralock.auth.AuthService;
import com.aceleralock.auth.IdentityProvider;
import com.aceleralock.auth.IdentityTokenVerifier;
import com.aceleralock.device.Device;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.device.DeviceRepository;
import com.aceleralock.device.DeviceService;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(AbstractIntegrationTest.TestClockConfiguration.class)
public abstract class AbstractIntegrationTest {

    protected static final Instant T0 = Instant.parse("2026-08-28T12:00:00Z");

    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    static {
        POSTGRES.start();
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected MutableClock clock;

    @Autowired
    protected AccountRepository accountRepository;

    @Autowired
    protected DeviceRepository deviceRepository;

    @Autowired
    protected DeviceService deviceService;

    @Autowired
    protected AuthService authService;

    @Autowired
    protected com.aceleralock.auth.TokenIssuer tokenIssuer;

    @MockitoBean
    protected IdentityTokenVerifier identityTokenVerifier;

    @BeforeEach
    void resetClock() {
        clock.set(T0);
    }

    protected String json(Object value) {
        return objectMapper.writeValueAsString(value);
    }

    protected String bearer(String token) {
        return "Bearer " + token;
    }

    protected String freshBearer(AuthService.DeviceSession session) {
        return bearer(tokenIssuer.issueAccessToken(session.accountId(), session.deviceId()));
    }

    protected Account newAccount(String subject) {
        when(identityTokenVerifier.verify(any(IdentityProvider.class), anyString()))
                .thenReturn(new IdentityTokenVerifier.VerifiedIdentity(subject, subject + "@example.com"));
        return accountRepository.findByProviderAndExternalSubject(IdentityProvider.APPLE, subject)
                .orElseGet(() -> accountRepository.save(
                        new Account(IdentityProvider.APPLE, subject, subject + "@example.com", clock.instant())));
    }

    @Transactional
    protected Device newDevice(Account account, String installId, DevicePlatform platform) {
        return deviceService.register(account, installId, platform, "Aparelho " + installId,
                "America/Sao_Paulo", "1.0.0", "18.0");
    }

    public static class MutableClock extends Clock {

        private Instant instant = T0;

        public void set(Instant value) {
            this.instant = value;
        }

        public void advance(Duration duration) {
            this.instant = this.instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }

    @TestConfiguration
    public static class TestClockConfiguration {

        @Bean
        public MutableClock clock() {
            return new MutableClock();
        }
    }
}
