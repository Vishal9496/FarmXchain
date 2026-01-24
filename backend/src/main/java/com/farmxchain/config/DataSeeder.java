package com.farmxchain.config;

import com.farmxchain.model.Product;
import com.farmxchain.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final ProductRepository productRepository;

    public DataSeeder(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    public void run(String... args) {
        long existing = productRepository.count();
        
        // ✅ Seed 10+ products if DB has fewer than 10 rows
        if (existing >= 10) {
            System.out.println("[SEEDER] Seed skipped, existing products count = " + existing);
            return;
        }

        List<Product> samples = Arrays.asList(
                buildProduct("Organic Tomatoes", "Tomatoes", 2.50, 120, "AVAILABLE"),
                buildProduct("Fresh Carrots", "Carrots", 1.80, 200, "AVAILABLE"),
                buildProduct("Green Lettuce", "Lettuce", 1.50, 150, "AVAILABLE"),
                buildProduct("Crispy Cucumbers", "Cucumbers", 1.20, 180, "AVAILABLE"),
                buildProduct("Sweet Bell Peppers", "Peppers", 3.00, 90, "AVAILABLE"),
                buildProduct("Juicy Oranges", "Oranges", 3.50, 110, "AVAILABLE"),
                buildProduct("Fresh Broccoli", "Broccoli", 2.80, 75, "AVAILABLE"),
                buildProduct("Ripe Bananas", "Bananas", 2.00, 200, "AVAILABLE"),
                buildProduct("Creamy Avocados", "Avocados", 4.50, 60, "AVAILABLE"),
                buildProduct("Red Radishes", "Radishes", 0.90, 250, "AVAILABLE")
        );

        productRepository.saveAll(samples);
        long newCount = productRepository.count();
        System.out.println("[SEEDER] ✅ Seeded products count = " + newCount);
    }

    private Product buildProduct(String name, String cropType, Double price, Integer quantity, String status) {
        Product p = new Product();
        p.setName(name);
        p.setCropType(cropType);
        p.setPrice(price);
        p.setQuantity(quantity);
        p.setStatus(status);
        p.setFarmerId(1L);
        p.setRetailerId(null);
        p.setImageUrl(null);
        p.setSoilType(null);
        p.setPesticides(null);
        p.setHarvestDate(null);
        p.setLatitude(null);
        p.setLongitude(null);
        return p;
    }
}
