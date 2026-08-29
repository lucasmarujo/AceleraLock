package com.aceleralock.time;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/v1/time")
public class ServerTimeController {

    private final TimeAuthority timeAuthority;

    public ServerTimeController(TimeAuthority timeAuthority) {
        this.timeAuthority = timeAuthority;
    }

    @GetMapping
    public ServerTimeResponse now() {
        return new ServerTimeResponse(timeAuthority.now());
    }

    public record ServerTimeResponse(Instant serverTime) {
    }
}
