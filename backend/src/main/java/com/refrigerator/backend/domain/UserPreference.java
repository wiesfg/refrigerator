package com.refrigerator.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_preferences")
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(length = 80)
    private String dietType;

    @Column(length = 255)
    private String allergies;

    @Column(length = 120)
    private String preferredTaste;

    @Column(length = 255)
    private String dislikedIngredients;

    @Column(length = 120)
    private String healthGoal;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected UserPreference() {
    }

    public UserPreference(User user) {
        this.user = user;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getDietType() {
        return dietType;
    }

    public String getAllergies() {
        return allergies;
    }

    public String getPreferredTaste() {
        return preferredTaste;
    }

    public String getDislikedIngredients() {
        return dislikedIngredients;
    }

    public String getHealthGoal() {
        return healthGoal;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public void updatePreferences(
            String dietType,
            String allergies,
            String preferredTaste,
            String dislikedIngredients,
            String healthGoal
    ) {
        this.dietType = dietType;
        this.allergies = allergies;
        this.preferredTaste = preferredTaste;
        this.dislikedIngredients = dislikedIngredients;
        this.healthGoal = healthGoal;
        this.updatedAt = LocalDateTime.now();
    }
}
