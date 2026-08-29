package com.aceleralock.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;

@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer failOnUnknownPropertiesCustomizer() {
        return builder -> builder.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}
