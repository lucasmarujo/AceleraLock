package com.aceleralock.auth;

import com.aceleralock.config.IdentityProviderProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Component
public class TokenIssuer {

    public static final String CLAIM_DEVICE_ID = "did";
    public static final String CLAIM_SCOPE = "scp";
    public static final String ISSUER = "aceleralock";

    private final RSAKey signingKey;
    private final TimeAuthority timeAuthority;
    private final IdentityProviderProperties properties;

    public TokenIssuer(RSAKey signingKey, TimeAuthority timeAuthority, IdentityProviderProperties properties) {
        this.signingKey = signingKey;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    public String issueBootstrapToken(UUID accountId) {
        return sign(accountId, null, TokenScope.DEVICE_REGISTER, properties.bootstrapTokenTtl());
    }

    public String issueAccessToken(UUID accountId, UUID deviceId) {
        return sign(accountId, deviceId, TokenScope.API, properties.accessTokenTtl());
    }

    private String sign(UUID accountId, UUID deviceId, TokenScope scope, Duration ttl) {
        Instant now = timeAuthority.now();
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer(ISSUER)
                .subject(accountId.toString())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(ttl)))
                .claim(CLAIM_SCOPE, scope.claim());
        if (deviceId != null) {
            claims.claim(CLAIM_DEVICE_ID, deviceId.toString());
        }
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signingKey.getKeyID()).build(),
                claims.build());
        try {
            jwt.sign(new RSASSASigner(signingKey.toPrivateKey()));
        } catch (JOSEException exception) {
            throw new IllegalStateException("falha ao assinar token", exception);
        }
        return jwt.serialize();
    }
}
