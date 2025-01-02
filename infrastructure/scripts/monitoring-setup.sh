#!/bin/bash

# Monitoring Stack Setup Script for Nexus B2B Platform
# Version: 1.0.0
# Dependencies:
# - kubectl v1.27+
# - helm v3.12+

set -euo pipefail

# Global Variables
MONITORING_NAMESPACE="monitoring"
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="9.5.0"
ALERTMANAGER_VERSION="0.25.0"
JAEGER_VERSION="1.45.0"
ELK_VERSION="8.8.0"
MAX_RETRY_ATTEMPTS=3
BACKUP_RETENTION_DAYS=30
HA_REPLICA_COUNT=3

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl v1.27+"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install helm v3.12+"
        exit 1
    }
    
    # Verify cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    }
    
    # Check helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    log_info "Prerequisites validation completed successfully"
}

# Setup monitoring namespace with enhanced security
setup_monitoring_namespace() {
    log_info "Setting up monitoring namespace..."
    
    # Create namespace if not exists
    kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply resource quotas
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: ${MONITORING_NAMESPACE}
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
EOF
    
    # Apply network policies
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: ${MONITORING_NAMESPACE}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.0.0/16
EOF
    
    log_info "Monitoring namespace setup completed"
}

# Configure security monitoring
configure_security_monitoring() {
    local config_file=$1
    log_info "Configuring security monitoring..."
    
    # Setup Prometheus alert rules for security monitoring
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: security-alerts
  namespace: ${MONITORING_NAMESPACE}
spec:
  groups:
  - name: security
    rules:
    - alert: HighAuthFailureRate
      expr: rate(authentication_failures_total[5m]) > 10
      for: 5m
      labels:
        severity: critical
      annotations:
        description: High rate of authentication failures detected
    - alert: AbnormalAPIUsage
      expr: rate(api_requests_total[5m]) > 1000
      for: 5m
      labels:
        severity: warning
      annotations:
        description: Abnormal API usage pattern detected
EOF
    
    log_info "Security monitoring configuration completed"
}

# Setup high availability configuration
setup_high_availability() {
    log_info "Configuring high availability..."
    
    # Configure Prometheus HA
    cat <<EOF > prometheus-values.yaml
prometheus:
  replicaCount: ${HA_REPLICA_COUNT}
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
        - key: app
          operator: In
          values:
          - prometheus
      topologyKey: kubernetes.io/hostname
  persistentVolume:
    size: 100Gi
    storageClass: "managed-premium"

alertmanager:
  replicaCount: ${HA_REPLICA_COUNT}
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
        - key: app
          operator: In
          values:
          - alertmanager
      topologyKey: kubernetes.io/hostname
EOF
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        -f prometheus-values.yaml \
        --namespace ${MONITORING_NAMESPACE} \
        --version ${PROMETHEUS_VERSION}
        
    log_info "High availability configuration completed"
}

# Setup backup procedures
setup_backups() {
    log_info "Configuring backup procedures..."
    
    # Create backup CronJob
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: monitoring-backup
  namespace: ${MONITORING_NAMESPACE}
spec:
  schedule: "0 1 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              kubectl -n ${MONITORING_NAMESPACE} get configmap,secret -o yaml > /backup/monitoring-backup-\$(date +%Y%m%d).yaml
          restartPolicy: OnFailure
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: monitoring-backup-pvc
EOF
    
    log_info "Backup procedures configured"
}

# Main setup function
main() {
    log_info "Starting monitoring stack setup..."
    
    # Validate prerequisites
    validate_prerequisites
    
    # Setup namespace and security
    setup_monitoring_namespace
    
    # Configure security monitoring
    configure_security_monitoring "monitoring-values.yaml"
    
    # Setup high availability
    setup_high_availability
    
    # Configure backups
    setup_backups
    
    log_info "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"