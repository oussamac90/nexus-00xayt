# AWS RDS PostgreSQL Configuration for Nexus Platform
# Provider version: ~> 4.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# RDS Parameter Group for PostgreSQL optimization and security
resource "aws_db_parameter_group" "main" {
  name   = "${var.rds_cluster_identifier}-params"
  family = var.rds_parameter_group_family

  parameter {
    name  = "ssl"
    value = "1"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name        = "${var.rds_cluster_identifier}-params"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# RDS Subnet Group for multi-AZ deployment
resource "aws_db_subnet_group" "main" {
  name       = "${var.rds_cluster_identifier}-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.rds_cluster_identifier}-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Security Group for RDS access control
resource "aws_security_group" "rds" {
  name        = "${var.rds_cluster_identifier}-sg"
  description = "Security group for RDS PostgreSQL cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "PostgreSQL access from VPC"
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.rds_cluster_identifier}-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.rds_cluster_identifier}-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]
}

# Primary RDS Instance
resource "aws_db_instance" "main" {
  identifier     = var.rds_cluster_identifier
  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  # Storage Configuration
  allocated_storage     = var.rds_storage_size
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = var.rds_encryption_key_arn

  # High Availability Configuration
  multi_az               = var.rds_multi_az
  availability_zone      = var.multi_az ? null : var.availability_zones[0]

  # Backup Configuration
  backup_retention_period = var.rds_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  # Monitoring Configuration
  performance_insights_enabled          = true
  performance_insights_retention_period = var.rds_performance_insights_retention_period
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  # Additional Configuration
  auto_minor_version_upgrade = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.rds_cluster_identifier}-final-snapshot"
  deletion_protection      = true

  tags = {
    Name        = var.rds_cluster_identifier
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Read Replicas
resource "aws_db_instance" "replica" {
  count               = var.rds_replica_count
  identifier          = "${var.rds_cluster_identifier}-replica-${count.index + 1}"
  replicate_source_db = aws_db_instance.main.id
  instance_class      = var.rds_instance_class

  # Replica-specific Configuration
  multi_az               = false
  availability_zone      = var.availability_zones[count.index % length(var.availability_zones)]
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Performance Configuration
  performance_insights_enabled          = true
  performance_insights_retention_period = var.rds_performance_insights_retention_period
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn

  tags = {
    Name        = "${var.rds_cluster_identifier}-replica-${count.index + 1}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the primary RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "rds_replica_endpoints" {
  description = "The connection endpoints for the RDS read replicas"
  value       = aws_db_instance.replica[*].endpoint
}

output "rds_monitoring_role_arn" {
  description = "The ARN of the RDS monitoring IAM role"
  value       = aws_iam_role.rds_monitoring.arn
}