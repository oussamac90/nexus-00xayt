# AWS IAM configuration for Nexus Platform
# Provider version: hashicorp/aws ~> 5.0

# Import required provider and data sources
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Local variables for common resource configuration
locals {
  common_tags = {
    Environment         = var.environment
    Project            = var.project
    ManagedBy          = "terraform"
    SecurityCompliance = "PCI-DSS,ISO27001,SOC2"
    DataClassification = "CONFIDENTIAL"
    AuditLevel         = "HIGH"
  }
}

# Permission boundary policy for all IAM roles
resource "aws_iam_policy" "permission_boundary" {
  name        = "${var.project}-permission-boundary-${var.environment}"
  description = "Permission boundary for ${var.project} IAM roles in ${var.environment}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:*",
          "ec2:*",
          "rds:*",
          "elasticache:*",
          "s3:*",
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.region
            "aws:PrincipalAccount": data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# EKS cluster assume role policy document
data "aws_iam_policy_document" "eks_assume_role" {
  statement {
    sid     = "EKSClusterAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
    
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
    
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:eks:${var.region}:${data.aws_caller_identity.current.account_id}:cluster/*"]
    }
  }
}

# EKS cluster IAM role
resource "aws_iam_role" "eks_cluster" {
  name                 = "${var.project}-eks-cluster-role-${var.environment}"
  assume_role_policy   = data.aws_iam_policy_document.eks_assume_role.json
  permissions_boundary = aws_iam_policy.permission_boundary.arn
  force_detach_policies = true
  
  tags = merge(local.common_tags, {
    Role = "EKS-Cluster"
  })
}

# EKS cluster policy attachment
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS node group assume role policy
data "aws_iam_policy_document" "eks_node_assume_role" {
  statement {
    sid     = "EKSNodeAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# EKS node group IAM role
resource "aws_iam_role" "eks_node" {
  name                 = "${var.project}-eks-node-role-${var.environment}"
  assume_role_policy   = data.aws_iam_policy_document.eks_node_assume_role.json
  permissions_boundary = aws_iam_policy.permission_boundary.arn
  force_detach_policies = true
  
  tags = merge(local.common_tags, {
    Role = "EKS-Node"
  })
}

# EKS node group policy attachments
resource "aws_iam_role_policy_attachment" "eks_node_policy" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ])
  
  policy_arn = each.value
  role       = aws_iam_role.eks_node.name
}

# IRSA (IAM Roles for Service Accounts) OIDC provider
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  
  tags = local.common_tags
}

# Service account IAM roles
resource "aws_iam_role" "service_account" {
  for_each = var.service_accounts
  
  name                 = "${var.project}-${each.value.name}-sa-role-${var.environment}"
  assume_role_policy   = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub": "system:serviceaccount:${each.value.namespace}:${each.value.name}"
          }
        }
      }
    ]
  })
  permissions_boundary = aws_iam_policy.permission_boundary.arn
  
  tags = merge(local.common_tags, {
    ServiceAccount = each.value.name
    Namespace     = each.value.namespace
  })
}

# Service account policy attachments
resource "aws_iam_role_policy_attachment" "service_account_policies" {
  for_each = {
    for policy in flatten([
      for sa_key, sa in var.service_accounts : [
        for policy in sa.policies : {
          sa_key = sa_key
          policy = policy
        }
      ]
    ]) : "${policy.sa_key}-${policy.policy}" => policy
  }
  
  role       = aws_iam_role.service_account[each.value.sa_key].name
  policy_arn = each.value.policy
}

# Outputs
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role with enhanced security controls"
  value       = aws_iam_role.eks_cluster.arn
  sensitive   = true
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node group IAM role with security boundaries"
  value       = aws_iam_role.eks_node.arn
  sensitive   = true
}

output "service_account_role_arns" {
  description = "Map of service account IAM role ARNs"
  value       = {
    for key, role in aws_iam_role.service_account : key => role.arn
  }
  sensitive   = true
}