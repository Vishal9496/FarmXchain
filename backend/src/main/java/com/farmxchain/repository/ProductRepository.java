package com.farmxchain.repository;

import com.farmxchain.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    // ✅ FARMER: Find products created by specific farmer
    List<Product> findByFarmerId(Long farmerId);
    
    // ✅ RETAILER: Find products assigned to specific retailer
    // This is the critical method for retailer dashboard data loading
    List<Product> findByRetailerId(Long retailerId);
    
    // ✅ Optional: Find products by both farmer and retailer (for traceability)
    List<Product> findByFarmerIdAndRetailerId(Long farmerId, Long retailerId);

    // ✅ CUSTOMER: Find all available products (status = AVAILABLE or NULL)
    List<Product> findByStatusIgnoreCaseOrStatusIsNull(String status);
}
