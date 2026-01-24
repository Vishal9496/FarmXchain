-- ✅ Database Migration: Add Retailer Association to Products
-- 
-- Date: 2024
-- Purpose: Enable retailer dashboard to show products assigned to them
-- Status: Ready to run
--
-- This migration adds two new columns to the products table:
-- 1. retailer_id - Foreign key linking to retailer (User)
-- 2. created_at - Timestamp for audit trail
--
-- BEFORE RUNNING THIS MIGRATION:
-- 1. Backup your database
-- 2. Test in development environment first
-- 3. Schedule during low-traffic period

-- ============================================================
-- STEP 1: Add new columns
-- ============================================================

-- Add retailer_id column (nullable, allows products without retailers initially)
ALTER TABLE products 
ADD COLUMN retailer_id BIGINT NULL AFTER farmer_id;

-- Add created_at column (timestamp for when product was added)
ALTER TABLE products 
ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0 AFTER retailer_id;

-- ============================================================
-- STEP 2: Add foreign key constraint
-- ============================================================

-- Link retailer_id to users table
-- This ensures retailer_id only contains valid user IDs
ALTER TABLE products 
ADD CONSTRAINT fk_product_retailer 
FOREIGN KEY (retailer_id) REFERENCES users(id) 
ON DELETE SET NULL  -- If retailer is deleted, product's retailer_id becomes NULL
ON UPDATE CASCADE;  -- If retailer ID changes, update product references

-- ============================================================
-- STEP 3: Add indexes for performance
-- ============================================================

-- Index on retailer_id (critical for dashboard queries)
-- Speeds up: SELECT * FROM products WHERE retailer_id = ?
ALTER TABLE products 
ADD INDEX idx_products_retailer_id (retailer_id);

-- Index on created_at (for sorting and filtering by date)
ALTER TABLE products 
ADD INDEX idx_products_created_at (created_at);

-- Compound index for farmer-retailer queries (supply chain traceability)
-- Speeds up: SELECT * FROM products WHERE farmer_id = ? AND retailer_id = ?
ALTER TABLE products 
ADD INDEX idx_products_farmer_retailer (farmer_id, retailer_id);

-- ============================================================
-- STEP 4: Update existing data (optional, based on your business logic)
-- ============================================================

-- OPTION 1: Set all existing products to first available retailer
-- This ensures all existing products appear in some retailer's dashboard
-- Uncomment if you want this behavior:
/*
UPDATE products p
SET p.retailer_id = (
    SELECT u.id 
    FROM users u 
    WHERE u.role = 'retailer' 
    LIMIT 1
)
WHERE p.retailer_id IS NULL;
*/

-- OPTION 2: Leave as NULL (products without assigned retailers)
-- This is safer - review and assign retailers manually
-- Keep as is (commented above)

-- OPTION 3: Set based on farmer's default retailer
-- This requires a farmer_default_retailer relationship in users table
-- Uncomment if you have this setup:
/*
UPDATE products p
JOIN users f ON p.farmer_id = f.id
SET p.retailer_id = f.default_retailer_id
WHERE p.retailer_id IS NULL AND f.default_retailer_id IS NOT NULL;
*/

-- ============================================================
-- STEP 5: Set timestamps for existing products
-- ============================================================

-- Set created_at for existing products to current time
-- If you want to preserve original creation time, modify this query
UPDATE products 
SET created_at = UNIX_TIMESTAMP() * 1000 
WHERE created_at = 0 OR created_at IS NULL;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these queries to verify the migration succeeded:

-- 1. Check new columns exist
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'products' AND COLUMN_NAME IN ('retailer_id', 'created_at');

-- 2. Check indexes created
-- SHOW INDEX FROM products WHERE Column_name IN ('retailer_id', 'created_at');

-- 3. Check data integrity
-- SELECT COUNT(*) as total_products,
--        COUNT(retailer_id) as assigned_products,
--        COUNT(CASE WHEN retailer_id IS NULL THEN 1 END) as unassigned_products
-- FROM products;

-- 4. Sample data with relationships
-- SELECT p.id, p.crop_type, p.farmer_id, p.retailer_id, 
--        CONCAT(f.name, ' (Farmer)') as farmer_name,
--        CONCAT(r.name, ' (Retailer)') as retailer_name,
--        FROM_UNIXTIME(p.created_at/1000) as created_date
-- FROM products p
-- LEFT JOIN users f ON p.farmer_id = f.id
-- LEFT JOIN users r ON p.retailer_id = r.id
-- LIMIT 10;

-- ============================================================
-- ROLLBACK PLAN (if something goes wrong)
-- ============================================================

-- To rollback this migration, run:
/*
ALTER TABLE products 
DROP FOREIGN KEY fk_product_retailer;

ALTER TABLE products 
DROP INDEX idx_products_retailer_id;

ALTER TABLE products 
DROP INDEX idx_products_created_at;

ALTER TABLE products 
DROP INDEX idx_products_farmer_retailer;

ALTER TABLE products 
DROP COLUMN retailer_id;

ALTER TABLE products 
DROP COLUMN created_at;
*/

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Products table is now ready for retailer-based filtering
-- Backend code can now:
// 1. Save products with retailer association
-- 2. Query products by retailer: findByRetailerId()
-- 3. Retailer dashboard shows assigned products
-- ============================================================
