package com.refrigerator.backend.controller;

import com.refrigerator.backend.dto.SavedMenuRequest;
import com.refrigerator.backend.dto.SavedMenuResponse;
import com.refrigerator.backend.service.SavedMenuService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/saved-menus")
public class SavedMenuController {

    private final SavedMenuService savedMenuService;

    public SavedMenuController(SavedMenuService savedMenuService) {
        this.savedMenuService = savedMenuService;
    }

    @PostMapping
    public ResponseEntity<SavedMenuResponse> save(@RequestBody SavedMenuRequest request) {
        return ResponseEntity.status(201).body(savedMenuService.save(request));
    }

    @GetMapping
    public ResponseEntity<List<SavedMenuResponse>> list(@RequestParam(required = false) Long userId) {
        return ResponseEntity.ok(savedMenuService.list(userId));
    }
}
