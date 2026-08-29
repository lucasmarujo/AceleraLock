package com.aceleralock.auth;

import com.aceleralock.config.DeviceAccessGuard;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final DeviceAccessGuard deviceAccessGuard;

    public AuthController(AuthService authService, RefreshTokenService refreshTokenService,
                          DeviceAccessGuard deviceAccessGuard) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
        this.deviceAccessGuard = deviceAccessGuard;
    }

    @PostMapping("/sessions")
    public AuthService.BootstrapSession createSession(@Valid @RequestBody CreateSessionRequest request) {
        return authService.startSession(request.provider(), request.idToken());
    }

    @PostMapping("/refresh")
    public AuthService.DeviceSession refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @DeleteMapping("/sessions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt) {
        AuthenticatedCaller caller = AuthenticatedCaller.from(jwt);
        refreshTokenService.revokeDevice(deviceAccessGuard.require(caller, caller.deviceId()));
    }

    @ExceptionHandler(JwtException.class)
    public ProblemDetail handleJwt(JwtException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    public record CreateSessionRequest(@NotNull IdentityProvider provider, @NotBlank String idToken) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }
}
