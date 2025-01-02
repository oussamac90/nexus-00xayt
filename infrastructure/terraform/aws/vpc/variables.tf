# Terraform variables definition file for AWS VPC module
# Version: ~> 1.5

# Import environment configuration from parent module
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# VPC CIDR block configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC with strict validation for production network ranges"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && regex("^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/16$", var.vpc_cidr)
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation in 10.x.x.x/16 range for production use"
  }
}

# Availability Zones configuration
variable "azs" {
  type        = list(string)
  description = "List of availability zones for VPC deployment with high availability requirements"
  validation {
    condition     = length(var.azs) >= 2 && length(var.azs) <= 3
    error_message = "Between 2 and 3 availability zones must be specified for optimal high availability"
  }
}

# Private subnets configuration
variable "private_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets with strict size validation"
  validation {
    condition     = length(var.private_subnets) == length(var.azs) && alltrue([for cidr in var.private_subnets : can(cidrhost(cidr, 0))])
    error_message = "Number of private subnets must match number of availability zones and use valid CIDR notation"
  }
}

# Public subnets configuration
variable "public_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets with strict size validation"
  validation {
    condition     = length(var.public_subnets) == length(var.azs) && alltrue([for cidr in var.public_subnets : can(cidrhost(cidr, 0))])
    error_message = "Number of public subnets must match number of availability zones and use valid CIDR notation"
  }
}

# NAT Gateway configuration
variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway for private subnet internet access - required for production"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use a single NAT Gateway for all private subnets - disabled for high availability"
  default     = false
}

# DNS configuration
variable "enable_dns_hostnames" {
  type        = bool
  description = "Enable DNS hostnames in the VPC for service discovery"
  default     = true
}

variable "enable_dns_support" {
  type        = bool
  description = "Enable DNS support in the VPC for name resolution"
  default     = true
}

# VPC tagging configuration
variable "vpc_tags" {
  type        = map(string)
  description = "Additional tags for the VPC including environment and cost allocation"
  default     = {}
}