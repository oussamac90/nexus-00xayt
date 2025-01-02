# AWS ElastiCache Redis configuration for Nexus Platform
# Provider version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Import VPC configurations
data "aws_vpc" "selected" {
  id = var.vpc_id
}

# Redis subnet group for cluster deployment
resource "aws_elasticache_subnet_group" "main" {
  name        = "nexus-${var.environment}-redis-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Private subnet group for Redis cluster in ${var.environment}"

  tags = merge(var.tags, {
    Name        = "nexus-${var.environment}-redis-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Redis parameter group with optimized settings
resource "aws_elasticache_parameter_group" "main" {
  family      = var.redis_parameter_group_family
  name        = "nexus-${var.environment}-redis-params"
  description = "Optimized Redis parameters for Nexus Platform"

  # Memory management
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Connection management
  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxclients"
    value = "65000"
  }

  # Performance optimization
  parameter {
    name  = "activerehashing"
    value = "yes"
  }

  parameter {
    name  = "lazyfree-lazy-eviction"
    value = "yes"
  }

  parameter {
    name  = "lazyfree-lazy-expire"
    value = "yes"
  }

  tags = merge(var.tags, {
    Name        = "nexus-${var.environment}-redis-params"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Redis replication group for high availability
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "nexus-${var.environment}-redis"
  description         = "Redis cluster for Nexus Platform with enhanced security and performance"

  # Cluster configuration
  node_type                  = var.redis_node_type
  port                       = var.redis_port
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters        = var.redis_num_cache_nodes

  # Engine configuration
  engine         = "redis"
  engine_version = var.redis_engine_version

  # Maintenance and backup
  maintenance_window      = var.maintenance_window
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window         = "03:00-05:00"

  # Security configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                 = var.auth_token
  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = var.tags
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "nexus-${var.environment}-redis-sg"
  description = "Security group for Redis cluster with restricted access"
  vpc_id      = var.vpc_id

  # Inbound rules
  ingress {
    from_port       = var.redis_port
    to_port         = var.redis_port
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "Allow Redis traffic from VPC"
  }

  # Outbound rules
  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name        = "nexus-${var.environment}-redis-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Output configurations
output "redis_endpoint" {
  description = "Redis cluster endpoints for application configuration"
  value = {
    primary_endpoint = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.main.reader_endpoint_address
  }
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster"
  value       = aws_security_group.redis.id
}