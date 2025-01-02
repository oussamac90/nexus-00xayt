# S3 bucket name variable with strict naming validation
variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket to create, must comply with AWS naming rules"
  
  validation {
    condition     = can(regex("^[a-z0-9.-]{3,63}$", var.bucket_name))
    error_message = "Bucket name must be between 3 and 63 characters, and can only contain lowercase letters, numbers, hyphens, and periods"
  }
}

# Environment variable with validated values
variable "environment" {
  type        = string
  description = "Environment name for resource tagging and configuration (e.g., dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Versioning control with secure defaults
variable "versioning_enabled" {
  type        = bool
  description = "Enable versioning for the S3 bucket for backup and recovery purposes"
  default     = true
}

# Comprehensive lifecycle management rules
variable "lifecycle_rules" {
  type = map(object({
    transition_days  = number
    storage_class    = string
    expiration_days = optional(number)
  }))
  description = "Comprehensive lifecycle rules for S3 objects including transition to cost-effective storage classes and expiration"
  
  default = {
    standard_ia = {
      transition_days = 30
      storage_class   = "STANDARD_IA"
    }
    glacier = {
      transition_days = 90
      storage_class   = "GLACIER"
    }
    expire = {
      expiration_days = 365
    }
  }
}

# KMS encryption key ID with sensitive handling
variable "kms_key_id" {
  type        = string
  description = "KMS key ID for S3 bucket encryption, required for data security compliance"
  sensitive   = true
}