# EKS Cluster Name
variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster for the Nexus Platform"
  default     = "nexus-platform-eks"

  validation {
    condition     = length(var.cluster_name) <= 40 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be 40 characters or less, start with a letter, and contain only alphanumeric characters and hyphens"
  }
}

# Kubernetes Version
variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster, must be 1.27 or higher for production requirements"
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.cluster_version))
    error_message = "Cluster version must be 1.27 or higher for production deployment"
  }
}

# Node Group Configuration
variable "node_group_config" {
  type        = object({
    instance_types  = list(string)
    desired_size    = number
    min_size       = number
    max_size       = number
    disk_size      = number
    capacity_type  = string
    ami_type       = string
    max_unavailable = number
  })
  description = "Configuration for EKS node groups supporting multi-AZ deployment"
  default     = {
    instance_types  = ["t3.large"]
    desired_size    = 3
    min_size       = 2
    max_size       = 5
    disk_size      = 100
    capacity_type  = "ON_DEMAND"
    ami_type       = "AL2_x86_64"
    max_unavailable = 1
  }

  validation {
    condition     = var.node_group_config.min_size <= var.node_group_config.desired_size && var.node_group_config.desired_size <= var.node_group_config.max_size && var.node_group_config.disk_size >= 100
    error_message = "Node group configuration must be valid: min <= desired <= max, and disk size >= 100GB"
  }
}

# Cluster Logging Configuration
variable "cluster_logging" {
  type        = list(string)
  description = "List of EKS cluster logging types to enable for audit and compliance"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  validation {
    condition     = length(setintersection(var.cluster_logging, ["api", "audit", "authenticator", "controllerManager", "scheduler"])) == length(var.cluster_logging)
    error_message = "Invalid logging types specified. Must be one or more of: api, audit, authenticator, controllerManager, scheduler"
  }
}

# Cluster Endpoint Access Configuration
variable "cluster_endpoint_access" {
  type = object({
    public_access                = bool
    private_access              = bool
    public_access_cidrs         = list(string)
    endpoint_private_access_sg  = list(string)
    endpoint_private_access_vpc = list(string)
  })
  description = "Configuration for EKS cluster endpoint access control"
  default = {
    public_access                = true
    private_access              = true
    public_access_cidrs         = ["0.0.0.0/0"]
    endpoint_private_access_sg  = []
    endpoint_private_access_vpc = []
  }

  validation {
    condition     = var.cluster_endpoint_access.public_access || var.cluster_endpoint_access.private_access
    error_message = "At least one endpoint access type (public or private) must be enabled"
  }
}

# Cluster Addons Configuration
variable "cluster_addons" {
  type = object({
    vpc_cni = object({
      enabled          = bool
      version         = string
      resolve_conflicts = string
    })
    coredns = object({
      enabled          = bool
      version         = string
      resolve_conflicts = string
    })
    kube_proxy = object({
      enabled          = bool
      version         = string
      resolve_conflicts = string
    })
  })
  description = "Configuration for essential EKS cluster addons"
  default = {
    vpc_cni = {
      enabled           = true
      version          = "v1.12.0"
      resolve_conflicts = "OVERWRITE"
    }
    coredns = {
      enabled           = true
      version          = "v1.9.3"
      resolve_conflicts = "OVERWRITE"
    }
    kube_proxy = {
      enabled           = true
      version          = "v1.27.1"
      resolve_conflicts = "OVERWRITE"
    }
  }
}

# Resource Tags
variable "tags" {
  type        = map(string)
  description = "Additional tags for EKS resources following organizational standards"
  default = {
    Environment   = "production"
    Platform      = "nexus"
    ManagedBy     = "terraform"
    BusinessUnit  = "trade"
    CostCenter    = "platform-infrastructure"
  }

  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "Platform")
    error_message = "Tags must include at minimum Environment and Platform keys"
  }
}