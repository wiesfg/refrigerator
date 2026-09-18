package com.refrigerator.backend.dto;

import java.time.LocalDate;

public record InventoryItemRequest(
        Long userId,
        String name,
        double amount,
        String unit,
        String location,
        LocalDate expiry
) {
}
