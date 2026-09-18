package com.refrigerator.backend.repository;

import com.refrigerator.backend.domain.SavedMenu;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedMenuRepository extends JpaRepository<SavedMenu, Long> {

    List<SavedMenu> findByUserIdOrderBySavedAtDesc(Long userId);

    Optional<SavedMenu> findByUserIdAndMenuName(Long userId, String menuName);

    Optional<SavedMenu> findByIdAndUserId(Long id, Long userId);
}
