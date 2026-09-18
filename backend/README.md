# Refrigerator Backend

Spring Boot backend for the Refrigerator menu recommendation service.

## Run

```bash
cd backend
mvn spring-boot:run
```

## Development Database

This project uses an in-memory H2 database for early development.

- Health check: `GET http://localhost:8080/api/health`
- H2 console: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:refrigerator`
- Username: `sa`
- Password: empty

## Current Scope

- Spring Boot application setup
- Spring Data JPA
- H2 database
- `User` entity
- `UserPreference` entity with a one-to-one user mapping
