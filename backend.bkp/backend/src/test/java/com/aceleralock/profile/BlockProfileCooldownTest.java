package com.aceleralock.profile;

import com.aceleralock.account.Account;
import com.aceleralock.auth.IdentityProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class BlockProfileCooldownTest {

    private static final Instant T0 = Instant.parse("2026-08-28T12:00:00Z");

    private BlockProfile profileWithCooldown(int minutes) {
        Account account = new Account(IdentityProvider.APPLE, "sub", null, T0);
        return new BlockProfile(account, "Foco", true, "America/Sao_Paulo", minutes, T0);
    }

    @Test
    @DisplayName("feliz: aumento de cooldown vale imediatamente")
    void increaseAppliesImmediately() {
        BlockProfile profile = profileWithCooldown(30);

        profile.applyCooldownChange(60, T0);

        assertThat(profile.effectiveCooldownMinutes(T0)).isEqualTo(60);
        assertThat(profile.getPendingCooldownMinutes()).isNull();
    }

    @Test
    @DisplayName("regressao: reducao de cooldown nao vale antes de decorrido o cooldown vigente")
    void decreaseDoesNotApplyBeforeCurrentCooldownElapses() {
        BlockProfile profile = profileWithCooldown(30);

        profile.applyCooldownChange(1, T0);

        assertThat(profile.effectiveCooldownMinutes(T0)).isEqualTo(30);
        assertThat(profile.effectiveCooldownMinutes(T0.plus(Duration.ofMinutes(29)))).isEqualTo(30);
        assertThat(profile.getPendingCooldownMinutes()).isEqualTo(1);
        assertThat(profile.getCooldownEffectiveAt()).isEqualTo(T0.plus(Duration.ofMinutes(30)));
    }

    @Test
    @DisplayName("feliz: reducao passa a valer depois de decorrido o cooldown vigente")
    void decreaseAppliesAfterCurrentCooldownElapses() {
        BlockProfile profile = profileWithCooldown(30);

        profile.applyCooldownChange(1, T0);

        assertThat(profile.effectiveCooldownMinutes(T0.plus(Duration.ofMinutes(30)))).isEqualTo(1);
    }

    @Test
    @DisplayName("regressao: reduzir varias vezes seguidas nao encurta a espera")
    void repeatedDecreasesDoNotShortcut() {
        BlockProfile profile = profileWithCooldown(60);

        profile.applyCooldownChange(1, T0);
        profile.applyCooldownChange(1, T0.plus(Duration.ofMinutes(10)));

        assertThat(profile.effectiveCooldownMinutes(T0.plus(Duration.ofMinutes(59)))).isEqualTo(60);
        assertThat(profile.getCooldownEffectiveAt()).isEqualTo(T0.plus(Duration.ofMinutes(70)));
    }

    @Test
    @DisplayName("borda: aumentar durante uma reducao pendente cancela a pendencia")
    void increaseCancelsPendingDecrease() {
        BlockProfile profile = profileWithCooldown(30);
        profile.applyCooldownChange(5, T0);

        profile.applyCooldownChange(90, T0.plus(Duration.ofMinutes(1)));

        assertThat(profile.getPendingCooldownMinutes()).isNull();
        assertThat(profile.effectiveCooldownMinutes(T0.plus(Duration.ofMinutes(1)))).isEqualTo(90);
    }
}
