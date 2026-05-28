package com.mathlabpro;

import com.mathlabpro.config.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class MathLabProApplication {

    public static void main(String[] args) {
        SpringApplication.run(MathLabProApplication.class, args);
    }
}
