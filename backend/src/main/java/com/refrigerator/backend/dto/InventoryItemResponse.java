package com.refrigerator.backend.dto;

import com.refrigerator.backend.domain.InventoryItem;
import java.time.LocalDate;

public record InventoryItemResponse(
        Long id,
        Long userId,
        String name,
        double amount,
        String unit,
        String location,
        LocalDate expiry
) {
    public static InventoryItemResponse from(InventoryItem item) {
        return new InventoryItemResponse(
                item.getId(),
                item.getUser().getId(),
                item.getName(),
                item.getAmount(),
                item.getUnit(),
                item.getLocation(),
                item.getExpiry()
        );
    }
}
