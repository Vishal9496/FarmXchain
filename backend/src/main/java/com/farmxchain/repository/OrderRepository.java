package com.farmxchain.repository;

import com.farmxchain.model.Order;
import com.farmxchain.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * ✅ PRODUCTION ORDER REPOSITORY
 * 
 * Provides data access for Order entities with role-based queries.
 */
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // ============================================================================
    // CUSTOMER QUERIES
    // ============================================================================

    /**
     * Get all orders for a specific customer
     * @param customerId Customer's user ID
     * @return List of orders created by this customer
     */
    @Query("""
        SELECT o FROM Order o 
        WHERE o.customer.id = :customerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findByCustomerId(@Param("customerId") Long customerId);

    /**
     * Get orders for customer with specific status
     */
    @Query("""
        SELECT o FROM Order o 
        WHERE o.customer.id = :customerId 
        AND o.status = :status
        ORDER BY o.createdAt DESC
    """)
    List<Order> findByCustomerIdAndStatus(@Param("customerId") Long customerId, 
                                           @Param("status") OrderStatus status);

    /**
     * Get recent orders for customer (pagination helper)
     */
    @Query(value = """
        SELECT o FROM Order o 
        WHERE o.customer.id = :customerId
        ORDER BY o.createdAt DESC
        LIMIT :limit
    """)
    List<Order> findRecentOrdersByCustomerId(@Param("customerId") Long customerId, 
                                              @Param("limit") int limit);

    // ============================================================================
    // RETAILER QUERIES
    // ============================================================================

    /**
     * Get all orders containing products sold by this retailer
     * @param retailerId Retailer's user ID
     * @return List of orders with items from this retailer
     */
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.retailerId = :retailerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findOrdersByRetailer(@Param("retailerId") Long retailerId);

    /**
     * Get pending/confirmed orders for retailer
     */
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.retailerId = :retailerId 
        AND o.status IN ('PLACED', 'CONFIRMED')
        ORDER BY o.createdAt DESC
    """)
    List<Order> findPendingOrdersByRetailer(@Param("retailerId") Long retailerId);

    /**
     * Get orders for retailer with specific status
     */
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.retailerId = :retailerId 
        AND o.status = :status
        ORDER BY o.createdAt DESC
    """)
    List<Order> findOrdersByRetailerAndStatus(@Param("retailerId") Long retailerId,
                                               @Param("status") OrderStatus status);

    // ============================================================================
    // DISTRIBUTOR QUERIES - Role-based visibility
    // ============================================================================

    /**
     * Get all orders assigned to this distributor (status = PACKED or higher)
     * Distributors see orders that are:
     * - PACKED (ready for pickup/shipment)
     * - SHIPPED (already shipped by this distributor)
     * - DELIVERED (completed shipments)
     * - NOT CANCELLED orders assigned to them
     * 
     * @param distributorId Distributor's user ID
     * @return List of orders assigned to this distributor
     */
    @Query("""
        SELECT o FROM Order o
        WHERE o.distributorId = :distributorId
        AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED')
        ORDER BY o.status ASC, o.createdAt DESC
    """)
    List<Order> findOrdersByDistributor(@Param("distributorId") Long distributorId);

    /**
     * Get orders ready for shipment (PACKED status only)
     * These are orders the distributor needs to pick up and ship
     * 
     * @param distributorId Distributor's user ID
     * @return List of orders ready to ship
     */
    @Query("""
        SELECT o FROM Order o
        WHERE o.distributorId = :distributorId
        AND o.status = 'PACKED'
        ORDER BY o.createdAt ASC
    """)
    List<Order> findReadyToShipOrders(@Param("distributorId") Long distributorId);

    /**
     * Get already shipped orders by distributor
     * 
     * @param distributorId Distributor's user ID
     * @return List of shipped orders
     */
    @Query("""
        SELECT o FROM Order o
        WHERE o.distributorId = :distributorId
        AND o.status IN ('SHIPPED', 'DELIVERED')
        ORDER BY o.updatedAt DESC
    """)
    List<Order> findShippedOrdersByDistributor(@Param("distributorId") Long distributorId);

    /**
     * Get all orders that need packing (CONFIRMED status, no distributor assigned yet)
     * Used by warehouse/admin to assign distributors
     * 
     * @return List of confirmed orders waiting for packing
     */
    @Query("""
        SELECT o FROM Order o
        WHERE o.status = 'CONFIRMED'
        AND o.distributorId IS NULL
        ORDER BY o.createdAt ASC
    """)
    List<Order> findOrdersWaitingForPacking();

    /**
     * Get orders packed by specific distributor in date range
     * Useful for distributor performance analytics
     */
    @Query("""
        SELECT o FROM Order o
        WHERE o.distributorId = :distributorId
        AND o.status IN ('SHIPPED', 'DELIVERED')
        AND o.updatedAt >= :startDate
        AND o.updatedAt <= :endDate
        ORDER BY o.updatedAt DESC
    """)
    List<Order> findShippedOrdersByDistributorAndDateRange(
            @Param("distributorId") Long distributorId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    // ============================================================================
    // FARMER QUERIES
    // ============================================================================

    /**
     * Get all orders containing products from this farmer
     * @param farmerId Farmer's user ID
     * @return List of orders with items from this farmer
     */
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.farmerId = :farmerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findOrdersByFarmer(@Param("farmerId") Long farmerId);

    // ============================================================================
    // ANALYTICS QUERIES
    // ============================================================================

    /**
     * Count orders by customer
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.customer.id = :customerId")
    Long countByCustomerId(@Param("customerId") Long customerId);

    /**
     * Count orders by status
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status")
    Long countByStatus(@Param("status") OrderStatus status);

    /**
     * Get orders created within date range
     */
    @Query("""
        SELECT o FROM Order o 
        WHERE o.createdAt >= :startDate 
        AND o.createdAt <= :endDate
        ORDER BY o.createdAt DESC
    """)
    List<Order> findByDateRange(@Param("startDate") LocalDateTime startDate, 
                                 @Param("endDate") LocalDateTime endDate);

    /**
     * Find order by ID with eager loading of items
     */
    @Query("""
        SELECT o FROM Order o
        LEFT JOIN FETCH o.items
        WHERE o.id = :orderId
    """)
    Optional<Order> findByIdWithItems(@Param("orderId") Long orderId);
}
