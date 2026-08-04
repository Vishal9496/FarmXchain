package com.farmxchain.security;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // ✅ For @PreAuthorize, @PostAuthorize, etc.
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, ObjectMapper objectMapper) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // Disable CSRF for APIs

            // ✅ SECURITY (P0-5): STATELESS. Without this Spring Security still creates an
            // HttpSession for every request, which defeats the point of a stateless JWT design,
            // consumes memory, and would require sticky sessions behind a load balancer.
            .sessionManagement(session ->
                    session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ✅ SECURITY (P0-5): correct status codes.
            //   No/invalid credentials -> 401 Unauthorized  (client should log in)
            //   Valid credentials, wrong role -> 403 Forbidden (logging in again will not help)
            // Without an entry point Spring returns 403 for BOTH cases, so the frontend cannot
            // tell "your session expired" apart from "you are not allowed here".
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint(restAuthenticationEntryPoint())
                    .accessDeniedHandler(restAccessDeniedHandler()))

            .authorizeHttpRequests(auth -> auth
                // ---------------------------------------------------------------
                // PUBLIC — authentication endpoints only
                // ---------------------------------------------------------------
                .requestMatchers(HttpMethod.POST,
                    "/api/users/login",
                    "/api/users/register",
                    "/api/auth/forgot-password",
                    "/api/auth/reset-password"
                ).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/users/test").permitAll()

                // ---------------------------------------------------------------
                // ✅ SECURITY (P0-5): "/api/products/**" and "/api/ai/**" REMOVED from permitAll.
                //
                // Previously every product endpoint — including POST /api/products/add and
                // GET /api/products/farmer/{id} — was reachable with no credentials at all, and
                // POST /api/ai/quality-check let anyone on the internet spend the Gemini quota.
                //
                // Fine-grained role rules live on the controller methods as @PreAuthorize.
                // These matchers are the coarse backstop: nothing gets through unauthenticated.
                // ---------------------------------------------------------------
                .requestMatchers("/api/ai/**").authenticated()
                .requestMatchers("/api/products/**").authenticated()

                // ---------------------------------------------------------------
                // ADMIN
                // ---------------------------------------------------------------
                .requestMatchers(HttpMethod.GET, "/api/users").hasRole("ADMIN")
                .requestMatchers("/api/users/*/role").hasRole("ADMIN")
                .requestMatchers("/api/users/*").hasRole("ADMIN")
                .requestMatchers("/admin/**").hasRole("ADMIN")

                // Everything else needs a valid token.
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * ✅ SECURITY (P0-5): returns 401 + JSON when a request carries no credentials, or credentials
     * that are missing/expired/invalid.
     *
     * <p>The body shape matches every other error in the API ({@code message}), so the existing
     * axios interceptors and {@code error.response.data.message} reads keep working.
     */
    @Bean
    public AuthenticationEntryPoint restAuthenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);   // 401
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("timestamp", Instant.now().toString());
            body.put("status", 401);
            body.put("error", "Unauthorized");
            body.put("message", "Authentication required. Please sign in again.");
            body.put("path", request.getRequestURI());

            objectMapper.writeValue(response.getOutputStream(), body);
        };
    }

    /**
     * ✅ SECURITY (P0-5): returns 403 + JSON when the caller IS authenticated but lacks the role.
     * Also catches {@code AccessDeniedException} thrown by {@code @PreAuthorize}.
     */
    @Bean
    public AccessDeniedHandler restAccessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);       // 403
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("timestamp", Instant.now().toString());
            body.put("status", 403);
            body.put("error", "Forbidden");
            body.put("message", "You do not have permission to perform this action.");
            body.put("path", request.getRequestURI());

            objectMapper.writeValue(response.getOutputStream(), body);
        };
    }

    // Password hashing
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Authentication Manager
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    // ✅ CORS configuration bean
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:3000"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
