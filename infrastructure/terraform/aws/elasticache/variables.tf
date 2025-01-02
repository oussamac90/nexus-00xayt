# Terraform variables definition file for AWS ElastiCache Redis configuration
# Version: ~> 1.5

# Environment configuration with strict validation
variable "environment" {
  description = "Deployment environment name (dev, staging, prod) with strict validation"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Redis node instance type configuration
variable "redis_node_type" {
  description = "ElastiCache node instance type with environment-specific defaults"
  type        = string
  default     = "cache.r6g.large"
  validation {
    condition     = can(regex("^cache\\.(t3|r6g|r6gd)\\.(micro|small|medium|large|xlarge)$", var.redis_node_type))
    error_message = "Invalid Redis node type specified"
  }
}

# High availability cluster configuration
variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster for high availability"
  type        = number
  default     = 3
  validation {
    condition     = var.redis_num_cache_nodes >= 2 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 2 and 6 for high availability"
  }
}

# Redis port configuration with security validation
variable "redis_port" {
  description = "Port number for Redis cluster with security validation"
  type        = number
  default     = 6379
  validation {
    condition     = var.redis_port >= 1024 && var.redis_port <= 65535
    error_message = "Redis port must be between 1024 and 65535"
  }
}

# Redis parameter group configuration
variable "redis_parameter_group_family" {
  description = "Redis parameter group family with version validation"
  type        = string
  default     = "redis7.x"
  validation {
    condition     = can(regex("^redis[567]\\.x$", var.redis_parameter_group_family))
    error_message = "Parameter group family must be redis5.x, redis6.x, or redis7.x"
  }
}

# Redis engine version configuration
variable "redis_engine_version" {
  description = "Redis engine version with compatibility validation"
  type        = string
  default     = "7.0"
  validation {
    condition     = can(regex("^[567]\\.[0-9]$", var.redis_engine_version))
    error_message = "Invalid Redis engine version"
  }
}

# Maintenance window configuration
variable "maintenance_window" {
  description = "Preferred maintenance window with format validation"
  type        = string
  default     = "sun:05:00-sun:07:00"
  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}-(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Invalid maintenance window format"
  }
}

# Snapshot retention configuration
variable "snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots with compliance validation"
  type        = number
  default     = 7
  validation {
    condition     = var.snapshot_retention_limit >= 7 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention must be between 7 and 35 days for compliance"
  }
}

# Security configuration
variable "encryption_enabled" {
  description = "Enable encryption at rest and in transit"
  type        = bool
  default     = true
}

variable "auth_token_enabled" {
  description = "Enable Redis AUTH token for additional security"
  type        = bool
  default     = true
}

# Monitoring configuration
variable "monitoring_interval" {
  description = "CloudWatch monitoring interval in seconds"
  type        = number
  default     = 60
  validation {
    condition     = contains([0, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 0, 30, or 60 seconds"
  }
}

# Network configuration from VPC module
variable "vpc_id" {
  description = "VPC ID for secure Redis cluster deployment"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Redis subnet group"
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets must be provided for high availability"
  }
}