# AWS Provider Configuration for Nexus Platform
# Version: 1.5+

# Configure AWS Providers for multi-region deployment
# Primary region provider with enhanced resource management
provider "aws" {
  alias   = "primary"
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Environment    = var.environment
      Project        = var.project_name
      ManagedBy     = "terraform"
      Region        = "primary"
      DeploymentType = "production"
    }
  }

  # Enable advanced features for resource management
  assume_role_with_web_identity {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-execution-role"
  }
}

# Secondary region provider for disaster recovery
provider "aws" {
  alias   = "secondary"
  region  = var.secondary_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Environment    = var.environment
      Project        = var.project_name
      ManagedBy     = "terraform"
      Region        = "dr"
      DeploymentType = "disaster-recovery"
    }
  }
}

# AWS Cloud Control provider for advanced resource management
provider "awscc" {
  alias   = "primary"
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform-cc"
      APIType     = "cloud-control"
    }
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}

# Provider validation checks
locals {
  # Validate region configuration
  validate_regions = (
    var.aws_region != var.secondary_region &&
    can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region)) &&
    can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.secondary_region))
  )

  # Validate AWS profile configuration
  validate_profile = (
    var.aws_profile != null &&
    can(regex("^[a-zA-Z0-9_-]+$", var.aws_profile))
  )
}

# Required provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 0.57"
    }
  }
}