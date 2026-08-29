package com.aceleralock.config;

import com.aceleralock.auth.TokenIssuer;
import com.aceleralock.auth.TokenScope;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate();
        } catch (Exception exception) {
            throw new IllegalStateException("falha ao gerar chave de assinatura", exception);
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
