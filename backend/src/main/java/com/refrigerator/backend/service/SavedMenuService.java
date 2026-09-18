package com.refrigerator.backend.service;

import com.refrigerator.backend.domain.SavedMenu;
import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.dto.SavedMenuRequest;
import com.refrigerator.backend.dto.SavedMenuResponse;
import com.refrigerator.backend.repository.SavedMenuRepository;
import com.refrigerator.backend.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SavedMenuService {

    private final SavedMenuRepository savedMenuRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;

    public SavedMenuService(
            SavedMenuRepository savedMenuRepository,
            UserRepository userRepository,
            InventoryService inventoryService
    ) {
        this.savedMenuRepository = savedMenuRepository;
        this.userRepository = userRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public SavedMenuResponse save(SavedMenuRequest request) {
        if (request == null || !StringUtils.hasText(request.menuName())) {
            throw new IllegalArgumentException("menuName is required");
        }
        User user = findUser(request.userId());
        String menuName = request.menuName().trim();
        SavedMenu menu = savedMenuRepository.findByUserIdAndMenuName(user.getId(), menuName)
                .orElseGet(() -> savedMenuRepository.save(new SavedMenu(user, menuName)));
        return SavedMenuResponse.from(menu);
    }

    @Transactional(readOnly = true)
    public List<SavedMenuResponse> list(Long userId) {
        return savedMenuRepository.findByUserIdOrderBySavedAtDesc(findUser(userId).getId())
                .stream().map(SavedMenuResponse::from).toList();
    }

    @Transactional
    public void delete(Long id) {
        if (!savedMenuRepository.existsById(id)) {
            throw new IllegalArgumentException("saved menu not found: " + id);
        }
        savedMenuRepository.deleteById(id);
    }

    @Transactional
    public void cook(Long menuId, com.refrigerator.backend.dto.CookRequest request) {
        User user = findUser(request.userId());
        savedMenuRepository.findByIdAndUserId(menuId, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("saved menu not found: " + menuId));
        inventoryService.cook(user.getId(), request.ingredients());
    }

    private User findUser(Long userId) {
        if (userId != null) {
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));
        }
        return userRepository.findAll().stream().findFirst()
                .orElseGet(() -> userRepository.save(new User("demo-user")));
    }
}
