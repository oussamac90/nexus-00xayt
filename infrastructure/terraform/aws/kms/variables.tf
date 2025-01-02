# Required provider configuration for AWS
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Environment variable for KMS key deployment
variable "environment" {
  description = "Environment name for the KMS key (e.g., dev, staging, prod)"
  type        = string
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Key deletion window period configuration
variable "key_deletion_window" {
  description = "Duration in days before KMS key is deleted after being scheduled for deletion"
  type        = number
  default     = 30
  
  validation {
    condition     = var.key_deletion_window >= 7 && var.key_deletion_window <= 30
    error_message = "Key deletion window must be between 7 and 30 days"
  }
}

# Automatic key rotation configuration
variable "enable_key_rotation" {
  description = "Enable automatic key rotation for the KMS key"
  type        = bool
  default     = true
}

# Resource tagging configuration
variable "tags" {
  description = "Additional tags for the KMS key"
  type        = map(string)
  default     = {}
}

# Multi-region replication configuration
variable "multi_region" {
  description = "Enable multi-region replication for the KMS key"
  type        = bool
  default     = true
}

# Key usage configuration
variable "key_usage" {
  description = "Intended use of the KMS key"
  type        = string
  default     = "ENCRYPT_DECRYPT"
  
  validation {
    condition     = can(regex("^(ENCRYPT_DECRYPT|SIGN_VERIFY)$", var.key_usage))
    error_message = "Key usage must be either ENCRYPT_DECRYPT or SIGN_VERIFY"
  }
}

# Key specification configuration
variable "key_spec" {
  description = "Cryptographic configuration of the KMS key"
  type        = string
  default     = "SYMMETRIC_DEFAULT"
  
  validation {
    condition     = can(regex("^(SYMMETRIC_DEFAULT|RSA_2048|RSA_3072|RSA_4096|ECC_NIST_P256|ECC_NIST_P384|ECC_NIST_P521)$", var.key_spec))
    error_message = "Invalid key specification provided"
  }
}