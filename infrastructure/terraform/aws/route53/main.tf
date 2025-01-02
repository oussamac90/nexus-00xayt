# Terraform AWS Route53 Configuration for Nexus Platform
# Version: AWS Provider ~> 5.0

# Configure required providers
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Reference CloudFront distribution for DNS alias records
data "aws_cloudfront_distribution" "main" {
  id = var.cloudfront_distribution_id
}

# Primary Route53 hosted zone with DNSSEC enabled
resource "aws_route53_zone" "main" {
  name          = var.domain_name
  comment       = "Managed by Terraform - ${var.environment} environment"
  force_destroy = false

  dnssec_config {
    signing_status = "SIGNING"
  }

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.domain_name}-zone"
    ManagedBy   = "terraform"
  })
}

# Primary A record for CloudFront distribution with failover routing
resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier = "primary"

  alias {
    name                   = data.aws_cloudfront_distribution.main.domain_name
    zone_id                = data.aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# Secondary A record for failover routing (if multi-region is enabled)
resource "aws_route53_record" "secondary" {
  count = var.enable_multi_region ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "secondary"

  alias {
    name                   = var.secondary_endpoint
    zone_id                = var.secondary_zone_id
    evaluate_target_health = true
  }
}

# Enhanced health check with multi-region support
resource "aws_route53_health_check" "main" {
  count = var.enable_health_check ? 1 : 0

  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  measure_latency   = true
  enable_sni        = true
  regions          = var.health_check_regions

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.domain_name}-health-check"
    ManagedBy   = "terraform"
  })

  # CloudWatch alarm integration
  cloudwatch_alarm_name     = "${var.domain_name}-health-check"
  cloudwatch_alarm_region   = "us-east-1"
  insufficient_data_health_status = "LastKnownStatus"
}

# DNSSEC key-signing key
resource "aws_route53_key_signing_key" "main" {
  hosted_zone_id             = aws_route53_zone.main.id
  key_management_service_arn = var.kms_key_arn
  name                       = "${var.environment}-key"
}

# Enable DNSSEC signing
resource "aws_route53_hosted_zone_dnssec" "main" {
  depends_on = [aws_route53_key_signing_key.main]
  
  hosted_zone_id = aws_route53_zone.main.id
}

# WWW CNAME record
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.domain_name]
}

# MX records for email routing
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = "300"
  records = [
    "10 mx1.${var.domain_name}",
    "20 mx2.${var.domain_name}"
  ]
}

# TXT record for domain verification
resource "aws_route53_record" "txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = "300"
  records = [
    "v=spf1 include:_spf.${var.domain_name} ~all"
  ]
}

# Output the name servers for the zone
output "name_servers" {
  description = "Name servers for the Route53 zone"
  value       = aws_route53_zone.main.name_servers
}

# Output the zone ID
output "zone_id" {
  description = "ID of the Route53 zone"
  value       = aws_route53_zone.main.zone_id
}

# Output the health check ID
output "health_check_id" {
  description = "ID of the Route53 health check"
  value       = var.enable_health_check ? aws_route53_health_check.main[0].id : null
}