# Terraform AWS RDS Variables Configuration
# Version: Terraform ~> 1.0

variable "rds_cluster_identifier" {
  description = "Unique identifier for the RDS cluster with environment prefix"
  type        = string
}

variable "rds_instance_class" {
  description = "The instance type of the RDS instance - using R6g for memory-optimized ARM instances"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "rds_engine_version" {
  description = "Version number of the PostgreSQL database engine - using latest stable version"
  type        = string
  default     = "15.4"
}

variable "rds_storage_size" {
  description = "Allocated storage size in gigabytes - minimum 100GB for production workloads"
  type        = number
  default     = 100
}

variable "rds_backup_retention_period" {
  description = "The days to retain backups for - 30 days for compliance"
  type        = number
  default     = 30
}

variable "rds_multi_az" {
  description = "Specifies if the RDS instance is multi-AZ for high availability"
  type        = bool
  default     = true
}

variable "rds_replica_count" {
  description = "Number of read replicas to create for read scaling"
  type        = number
  default     = 2
}

variable "rds_encryption_key_arn" {
  description = "ARN of KMS key used for RDS encryption - required for data security"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod) with validation"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}