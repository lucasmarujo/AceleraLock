package com.aceleralock.auth;

import com.aceleralock.config.IdentityProviderProperties;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class IdentityTokenVerifier {

    private final IdentityProviderProperties properties;
    private final Map<IdentityProvider, JwtDecoder> decoders = new ConcurrentHashMap<>();

    public IdentityTokenVerifier(IdentityProviderProperties properties) {
        this.properties = properties;
    }

    public VerifiedIdentity verify(IdentityProvider provider, String idToken) {
        IdentityProviderProperties.ProviderSettings settings = properties.providers().get(provider);
        if (settings == null) {
            throw new JwtException("provedor de identidade nao configurado: " + provider);
        }
        Jwt jwt = decoders.computeIfAbsent(provider, key -> buildDecoder(settings)).decode(idToken);
        String subject = jwt.getClaimAsString(JwtClaimNames.SUB);
        if (subject == null || subject.isBlank()) {
            throw new JwtException("id_token sem subject");
        }
        return new VerifiedIdentity(subject, jwt.getClaimAsString("email"));
    }

    private JwtDecoder buildDecoder(IdentityProviderProperties.ProviderSettings settings) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(settings.jwkSetUri()).build();
        OAuth2TokenValidator<Jwt> validator = settings.audience() == null
                ? JwtValidators.createDefaultWithIssuer(settings.issuer())
                : JwtValidators.createDefaultWithValidators(
                        new org.springframework.security.oauth2.core.OAuth2TokenValidator<>() {
                            @Override
                            public org.springframework.security.oauth2.core.OAuth2TokenValidatorResult validate(Jwt token) {
                                boolean matches = token.getAudience() != null
                                        && token.getAudience().contains(settings.audience());
                                return matches
                                        ? org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success()
                                        : org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure();
                            }
                        },
                        JwtValidators.createDefaultWithIssuer(settings.issuer()));
        decoder.setJwtValidator(validator);
        return decoder;
    }

    public record VerifiedIdentity(String subject, String email) {
    }
}
