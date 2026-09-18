package com.refrigerator.backend.service;

import com.refrigerator.backend.domain.InventoryItem;
import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.dto.InventoryItemRequest;
import com.refrigerator.backend.dto.InventoryItemResponse;
import com.refrigerator.backend.repository.InventoryItemRepository;
import com.refrigerator.backend.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class InventoryService {

    private static final String DEFAULT_NICKNAME = "demo-user";

    private final InventoryItemRepository inventoryItemRepository;
    private final UserRepository userRepository;

    public InventoryService(InventoryItemRepository inventoryItemRepository, UserRepository userRepository) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public InventoryItemResponse add(InventoryItemRequest request) {
        validate(request);
        User user = findOrCreateUser(request.userId());
        InventoryItem item = new InventoryItem(
                user,
                request.name().trim(),
                request.amount(),
                request.unit().trim(),
                request.location().trim(),
                request.expiry()
        );
        return InventoryItemResponse.from(inventoryItemRepository.save(item));
    }

    @Transactional(readOnly = true)
    public List<InventoryItemResponse> list(Long userId) {
        User user = findOrCreateUser(userId);
        return inventoryItemRepository
                .findByUserIdAndExpiryGreaterThanEqualOrderByExpiryAsc(user.getId(), LocalDate.now())
                .stream()
                .map(InventoryItemResponse::from)
                .toList();
    }

    private User findOrCreateUser(Long userId) {
        if (userId != null) {
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));
        }
        return userRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> userRepository.save(new User(DEFAULT_NICKNAME)));
    }

    private void validate(InventoryItemRequest request) {
        if (request == null || !StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("name is required");
        }
        if (request.amount() <= 0) {
            throw new IllegalArgumentException("amount must be greater than zero");
        }
        if (!StringUtils.hasText(request.unit()) || !StringUtils.hasText(request.location())) {
            throw new IllegalArgumentException("unit and location are required");
        }
        if (request.expiry() == null) {
            throw new IllegalArgumentException("expiry is required");
        }
    }
}
