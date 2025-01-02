# Nexus Platform Backend Services

[![Build Status](https://github.com/nexus-platform/backend/actions/workflows/build.yml/badge.svg)](https://github.com/nexus-platform/backend/actions/workflows/build.yml)
[![Code Coverage](https://codecov.io/gh/nexus-platform/backend/branch/main/graph/badge.svg)](https://codecov.io/gh/nexus-platform/backend)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![API Documentation](https://img.shields.io/badge/API-Documentation-green.svg)](api-docs)

## Introduction

The Nexus Platform backend services implement a comprehensive B2B trade facilitation solution designed for enterprise-grade performance and scalability. This documentation provides detailed information about the system architecture, development setup, and operational procedures.

### Key Features

- Microservices-based architecture with Spring Boot 3.1.x
- Standards-based integration (eCl@ss, GS1, EDIFACT)
- OAuth 2.0 + OIDC authentication with RBAC
- Event-driven architecture using Apache Kafka
- Comprehensive monitoring and observability

## Prerequisites

- Java 17 LTS (Eclipse Temurin recommended)
- Maven 3.8+
- Docker 24.x
- Docker Compose v2
- Kubernetes 1.27+ (optional)
- AWS CLI v2 (optional)

### Recommended IDE Setup

- IntelliJ IDEA 2023.2+ with the following plugins:
  - Spring Boot
  - Lombok
  - SonarLint
  - Docker
  - Kubernetes

## Project Structure

```
src/backend/
├── common/                 # Shared libraries and utilities
├── services/              # Microservices implementations
│   ├── user-service/      # User management and authentication
│   ├── product-service/   # Product catalog and classification
│   ├── order-service/     # Order processing and management
│   ├── payment-service/   # Payment processing and reconciliation
│   └── shipping-service/  # Shipping coordination and tracking
├── integration/           # Integration components
├── k8s/                   # Kubernetes deployment configurations
├── docker/                # Docker configurations
└── docs/                  # Additional documentation
```

## Getting Started

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/nexus-platform/backend.git
cd backend

# Build the project
mvn clean install -DskipTests

# Run tests
mvn verify

# Start local development environment
docker-compose up -d

# Verify services health
curl http://localhost:8080/actuator/health
```

### Environment Configuration

Create a `.env` file in the project root:

```properties
# Application Configuration
SPRING_PROFILES_ACTIVE=local
SERVER_PORT=8080

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=nexus
POSTGRES_USER=nexus_user

# Security Configuration
JWT_SECRET_KEY=your-secret-key
JWT_EXPIRATION=86400000

# AWS Configuration (Optional)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Development

### Coding Standards

- Follow Spring Boot best practices
- Implement comprehensive unit and integration tests
- Document all public APIs using OpenAPI 3.0
- Use constructor injection for dependencies
- Implement proper exception handling
- Follow the microservices design patterns

### API Documentation

API documentation is available at:
- Local: http://localhost:8080/swagger-ui.html
- Staging: https://api-staging.nexus-platform.com/swagger-ui.html
- Production: https://api.nexus-platform.com/swagger-ui.html

### Testing

```bash
# Run unit tests
mvn test

# Run integration tests
mvn verify -P integration-test

# Generate coverage report
mvn jacoco:report
```

## Deployment

### Container Build

```bash
# Build all service images
docker-compose build

# Build specific service
docker-compose build user-service
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n nexus-platform

# Check logs
kubectl logs -f deployment/user-service -n nexus-platform
```

### Configuration Management

- Use ConfigMaps for non-sensitive configuration
- Use Secrets for sensitive data
- Implement proper environment variable management
- Follow the twelve-factor app methodology

## Monitoring

### Health Checks

- Actuator endpoints enabled for all services
- Kubernetes liveness and readiness probes configured
- Custom health indicators implemented for critical dependencies

### Metrics Collection

- Prometheus metrics exposed via actuator
- Custom metrics implemented for business KPIs
- Grafana dashboards available for visualization

### Logging

- Structured JSON logging format
- Correlation IDs for request tracing
- ELK stack integration for log aggregation

### Tracing

- Distributed tracing with Jaeger
- OpenTelemetry instrumentation
- Trace sampling configuration available

## Security

### Authentication

- OAuth 2.0 + OIDC implementation
- JWT token-based authentication
- Refresh token rotation
- MFA support for critical operations

### Authorization

- Role-Based Access Control (RBAC)
- Fine-grained permission management
- Resource-level access control
- API key management for B2B integration

### Data Protection

- TLS 1.3 for all communications
- Data encryption at rest
- PII data handling compliance
- Audit logging for sensitive operations

## Support

For technical support and contributions:
- Create an issue in the GitHub repository
- Contact the development team at dev@nexus-platform.com
- Review the contribution guidelines in CONTRIBUTING.md

## License

Copyright (c) 2023 Nexus Platform

Licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.