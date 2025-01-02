# Backend configuration for Nexus Platform Terraform state management
# Version: ~> 1.5

terraform {
  # S3 backend configuration for state storage
  backend "s3" {
    # State file storage configuration
    bucket = "${var.project_name}-terraform-state"
    key    = "terraform.tfstate"
    region = var.aws_region

    # State file encryption configuration
    encrypt        = true
    kms_key_id     = "aws/s3"
    
    # State locking configuration using DynamoDB
    dynamodb_table = "${var.project_name}-terraform-locks"
    
    # Access control configuration
    acl            = "private"
    
    # State file versioning configuration
    versioning     = true
    
    # Workspace configuration for environment separation
    workspace_key_prefix = "env"
  }

  # Required provider configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Terraform version constraint
  required_version = "~> 1.5"
}

# Backend configuration validation
locals {
  # Validate bucket name format
  bucket_name_validation = regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", "${var.project_name}-terraform-state")
  
  # Validate region format
  region_validation = regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region)
}

# Backend configuration outputs
output "backend_bucket" {
  description = "S3 bucket storing Terraform state"
  value       = "${var.project_name}-terraform-state"
}

output "backend_dynamodb_table" {
  description = "DynamoDB table for state locking"
  value       = "${var.project_name}-terraform-locks"
}

output "backend_kms_key" {
  description = "KMS key for state encryption"
  value       = "aws/s3"
}