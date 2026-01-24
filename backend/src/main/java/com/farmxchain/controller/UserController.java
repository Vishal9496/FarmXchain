package com.farmxchain.controller;

import com.farmxchain.model.User;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.security.JwtUtil;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // Test endpoint
    @GetMapping("/test")
    public String testApi() {
        return "Welcome to FarmXChain Auth!";
    }

    // Register user with hashed password
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                 .body(Map.of("message", "Email already exists!"));
        }

        if (user.getUsername() == null || user.getUsername().isEmpty()) {
            String generatedUsername = user.getName().toLowerCase().replaceAll("\\s+", "") + System.currentTimeMillis();
            user.setUsername(generatedUsername);
        }

        // ✅ SECURITY: STRICTLY enforce valid roles during registration
        // Only allow: farmer, distributor, retailer, customer
        String requestedRole = user.getRole();
        String validRole = "customer"; // default

        if (requestedRole != null && !requestedRole.isEmpty()) {
            String roleUpper = requestedRole.toUpperCase();
            // Only whitelist frontend-allowed roles
            if ("FARMER".equals(roleUpper)) {
                validRole = "farmer";
            } else if ("DISTRIBUTOR".equals(roleUpper)) {
                validRole = "distributor";
            } else if ("RETAILER".equals(roleUpper)) {
                validRole = "retailer";
            } else if ("CUSTOMER".equals(roleUpper)) {
                validRole = "customer";
            } else {
                // Any other role (including "admin") defaults to customer
                System.out.println("[SECURITY] Attempted role registration: " + requestedRole + " → defaulted to customer");
                validRole = "customer";
            }
        }

        user.setRole(validRole);

        // Hash password before saving
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "User registered successfully!", "user", user));
    }

    // Login user (with fallback for old plain passwords)
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody User loginData) {
        String requestedRole = loginData.getRole();
        if (requestedRole == null || requestedRole.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Role is required for login"));
        }

        Optional<User> userOpt = userRepository.findByEmail(loginData.getEmail());

        if (userOpt.isPresent()) {
            User user = userOpt.get();

            String rawPassword = loginData.getPassword();
            String storedPassword = user.getPassword();

            boolean matchesHashed = passwordEncoder.matches(rawPassword, storedPassword);
            boolean matchesPlainLegacy = rawPassword != null && rawPassword.equals(storedPassword);

            if (matchesHashed || matchesPlainLegacy) {
                // ✅ SECURITY: Verify requested role matches the user's actual role
                if (user.getRole() == null || !user.getRole().equalsIgnoreCase(requestedRole)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Role mismatch for this account. Please select your assigned role."));
                }

                // Upgrade legacy plain-text password to hashed if needed
                if (matchesPlainLegacy && !matchesHashed) {
                    user.setPassword(passwordEncoder.encode(rawPassword));
                    userRepository.save(user);
                }

                // ✅ SECURITY: Generate token from DATABASE role only
                String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
                return ResponseEntity.ok(Map.of(
                    "message", "Login successful!",
                    "user", user,
                    "token", token
                ));
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                             .body(Map.of("message", "Invalid email or password!"));
    }

    // Admin-only: Get all users (passwords included)
    @GetMapping("/all-with-passwords")
    public ResponseEntity<?> getAllUsersWithPasswords(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String requesterRole = jwtUtil.extractRole(token);

        if (!"admin".equalsIgnoreCase(requesterRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Access denied. Admins only."));
        }

        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    // Admin-only: Update user role
    @PutMapping("/{id}/role")
    public ResponseEntity<?> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        String requesterRole = jwtUtil.extractRole(token);

        if (!"admin".equalsIgnoreCase(requesterRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Access denied. Admins only."));
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(Map.of("message", "User not found!"));
        }

        User user = userOpt.get();

        // Prevent editing admin role
        if (user.getRole().equalsIgnoreCase("admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Admin role cannot be changed!"));
        }

        String role = body.get("role");
        if (role.equalsIgnoreCase("admin")) role = "customer"; // prevent escalation

        user.setRole(role);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Role updated successfully!", "user", user));
    }

    // Admin-only: Delete user
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        String requesterRole = jwtUtil.extractRole(token);

        if (!"admin".equalsIgnoreCase(requesterRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Access denied. Admins only."));
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(Map.of("message", "User not found!"));
        }

        User user = userOpt.get();

        if (user.getRole().equalsIgnoreCase("admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Admin user cannot be deleted!"));
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully!"));
    }

}
