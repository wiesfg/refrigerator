package com.refrigerator.backend.repository;

import com.refrigerator.backend.domain.InventoryItem;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    List<InventoryItem> findByUserIdAndExpiryGreaterThanEqualOrderByExpiryAsc(
            Long userId,
            LocalDate expiry
    );
}
