package com.refrigerator.backend.controller;

import com.refrigerator.backend.dto.InventoryItemRequest;
import com.refrigerator.backend.dto.InventoryItemResponse;
import com.refrigerator.backend.dto.CookRequest;
import com.refrigerator.backend.service.InventoryService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping
    public ResponseEntity<InventoryItemResponse> add(@RequestBody InventoryItemRequest request) {
        return ResponseEntity.status(201).body(inventoryService.add(request));
    }

    @GetMapping
    public ResponseEntity<List<InventoryItemResponse>> list(@RequestParam(required = false) Long userId) {
        return ResponseEntity.ok(inventoryService.list(userId));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<InventoryItemResponse> update(
            @PathVariable Long id,
            @RequestBody com.refrigerator.backend.dto.InventoryItemUpdateRequest request
    ) {
        return ResponseEntity.ok(inventoryService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        inventoryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cook")
    public ResponseEntity<Void> cook(@RequestBody CookRequest request) {
        inventoryService.cook(request.userId(), request.ingredients());
        return ResponseEntity.ok().build();
    }
}
