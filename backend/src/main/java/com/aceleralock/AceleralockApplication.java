package com.aceleralock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AceleralockApplication {

    public static void main(String[] args) {
        SpringApplication.run(AceleralockApplication.class, args);
    }
}
