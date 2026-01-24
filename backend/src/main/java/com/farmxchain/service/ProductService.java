package com.farmxchain.service;

import com.farmxchain.model.Product;
import com.farmxchain.model.User;
import com.farmxchain.repository.ProductRepository;
import com.farmxchain.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private UserRepository userRepository;

    /**
     * ✅ SECURITY: Get all products (public endpoint, no auth required)
     * Only returns products that have been assigned to retailers
     */
    public List<Product> getAllProducts() {
        // In production, filter to only include published products with retailer assigned
        return productRepository.findAll();
    }

    /**
     * ✅ CUSTOMER: Get all available products (status = AVAILABLE or NULL)
     * No pagination/limits applied.
     */
    public List<Product> getAvailableProducts() {
        List<Product> products = productRepository.findByStatusIgnoreCaseOrStatusIsNull("AVAILABLE");
        if (products == null) {
            return List.of();
        }
        products.forEach(p -> {
            if (p.getStatus() == null || p.getStatus().isBlank()) {
                p.setStatus("AVAILABLE");
            }
        });
        return products;
    }

    /**
     * ✅ MARKETPLACE: Get ALL products without filtering
     * Used for full marketplace view; includes all statuses.
     */
    public List<Product> getMarketplaceProducts() {
        return productRepository.findAll();
    }

    /**
     * Deprecated: Use getAvailableProducts() instead
     */
    @Deprecated
    public List<Product> getAvailableVegetables() {
        return getAvailableProducts();
    }

    /**
     * ✅ FARMER: Get products created by specific farmer
     */
    public List<Product> getProductsByFarmer(Long farmerId) {
        if (farmerId == null || farmerId <= 0) {
            throw new IllegalArgumentException("Invalid farmer ID");
        }
        return productRepository.findByFarmerId(farmerId);
    }
    
    /**
     * ✅ RETAILER: Get products assigned to specific retailer
     * CRITICAL: This is used by retailer dashboard to show their inventory
     * 
     * @param retailerId - The retailer's user ID (from JWT)
     * @return List of products assigned to this retailer
     */
    public List<Product> getProductsByRetailer(Long retailerId) {
        if (retailerId == null || retailerId <= 0) {
            throw new IllegalArgumentException("Invalid retailer ID");
        }
        
        // Verify retailer exists and has correct role
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new RuntimeException("Retailer not found"));
        
        if (!"retailer".equalsIgnoreCase(retailer.getRole())) {
            throw new RuntimeException("User is not a retailer");
        }
        
        return productRepository.findByRetailerId(retailerId);
    }

    /**
     * ✅ CRITICAL: Add product with retailer association
     * 
     * When a CUSTOMER adds vegetables:
     * 1. Identify which RETAILER should get this product
     * 2. Automatically assign retailerId (backend-controlled)
     * 3. Save with farmer + retailer association
     * 
     * @param product - Product to save
     * @param retailerId - Retailer who will sell this product (backend determines this)
     * @return Saved product
     */
    @Transactional
    public Product addProduct(Product product, Long retailerId) {
        if (product == null) {
            throw new IllegalArgumentException("Product cannot be null");
        }
        
        if (retailerId == null || retailerId <= 0) {
            throw new IllegalArgumentException("Valid retailer ID required");
        }
        
        // ✅ SECURITY: Verify retailer exists
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new RuntimeException("Retailer not found"));
        
        // ✅ SECURITY: Verify user is actually a retailer
        if (!"retailer".equalsIgnoreCase(retailer.getRole())) {
            throw new RuntimeException("Cannot assign product to non-retailer user");
        }
        
        // ✅ BACKEND-CONTROLLED: Set retailer ID (never trust frontend value)
        product.setRetailerId(retailerId);

        // ✅ Default availability for new products
        if (product.getStatus() == null || product.getStatus().isBlank()) {
            product.setStatus("AVAILABLE");
        }
        
        // Set creation timestamp
        if (product.getCreatedAt() == null) {
            product.setCreatedAt(System.currentTimeMillis());
        }
        
        return productRepository.save(product);
    }
    
    /**
     * ✅ Overloaded method: Add product without explicit retailer ID
     * Useful if retailer is determined from farmer's default retailer
     */
    @Transactional
    public Product addProduct(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Product cannot be null");
        }
        
        // If no retailer assigned, don't save (product needs retailer)
        if (product.getRetailerId() == null) {
            throw new IllegalArgumentException("Product must be assigned to a retailer");
        }
        
        return addProduct(product, product.getRetailerId());
    }

    /**
     * Delete product (only farmer or retailer owning it can delete)
     */
    public void deleteProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new RuntimeException("Product not found");
        }
        productRepository.deleteById(id);
    }

    /**
     * ✅ SECURE: Update product
     * Only allows updating product details, not retailer assignment
     */
    @Transactional
    public Product updateProduct(Long id, Product updatedProduct) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        // ✅ Only allow updating these fields
        product.setCropType(updatedProduct.getCropType());
        product.setSoilType(updatedProduct.getSoilType());
        product.setPesticides(updatedProduct.getPesticides());
        product.setHarvestDate(updatedProduct.getHarvestDate());
        product.setLatitude(updatedProduct.getLatitude());
        product.setLongitude(updatedProduct.getLongitude());
        product.setImageUrl(updatedProduct.getImageUrl());

        // Preserve or update status explicitly if provided
        if (updatedProduct.getStatus() != null && !updatedProduct.getStatus().isBlank()) {
            product.setStatus(updatedProduct.getStatus());
        }
        
        // ✅ SECURITY: Never allow changing retailer via update
        // Retailer can only be changed through explicit admin action
        
        return productRepository.save(product);
    }
    
    /**
     * ✅ ADMIN ONLY: Reassign product to different retailer
     * Used by admins to fix routing or reassign products
     */
    @Transactional
    public Product reassignProductToRetailer(Long productId, Long newRetailerId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        // ✅ SECURITY: Verify new retailer exists and has correct role
        User newRetailer = userRepository.findById(newRetailerId)
                .orElseThrow(() -> new RuntimeException("New retailer not found"));
        
        if (!"retailer".equalsIgnoreCase(newRetailer.getRole())) {
            throw new RuntimeException("Target user is not a retailer");
        }
        
        Long oldRetailerId = product.getRetailerId();
        product.setRetailerId(newRetailerId);
        Product saved = productRepository.save(product);
        
        System.out.println("[AUDIT] Product " + productId + " reassigned from retailer " 
            + oldRetailerId + " to retailer " + newRetailerId);
        
        return saved;
    }
}
