package com.refrigerator.backend.dto;

import java.time.LocalDate;

public record InventoryItemUpdateRequest(
        String name,
        Double amount,
        String unit,
        String location,
        LocalDate expiry
) {
}
