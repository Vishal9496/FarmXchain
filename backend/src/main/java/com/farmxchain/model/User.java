package com.farmxchain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;
    private String email;
    private String password;
    private String role;  
    private String name; 


    // ✅ Constructors
    public User() {}

    public User(String username, String password, String role, String email, String name) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.email = email;
        this.name = name;
    }

    // ✅ Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * ✅ SECURITY (P0-3): {@code @JsonIgnore} on the GETTER makes the password WRITE-ONLY to
     * Jackson. The BCrypt hash can never be serialised into an HTTP response, even if a future code
     * path returns a raw User entity by mistake.
     *
     * <p>It is deliberately NOT placed on the field. A field-level {@code @JsonIgnore} suppresses
     * BOTH directions, which would stop Jackson binding the password out of the login and
     * registration request bodies and break authentication entirely. Annotating the getter with
     * {@code @JsonIgnore} and the setter with {@code @JsonProperty} is Jackson's documented way to
     * split a property into write-only.
     */
    @JsonIgnore
    public String getPassword() {
        return password;
    }

    /**
     * ✅ SECURITY (P0-3): {@code @JsonProperty} re-enables DESERIALISATION only. Without it, Jackson
     * would treat the whole property as ignored because of the annotation on the getter, and
     * {@code @RequestBody User} in login/register would silently receive a null password.
     */
    @JsonProperty("password")
    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
