package com.farmxchain.controller;

import com.farmxchain.model.Product;
import com.farmxchain.model.User;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.service.ProductService;
import com.farmxchain.service.ImageUploadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * ✅ SECURITY-CRITICAL: Product Controller
 *
 * Handles products (vegetables) in the supply chain.
 *
 * ✅ SECURITY (P0-11): every method that used to accept
 * {@code @RequestHeader("Authorization") String authHeader} and manually strip
 * the "Bearer " prefix, call {@code jwtUtil.extractEmail}/{@code extractRole},
 * and compare the result against a role string now instead declares
 * {@code @PreAuthorize(...)} for the role gate and takes {@code Authentication}
 * for identity. No method in this file has any remaining need to parse a raw
 * token, so the {@code JwtUtil} field is removed entirely along with every
 * manual parse it used to support.
 */
@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "http://localhost:3000")
public class ProductController {

    @Autowired
    private ProductService productService;

    @Autowired
    private ImageUploadService imageUploadService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get all products.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/all")
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(productService.getAllProducts());
    }

    /**
     * ✅ CUSTOMER: Get all available products (status = AVAILABLE or NULL)
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/customer/products")
    public ResponseEntity<List<Product>> getAvailableProductsForCustomers() {
        System.out.println("[API] /customer/products endpoint called");
        List<Product> products = productService.getAvailableProducts();
        System.out.println("[API] Customer products response size = " + (products == null ? 0 : products.size()));
        return ResponseEntity.ok(products);
    }

    /**
     * ✅ MARKETPLACE: Get ALL products for full marketplace view (testing)
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/marketplace/products")
    public ResponseEntity<List<Product>> getAllMarketplaceProducts() {
        System.out.println("[API] /marketplace/products endpoint called");
        List<Product> products = productService.getMarketplaceProducts();
        System.out.println("[API] Marketplace products response size = " + (products == null ? 0 : products.size()));
        return ResponseEntity.ok(products);
    }

    /**
     * ✅ FARMER: Get products created by specific farmer. Farmer can only see
     * their own products; admin can see any farmer's.
     */
    @PreAuthorize("hasAnyRole('FARMER','ADMIN')")
    @GetMapping("/farmer/{farmerId}")
    public ResponseEntity<?> getProductsByFarmer(@PathVariable Long farmerId,
                                                 Authentication authentication) {

        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        if (!isAdmin) {
            Optional<User> callerOpt = userRepository.findByEmail(authentication.getName());
            if (callerOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Account not found"));
            }
            if (!callerOpt.get().getId().equals(farmerId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "You can only view your own products"));
            }
        }

        List<Product> products = productService.getProductsByFarmer(farmerId);
        return ResponseEntity.ok(products);
    }

    /**
     * ✅ CRITICAL: RETAILER Dashboard - Get products assigned to retailer.
     *
     * ✅ SECURITY (P0-11): previously this method took the raw Authorization
     * header, manually validated the "Bearer " prefix, called
     * {@code jwtUtil.extractEmail}/{@code extractRole}, re-implemented the exact
     * role check {@code @PreAuthorize("hasRole('RETAILER')")} already performed,
     * and wrapped all of it in a {@code try/catch (Exception e)} that mapped
     * every possible failure — including a genuinely malformed header — to a
     * single generic 401. None of that remains: {@code Authentication} supplies
     * the verified identity directly, and an authentication/authorization
     * failure is now handled uniformly by {@code SecurityConfig}'s
     * {@code AuthenticationEntryPoint}/{@code AccessDeniedHandler} (added under
     * P0-5) rather than by a bespoke catch block in this one method.
     */
    @PreAuthorize("hasRole('RETAILER')")
    @GetMapping("/retailer/inventory")
    public ResponseEntity<?> getRetailerInventory(Authentication authentication) {

        Optional<User> userOpt = userRepository.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "User not found"));
        }

        User retailer = userOpt.get();
        Long retailerId = retailer.getId();

        List<Product> products = productService.getProductsByRetailer(retailerId);

        return ResponseEntity.ok(Map.of(
                "retailerId", retailerId,
                "retailerName", retailer.getName(),
                "products", products,
                "count", products.size()
        ));
    }

    /**
     * ✅ CRITICAL: FARMER adds a product.
     *
     * ✅ SECURITY (P0-11): the manual "extract token, extract email, look up
     * user" block that used to open this method is gone. {@code @PreAuthorize}
     * guarantees the caller holds {@code ROLE_FARMER} before this method body
     * runs at all; {@code Authentication.getName()} supplies the caller's email
     * directly from the already-verified {@code SecurityContext}, exactly as in
     * {@link #getRetailerInventory} above.
     */
    @PreAuthorize("hasRole('FARMER')")
    @PostMapping("/add")
    public ResponseEntity<?> addProduct(
            @RequestParam("image") MultipartFile image,
            @RequestParam("cropType") String cropType,
            @RequestParam("soilType") String soilType,
            @RequestParam("pesticides") String pesticides,
            @RequestParam("harvestDate") String harvestDate,
            @RequestParam("latitude") String latitude,
            @RequestParam("longitude") String longitude,
            Authentication authentication
    ) {
        try {
            Optional<User> userOpt = userRepository.findByEmail(authentication.getName());
            if (!userOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "User not found"));
            }

            User user = userOpt.get();
            Long userId = user.getId();

            // ✅ BACKEND LOGIC: the authenticated FARMER is the producer.
            // @PreAuthorize("hasRole('FARMER')") guarantees the caller holds that role.
            Long farmerId = userId;

            Long retailerId = determineRetailerForProduct(farmerId, cropType);

            if (retailerId == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "No retailer available for this product"));
            }

            Optional<User> retailerOpt = userRepository.findById(retailerId);
            if (!retailerOpt.isPresent() || !"retailer".equalsIgnoreCase(retailerOpt.get().getRole())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Invalid retailer assignment"));
            }

            String imageUrl = imageUploadService.uploadImage(image);

            Product product = new Product();
            product.setCropType(cropType);
            product.setSoilType(soilType);
            product.setPesticides(pesticides);
            product.setHarvestDate(harvestDate);
            product.setLatitude(Double.parseDouble(latitude));
            product.setLongitude(Double.parseDouble(longitude));
            product.setImageUrl(imageUrl);
            product.setFarmerId(farmerId);
            product.setRetailerId(retailerId);

            Product savedProduct = productService.addProduct(product, retailerId);

            System.out.println("[AUDIT] Product created: farmer=" + farmerId
                    + ", retailer=" + retailerId + ", cropType=" + cropType);

            return ResponseEntity.ok(Map.of(
                    "message", "Product added successfully",
                    "product", savedProduct,
                    "farmerId", farmerId,
                    "retailerName", retailerOpt.get().getName()
            ));

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Image upload failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Error creating product: " + e.getMessage()));
        }
    }

    /**
     * ✅ BACKEND LOGIC: Determine which retailer should get this product.
     */
    private Long determineRetailerForProduct(Long farmerId, String cropType) {
        List<User> retailers = userRepository.findAll();

        for (User user : retailers) {
            if ("retailer".equalsIgnoreCase(user.getRole())) {
                return user.getId();
            }
        }

        return null; // No retailer available
    }
}
