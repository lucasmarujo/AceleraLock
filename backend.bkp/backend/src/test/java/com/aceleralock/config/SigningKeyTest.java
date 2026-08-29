package com.aceleralock.config;

import com.nimbusds.jose.jwk.RSAKey;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SigningKeyTest {

    private static final String PROFILE_PROD = "prod";

    private final SecurityConfig securityConfig = new SecurityConfig();

    @Test
    @DisplayName("feliz: duas instancias que leem o mesmo PEM produzem a mesma chave e o mesmo kid")
    void sameFileYieldsSameKeyOnBothColors(@TempDir Path directory) throws Exception {
        Path pem = writePem(directory);

        RSAKey blue = securityConfig.signingKey(propertiesWith(pem.toString()), new MockEnvironment());
        RSAKey green = securityConfig.signingKey(propertiesWith(pem.toString()), new MockEnvironment());

        assertThat(blue.getKeyID()).isEqualTo(green.getKeyID());
        assertThat(blue.toRSAPublicKey().getModulus()).isEqualTo(green.toRSAPublicKey().getModulus());
        assertThat(blue.toPrivateKey()).isNotNull();
    }

    @Test
    @DisplayName("erro: perfil prod sem caminho de chave falha no boot em vez de gerar em silencio")
    void productionWithoutKeyPathFailsToBoot() {
        MockEnvironment production = new MockEnvironment();
        production.setActiveProfiles(PROFILE_PROD);

        assertThatThrownBy(() -> securityConfig.signingKey(propertiesWith(null), production))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("signing-key-path");
    }

    @Test
    @DisplayName("borda: fora de prod e sem caminho, a chave e gerada em memoria como no desenvolvimento")
    void developmentWithoutKeyPathGeneratesInMemory() throws Exception {
        RSAKey generated = securityConfig.signingKey(propertiesWith(" "), new MockEnvironment());

        assertThat(generated.getKeyID()).isNotBlank();
        assertThat(generated.toPrivateKey()).isNotNull();
    }

    @Test
    @DisplayName("erro: caminho apontando para arquivo ilegivel falha no boot")
    void unreadableKeyPathFailsToBoot(@TempDir Path directory) throws Exception {
        Path broken = directory.resolve("quebrada.pem");
        Files.writeString(broken, "isto nao e uma chave");

        assertThatThrownBy(() -> securityConfig.signingKey(propertiesWith(broken.toString()), new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("falha ao carregar chave de assinatura");
    }

    private IdentityProviderProperties propertiesWith(String signingKeyPath) {
        return new IdentityProviderProperties(Map.of(), Duration.ofMinutes(5), Duration.ofMinutes(15),
                Duration.ofDays(60), signingKeyPath);
    }

    private Path writePem(Path directory) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();
        String body = Base64.getMimeEncoder().encodeToString(pair.getPrivate().getEncoded());
        Path pem = directory.resolve("assinatura.pem");
        Files.writeString(pem, "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n");
        return pem;
    }
}
