# Core Terraform functionality for variable definitions and validation blocks
# terraform ~> 1.5

# Domain name for the CloudFront distribution
variable "domain_name" {
  type        = string
  description = "Domain name for the CloudFront distribution"

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$", var.domain_name))
    error_message = "Domain name must be a valid hostname"
  }
}

# Price class configuration for CloudFront distribution
variable "price_class" {
  type        = string
  description = "Price class for CloudFront distribution (PriceClass_All, PriceClass_200, PriceClass_100)"
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "Price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100"
  }
}

# Origin S3 bucket configuration
variable "origin_bucket_name" {
  type        = string
  description = "Name of the S3 bucket to use as origin for CloudFront"
}

# WAF integration settings
variable "enable_waf" {
  type        = bool
  description = "Enable AWS WAF integration with CloudFront"
  default     = true
}

variable "waf_web_acl_id" {
  type        = string
  description = "ID of WAF Web ACL to associate with CloudFront distribution"
  default     = null
}

# SSL/TLS configuration
variable "ssl_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for custom domain SSL/TLS"
}

# Logging configuration
variable "enable_logging" {
  type        = bool
  description = "Enable CloudFront access logging"
  default     = true
}

variable "log_bucket_name" {
  type        = string
  description = "Name of S3 bucket for CloudFront access logs"
  default     = null
}

# Cache behavior settings
variable "default_ttl" {
  type        = number
  description = "Default TTL for CloudFront cache behavior in seconds"
  default     = 3600
}

variable "max_ttl" {
  type        = number
  description = "Maximum TTL for CloudFront cache behavior in seconds"
  default     = 86400
}

variable "min_ttl" {
  type        = number
  description = "Minimum TTL for CloudFront cache behavior in seconds"
  default     = 0
}

# Geo-restriction settings
variable "geo_restriction_type" {
  type        = string
  description = "Type of geo-restriction (none, whitelist, blacklist)"
  default     = "none"

  validation {
    condition     = contains(["none", "whitelist", "blacklist"], var.geo_restriction_type)
    error_message = "Geo restriction type must be one of: none, whitelist, blacklist"
  }
}

variable "geo_restriction_locations" {
  type        = list(string)
  description = "List of country codes for geo-restriction"
  default     = []
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Additional tags for CloudFront distribution"
  default     = {}
}