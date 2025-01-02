# AWS Provider configuration with version constraint
# Version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary KMS key for the Nexus Platform
resource "aws_kms_key" "main" {
  description             = "Nexus Platform encryption key for ${var.environment} environment"
  deletion_window_in_days = var.key_deletion_window
  enable_key_rotation    = var.enable_key_rotation
  is_enabled             = true
  
  # Cryptographic configuration
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  
  # Enable multi-region replication for disaster recovery
  multi_region = true
  
  # Policy document for key access and management
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Key Management"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      }
    ]
  })

  # Resource tagging
  tags = merge(
    var.tags,
    {
      Environment = var.environment
      ManagedBy   = "terraform"
      Service     = "nexus-platform"
      Name        = "nexus-platform-${var.environment}-key"
      Purpose     = "data-encryption"
      Compliance  = "pci-dss,gdpr,iso27001"
    }
  )
}

# KMS key alias for easier reference
resource "aws_kms_alias" "main" {
  name          = "alias/nexus-platform-${var.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Output the KMS key ID for reference by other resources
output "key_id" {
  description = "The ID of the KMS key"
  value       = aws_kms_key.main.key_id
}

# Output the KMS key ARN for IAM policies
output "key_arn" {
  description = "The ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

# Output the KMS key alias ARN
output "alias_arn" {
  description = "The ARN of the KMS key alias"
  value       = aws_kms_alias.main.arn
}

# Output the KMS key alias name
output "alias_name" {
  description = "The name of the KMS key alias"
  value       = aws_kms_alias.main.name
}