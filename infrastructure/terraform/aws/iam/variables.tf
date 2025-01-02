# Project name variable with validation for resource naming and tagging
variable "project" {
  description = "Project name used for resource naming and tagging across all IAM resources"
  type        = string
  default     = "nexus-platform"

  validation {
    condition     = length(var.project) <= 32 && can(regex("^[a-z0-9-]+$", var.project))
    error_message = "Project name must be 32 characters or less and contain only lowercase letters, numbers, and hyphens"
  }
}

# Environment variable with strict validation for IAM resource segregation
variable "environment" {
  description = "Deployment environment identifier for IAM resource segregation and access control"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# AWS region variable with allowed regions validation
variable "region" {
  description = "AWS region for IAM resource deployment and regional service integration"
  type        = string

  validation {
    condition     = contains(["us-east-1", "eu-west-1", "ap-southeast-1"], var.region)
    error_message = "Region must be one of: us-east-1, eu-west-1, ap-southeast-1"
  }
}

# EKS cluster name variable for IRSA configuration
variable "eks_cluster_name" {
  description = "Name of the EKS cluster for IAM role association and IRSA configuration"
  type        = string

  validation {
    condition     = length(var.eks_cluster_name) <= 100 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.eks_cluster_name))
    error_message = "EKS cluster name must be 100 characters or less and start with a letter"
  }
}

# Service accounts map for Kubernetes service account IAM role mapping
variable "service_accounts" {
  description = "Map of Kubernetes service accounts requiring IAM roles with associated policies"
  type = map(object({
    name      = string
    namespace = string
    policies  = list(string)
  }))
  default = {}
}

# Additional IAM policy ARNs variable with ARN format validation
variable "additional_policy_arns" {
  description = "List of additional IAM policy ARNs to attach to roles for extended permissions"
  type        = list(string)
  default     = []

  validation {
    condition     = all(var.additional_policy_arns, can(regex("^arn:aws:iam::\\d{12}:policy", )))
    error_message = "All policy ARNs must be valid AWS IAM policy ARNs"
  }
}

# Resource tagging variable
variable "tags" {
  description = "Additional tags to apply to IAM resources for resource management and cost allocation"
  type        = map(string)
  default     = {}
}

# Local variables for common resource tagging
locals {
  common_tags = merge(
    var.tags,
    {
      Environment         = var.environment
      Project            = var.project
      ManagedBy          = "terraform"
      SecurityCompliance = "pci-dss,iso-27001,soc2"
      LastUpdated       = timestamp()
    }
  )
}