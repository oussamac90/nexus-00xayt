# Terraform variables configuration for Nexus Platform AWS infrastructure
# Version: ~> 1.5

# Primary AWS region configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for infrastructure deployment"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be in format: xx-xxxx-# (e.g., us-east-1)"
  }
}

# Secondary region for disaster recovery
variable "secondary_region" {
  type        = string
  description = "Secondary AWS region for disaster recovery deployment"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.secondary_region))
    error_message = "Secondary AWS region must be in format: xx-xxxx-# (e.g., eu-west-1)"
  }

  validation {
    condition     = var.aws_region != var.secondary_region
    error_message = "Secondary region must be different from primary region"
  }
}

# AWS authentication profile
variable "aws_profile" {
  type        = string
  description = "AWS credentials profile for authentication"
}

# Deployment environment
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Project identification
variable "project_name" {
  type        = string
  description = "Project name for resource naming and tagging"
}

# Network configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC network"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid CIDR block"
  }
}

# EKS configuration
variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.27"
  
  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be in format: #.# (e.g., 1.27)"
  }
}

# RDS configuration
variable "rds_instance_class" {
  type        = string
  description = "RDS instance type for PostgreSQL database"
  default     = "db.r6g.xlarge"
  
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.rds_instance_class))
    error_message = "RDS instance class must be a valid instance type"
  }
}

# ElastiCache configuration
variable "elasticache_node_type" {
  type        = string
  description = "ElastiCache node type for Redis cluster"
  default     = "cache.r6g.large"
  
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.elasticache_node_type))
    error_message = "ElastiCache node type must be a valid instance type"
  }
}

# Availability Zones configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to use for multi-AZ deployment"
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability"
  }
}

# Backup configuration
variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups"
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days"
  }
}

# Monitoring configuration
variable "enable_enhanced_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring for RDS instances"
  default     = true
}

# Tags configuration
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default     = {}
}