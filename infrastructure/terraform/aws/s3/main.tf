# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common resource tagging
locals {
  common_tags = {
    Environment         = var.environment
    Project            = "nexus-platform"
    ManagedBy          = "terraform"
    SecurityCompliance = "high"
    DataClassification = "confidential"
  }
}

# Primary S3 bucket with enhanced security configuration
resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name
  tags   = local.common_tags

  # Prevent accidental bucket deletion in production
  lifecycle {
    prevent_destroy = var.environment == "prod" ? true : false
  }
}

# Enable versioning for data protection and compliance
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Suspended"
  }
}

# Configure server-side encryption using KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Configure public access blocking (security best practice)
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure intelligent tiering for cost optimization
resource "aws_s3_bucket_intelligent_tiering_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  name   = "EntireS3Bucket"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

# Configure lifecycle rules for object management
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.key
      status = "Enabled"

      transition {
        days          = rule.value.transition_days
        storage_class = rule.value.storage_class
      }

      dynamic "expiration" {
        for_each = rule.value.expiration_days != null ? [1] : []
        content {
          days = rule.value.expiration_days
        }
      }
    }
  }
}

# Configure bucket logging if enabled
resource "aws_s3_bucket_logging" "main" {
  count  = var.logging_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id

  target_bucket = aws_s3_bucket.main.id
  target_prefix = "logs/"
}

# Configure bucket policy for secure access
resource "aws_s3_bucket_policy" "main" {
  bucket = aws_s3_bucket.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.main.arn,
          "${aws_s3_bucket.main.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Configure CORS if needed for web access
resource "aws_s3_bucket_cors_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://*.nexus-platform.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Export bucket information for other modules
output "s3_bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.main.arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the created S3 bucket"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}

# Data source for KMS key reference
data "aws_kms_key" "s3" {
  key_id = var.kms_key_id
}