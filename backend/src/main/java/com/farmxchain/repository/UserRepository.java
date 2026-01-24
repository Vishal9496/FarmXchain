package com.farmxchain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.farmxchain.model.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}
