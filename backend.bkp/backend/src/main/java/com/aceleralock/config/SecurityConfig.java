package com.aceleralock.config;

import com.aceleralock.auth.TokenIssuer;
import com.aceleralock.auth.TokenScope;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private static final String PROFILE_PROD = "prod";
    private static final int GENERATED_KEY_SIZE = 2048;
    private static final String PEM_HEADER = "-----BEGIN PRIVATE KEY-----";
    private static final String PEM_FOOTER = "-----END PRIVATE KEY-----";
    private static final String KEY_ALGORITHM = "RSA";

    @Bean
    public RSAKey signingKey(IdentityProviderProperties properties, Environment environment) {
        String path = properties.signingKeyPath();
        if (path == null || path.isBlank()) {
            if (environment.matchesProfiles(PROFILE_PROD)) {
                throw new IllegalStateException(
                        "aceleralock.auth.signing-key-path e obrigatorio no perfil " + PROFILE_PROD);
            }
            log.warn("chave de assinatura gerada em memoria: todo token morre no restart e nao vale entre instancias");
            return generateSigningKey();
        }
        return loadSigningKey(Path.of(path));
    }

    private RSAKey generateSigningKey() {
        try {
            return new RSAKeyGenerator(GENERATED_KEY_SIZE).keyIDFromThumbprint(true).generate();
        } catch (Exception exception) {
            throw new IllegalStateException("falha ao gerar chave de assinatura", exception);
        }
    }

    private RSAKey loadSigningKey(Path path) {
        try {
            String pem = Files.readString(path, StandardCharsets.UTF_8);
            byte[] der = Base64.getMimeDecoder().decode(pem
                    .replace(PEM_HEADER, "")
                    .replace(PEM_FOOTER, ""));
            KeyFactory factory = KeyFactory.getInstance(KEY_ALGORITHM);
            RSAPrivateCrtKey privateKey = (RSAPrivateCrtKey) factory.generatePrivate(new PKCS8EncodedKeySpec(der));
            RSAPublicKey publicKey = (RSAPublicKey) factory.generatePublic(
                    new RSAPublicKeySpec(privateKey.getModulus(), privateKey.getPublicExponent()));
            return new RSAKey.Builder(publicKey).privateKey(privateKey).keyIDFromThumbprint().build();
        } catch (Exception exception) {
            throw new IllegalStateException("falha ao carregar chave de assinatura de " + path, exception);
        }
    }

    @Bean
    public JwtDecoder jwtDecoder(RSAKey signingKey, java.time.Clock clock) {
        try {
            NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withPublicKey((RSAPublicKey) signingKey.toPublicKey()).build();
            org.springframework.security.oauth2.jwt.JwtTimestampValidator timestamps =
                    new org.springframework.security.oauth2.jwt.JwtTimestampValidator();
            timestamps.setClock(clock);
            decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                    timestamps,
                    new org.springframework.security.oauth2.jwt.JwtIssuerValidator(TokenIssuer.ISSUER)));
            return decoder;
        } catch (Exception exception) {
            throw new IllegalStateException("falha ao construir decoder", exception);
        }
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthorityPrefix("SCOPE_");
        authorities.setAuthoritiesClaimName(TokenIssuer.CLAIM_SCOPE);
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationConverter converter)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.POST, "/v1/auth/sessions", "/v1/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/v1/devices")
                                .hasAuthority("SCOPE_" + TokenScope.DEVICE_REGISTER.claim())
                        .anyRequest().hasAuthority("SCOPE_" + TokenScope.API.claim()))
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)));
        return http.build();
    }
}
