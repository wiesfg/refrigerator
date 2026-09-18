package com.refrigerator.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false)
    private double amount;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(nullable = false, length = 20)
    private String location;

    @Column(nullable = false)
    private LocalDate expiry;

    protected InventoryItem() {
    }

    public InventoryItem(User user, String name, double amount, String unit, String location, LocalDate expiry) {
        this.user = user;
        this.name = name;
        this.amount = amount;
        this.unit = unit;
        this.location = location;
        this.expiry = expiry;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getName() { return name; }
    public double getAmount() { return amount; }
    public String getUnit() { return unit; }
    public String getLocation() { return location; }
    public LocalDate getExpiry() { return expiry; }
}
