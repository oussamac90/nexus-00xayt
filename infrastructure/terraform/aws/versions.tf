# Terraform version constraint ensuring compatibility with latest HCL features
# and provider capabilities required for the Nexus Platform deployment
terraform {
  required_version = "~> 1.5"

  # Required providers with strict version constraints for AWS infrastructure management
  required_providers {
    # Main AWS provider for EKS 1.27+, RDS, ElastiCache, and other core services
    # Version >= 5.0 required for latest AWS service features and security capabilities
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # AWS Cloud Control provider for advanced resource management
    # Version >= 0.57 required for Cloud Control API features and AWS provider compatibility
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 0.57"
    }
  }
}