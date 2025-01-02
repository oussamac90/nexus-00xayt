# Required Terraform version
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary domain name for the Route53 hosted zone
variable "domain_name" {
  type        = string
  description = "Primary domain name for the Route53 hosted zone"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name"
  }
}

# Health check configuration toggle
variable "enable_health_check" {
  type        = bool
  description = "Enable Route53 health checks for endpoints"
  default     = true
}

# Health check endpoint path
variable "health_check_path" {
  type        = string
  description = "Path for Route53 health check endpoint"
  default     = "/health"
}

# Health check port number
variable "health_check_port" {
  type        = number
  description = "Port for Route53 health check endpoint"
  default     = 443
}

# Health check protocol type
variable "health_check_type" {
  type        = string
  description = "Protocol for Route53 health check"
  default     = "HTTPS"

  validation {
    condition     = contains(["HTTP", "HTTPS", "TCP"], var.health_check_type)
    error_message = "Health check type must be one of: HTTP, HTTPS, TCP"
  }
}

# Health check regions
variable "health_check_regions" {
  type        = list(string)
  description = "AWS regions to perform health checks from"
  default     = ["us-east-1", "eu-west-1", "ap-southeast-1"]
}

# Multi-region configuration toggle
variable "enable_multi_region" {
  type        = bool
  description = "Enable multi-region DNS routing configuration"
  default     = true
}

# Failover routing policy toggle
variable "failover_routing_policy" {
  type        = bool
  description = "Enable failover routing policy for multi-region setup"
  default     = true
}

# Health check interval configuration
variable "health_check_interval" {
  type        = number
  description = "Interval between health checks in seconds"
  default     = 30

  validation {
    condition     = contains([10, 30], var.health_check_interval)
    error_message = "Health check interval must be either 10 or 30 seconds"
  }
}

# Additional resource tags
variable "tags" {
  type        = map(string)
  description = "Additional tags for Route53 resources"
  default     = {}
}