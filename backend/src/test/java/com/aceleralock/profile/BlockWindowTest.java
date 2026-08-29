package com.aceleralock.profile;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class BlockWindowTest {

    private BlockWindow window(String start, String end) {
        return new BlockWindow(null, DayOfWeek.MONDAY, LocalTime.parse(start), LocalTime.parse(end));
    }

    @Test
    @DisplayName("feliz: janela normal cobre o intervalo e exclui o fim")
    void normalWindow() {
        BlockWindow window = window("08:00", "12:00");

        assertThat(window.wrapsMidnight()).isFalse();
        assertThat(window.covers(LocalTime.parse("08:00"))).isTrue();
        assertThat(window.covers(LocalTime.parse("11:59"))).isTrue();
        assertThat(window.covers(LocalTime.parse("12:00"))).isFalse();
        assertThat(window.covers(LocalTime.parse("07:59"))).isFalse();
    }

    @Test
    @DisplayName("borda: janela 22:00-06:00 cruza a meia-noite")
    void wrappingWindow() {
        BlockWindow window = window("22:00", "06:00");

        assertThat(window.wrapsMidnight()).isTrue();
        assertThat(window.covers(LocalTime.parse("23:30"))).isTrue();
        assertThat(window.covers(LocalTime.parse("00:30"))).isTrue();
        assertThat(window.covers(LocalTime.parse("05:59"))).isTrue();
        assertThat(window.covers(LocalTime.parse("06:00"))).isFalse();
        assertThat(window.covers(LocalTime.parse("12:00"))).isFalse();
    }

    @Test
    @DisplayName("borda: inicio igual ao fim cobre o dia inteiro")
    void fullDayWindow() {
        BlockWindow window = window("00:00", "00:00");

        assertThat(window.covers(LocalTime.parse("00:00"))).isTrue();
        assertThat(window.covers(LocalTime.parse("13:37"))).isTrue();
        assertThat(window.covers(LocalTime.parse("23:59"))).isTrue();
    }
}
