package com.farmxchain;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;


@SpringBootApplication
@EnableAsync        // required by MailService.sendPasswordResetLink(...)
@EnableScheduling   // required by PasswordResetTokenCleanupTask
public class FarmxchainAuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(FarmxchainAuthApplication.class, args);
    }
}
