# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster Kubernetes API server"
  value       = module.eks_module.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks_module.cluster_name
}

output "eks_certificate_authority" {
  description = "Certificate authority data for the EKS cluster"
  value       = module.eks_module.cluster_certificate_authority_data
  sensitive   = true
}

# RDS Database Outputs
output "primary_rds_endpoint" {
  description = "Endpoint of the primary RDS database instance"
  value       = module.rds_module.primary_db_endpoint
}

output "replica_rds_endpoint" {
  description = "Endpoint of the RDS read replica instance"
  value       = module.rds_module.replica_db_endpoint
}

output "rds_database_name" {
  description = "Name of the RDS database"
  value       = module.rds_module.db_name
}

# VPC and Network Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc_module.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc_module.private_subnets
}

output "availability_zones" {
  description = "List of availability zones used in the VPC"
  value       = module.vpc_module.availability_zones
}

# ElastiCache Redis Outputs
output "elasticache_primary_endpoint" {
  description = "Primary endpoint for the ElastiCache Redis cluster"
  value       = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
}

output "elasticache_reader_endpoint" {
  description = "Reader endpoint for the ElastiCache Redis cluster"
  value       = aws_elasticache_replication_group.redis_cluster.reader_endpoint_address
}

# S3 Storage Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for application assets"
  value       = aws_s3_bucket.app_assets.bucket
}

# Sensitive Outputs
output "database_master_password" {
  description = "Master password for the RDS database (sensitive)"
  value       = module.rds_module.master_password
  sensitive   = true
}

output "database_user_password" {
  description = "Application user password for the RDS database (sensitive)"
  value       = module.rds_module.user_password
  sensitive   = true
}

output "redis_auth_token" {
  description = "Authentication token for ElastiCache Redis (sensitive)"
  value       = aws_elasticache_replication_group.redis_cluster.auth_token
  sensitive   = true
}

output "eks_admin_token" {
  description = "Admin token for EKS cluster authentication (sensitive)"
  value       = module.eks_module.cluster_admin_token
  sensitive   = true
}