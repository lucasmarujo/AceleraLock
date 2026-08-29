package com.aceleralock.time;

import com.aceleralock.config.UnlockProperties;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;

@Component
public class TimeAuthority {

    public static final String SERVER_TIME_HEADER = "X-Aceleralock-Server-Time";
    public static final String DEVICE_TIME_HEADER = "X-Aceleralock-Device-Time";
    public static final String CLOCK_SKEW_HEADER = "X-Aceleralock-Clock-Skew-Seconds";

    private final Clock clock;
    private final UnlockProperties properties;

    public TimeAuthority(Clock clock, UnlockProperties properties) {
        this.clock = clock;
        this.properties = properties;
    }

    public Instant now() {
        return clock.instant();
    }

    public long skewSeconds(String deviceTimeHeader) {
        if (deviceTimeHeader == null || deviceTimeHeader.isBlank()) {
            return 0L;
        }
        try {
            return Duration.between(now(), Instant.parse(deviceTimeHeader)).getSeconds();
        } catch (DateTimeParseException exception) {
            return 0L;
        }
    }

    public boolean isSkewSuspicious(long skewSeconds) {
        return Math.abs(skewSeconds) > properties.clockSkewThreshold().getSeconds();
    }
}
