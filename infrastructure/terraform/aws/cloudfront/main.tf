# AWS CloudFront CDN Configuration for Nexus Platform
# terraform >= 1.0
# provider aws ~> 5.0

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Common resource tags
locals {
  common_tags = {
    Environment    = var.environment
    Project       = "nexus-platform"
    ManagedBy     = "terraform"
    SecurityLevel = "high"
    CostCenter    = "platform-infrastructure"
  }
}

# Create Origin Access Identity for secure S3 access
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${var.domain_name} - Nexus Platform CDN"
}

# Primary CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = var.price_class
  aliases             = [var.domain_name]
  web_acl_id          = var.waf_web_acl_id
  retain_on_delete    = false
  wait_for_deployment = true
  tags                = local.common_tags

  # Primary S3 Origin Configuration
  origin {
    domain_name = data.aws_s3_bucket.origin.bucket_regional_domain_name
    origin_id   = "S3-${var.domain_name}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }

    origin_shield {
      enabled              = true
      origin_shield_region = "us-east-1"
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_uuid.origin_verify.result
    }
  }

  # Default Cache Behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.domain_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = var.min_ttl
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    cache_policy_id            = aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.s3_origin.id
  }

  # Custom Error Responses
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }

  # SSL/TLS Configuration
  viewer_certificate {
    acm_certificate_arn      = var.ssl_certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  # Geo Restriction
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }

  # Logging Configuration
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      include_cookies = true
      bucket         = var.log_bucket_name
      prefix         = "cdn-logs/${var.domain_name}/"
    }
  }

  # Origin Failover Configuration
  origin_group {
    origin_id = "OriginGroupS3"

    failover_criteria {
      status_codes = var.origin_failover_status_codes
    }

    member {
      origin_id = "S3-${var.domain_name}"
    }

    member {
      origin_id = "S3-Backup-${var.domain_name}"
    }
  }
}

# Security Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "security-headers-${var.environment}"
  comment = "Security headers policy for ${var.domain_name}"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      override                = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
  }
}

# Cache Policy
resource "aws_cloudfront_cache_policy" "optimized" {
  name        = "cache-optimized-${var.environment}"
  comment     = "Optimized cache policy for ${var.domain_name}"
  min_ttl     = var.min_ttl
  default_ttl = var.default_ttl
  max_ttl     = var.max_ttl

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Origin Request Policy
resource "aws_cloudfront_origin_request_policy" "s3_origin" {
  name    = "s3-origin-${var.environment}"
  comment = "S3 origin policy for ${var.domain_name}"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
    }
  }
  query_strings_config {
    query_string_behavior = "none"
  }
}

# Random UUID for origin verification
resource "random_uuid" "origin_verify" {}

# Outputs
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.main.id
  description = "ID of the CloudFront distribution"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "Domain name of the CloudFront distribution"
}