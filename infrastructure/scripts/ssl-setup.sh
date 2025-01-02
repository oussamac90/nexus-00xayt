#!/bin/bash

# SSL/TLS Certificate Setup Script for Nexus B2B Platform
# Version: 1.0.0
# Purpose: Automated SSL/TLS certificate management with enhanced security and compliance

# External tool versions
# kubectl v1.27+
# helm v3.12+
# aws-cli v2.13+
# openssl 3.0+

set -euo pipefail

# Global variables
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.13.0}"
CERT_MANAGER_NAMESPACE="${CERT_MANAGER_NAMESPACE:-cert-manager}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
SECURITY_COMPLIANCE_LEVEL="${SECURITY_COMPLIANCE_LEVEL:-HIGH}"
CERT_ROTATION_DAYS="${CERT_ROTATION_DAYS:-60}"
VALIDATION_TIMEOUT="${VALIDATION_TIMEOUT:-300}"

# Logging function with severity levels
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    echo "[${timestamp}] [${level}] ${message}"
}

# Prerequisite validation
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check required tools
    for tool in kubectl helm aws openssl; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done

    # Validate Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    }

    # Validate AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials"
        exit 1
    }
}

# Install cert-manager with enhanced security features
install_cert_manager() {
    local version="$1"
    local namespace="$2"

    log "INFO" "Installing cert-manager version ${version} in namespace ${namespace}"

    # Add Jetstack Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

    # Install cert-manager with CRDs and security settings
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace "$namespace" \
        --version "$version" \
        --set installCRDs=true \
        --set global.leaderElection.namespace="$namespace" \
        --set securityContext.enabled=true \
        --set prometheus.enabled=true \
        --set webhook.securePort=10250 \
        --wait

    # Verify installation
    kubectl wait --for=condition=Available deployment --all -n "$namespace" --timeout="${VALIDATION_TIMEOUT}s"
}

# Configure ClusterIssuer with multi-region support
setup_cluster_issuer() {
    local email="$1"
    local regions="$2"
    
    log "INFO" "Configuring ClusterIssuer with email: ${email}"

    # Create Route53 credentials secret
    kubectl create secret generic route53-credentials \
        --from-literal=access-key-id="${AWS_ACCESS_KEY_ID}" \
        --from-literal=secret-access-key="${AWS_SECRET_ACCESS_KEY}" \
        --namespace "$CERT_MANAGER_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Apply ClusterIssuer for each region
    for region in ${regions//,/ }; do
        sed "s/REGION_PLACEHOLDER/$region/g" ../helm/cert-manager/templates/clusterissuer.yaml | \
        sed "s/EMAIL_PLACEHOLDER/$email/g" | \
        kubectl apply -f -
    done

    # Verify ClusterIssuer status
    kubectl wait --for=condition=Ready clusterissuer letsencrypt-prod --timeout="${VALIDATION_TIMEOUT}s"
}

# Configure certificates with enhanced security
configure_certificates() {
    local domains="$1"
    
    log "INFO" "Configuring certificates for domains: ${domains}"

    # Generate PKCS12 password
    local pkcs12_password=$(openssl rand -base64 32)
    
    # Create PKCS12 password secret
    kubectl create secret generic pkcs12-password \
        --from-literal=password="$pkcs12_password" \
        --namespace "$CERT_MANAGER_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Apply Certificate resources
    for domain in ${domains//,/ }; do
        sed "s/DOMAIN_PLACEHOLDER/$domain/g" ../helm/cert-manager/templates/certificate.yaml | \
        kubectl apply -f -
    done

    # Verify certificate issuance
    for domain in ${domains//,/ }; do
        kubectl wait --for=condition=Ready certificate "$domain-tls" \
            --namespace "$CERT_MANAGER_NAMESPACE" \
            --timeout="${VALIDATION_TIMEOUT}s"
    done
}

# Verify setup and compliance
verify_setup() {
    log "INFO" "Verifying SSL/TLS setup and compliance..."

    # Verify cert-manager components
    local components=("cert-manager" "cert-manager-webhook" "cert-manager-cainjector")
    for component in "${components[@]}"; do
        if ! kubectl get deployment "$component" -n "$CERT_MANAGER_NAMESPACE" &> /dev/null; then
            log "ERROR" "Component $component not found"
            exit 1
        fi
    done

    # Verify TLS certificates
    for cert in $(kubectl get certificates -n "$CERT_MANAGER_NAMESPACE" -o name); do
        local cert_status=$(kubectl get "$cert" -n "$CERT_MANAGER_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        if [ "$cert_status" != "True" ]; then
            log "ERROR" "Certificate $cert not ready"
            exit 1
        fi
    done

    # Security compliance checks
    if [ "$SECURITY_COMPLIANCE_LEVEL" = "HIGH" ]; then
        # Verify certificate key strength
        for secret in $(kubectl get secrets -n "$CERT_MANAGER_NAMESPACE" -l "cert-manager.io/certificate-name" -o name); do
            local key_strength=$(kubectl get "$secret" -n "$CERT_MANAGER_NAMESPACE" -o jsonpath='{.data.tls\.key}' | base64 -d | openssl rsa -in /dev/stdin -text -noout 2>/dev/null | grep "Private-Key:" | awk '{print $2}')
            if [ "$key_strength" -lt 2048 ]; then
                log "ERROR" "Weak private key detected in $secret"
                exit 1
            fi
        done
    fi

    log "INFO" "SSL/TLS setup verification completed successfully"
}

# Main execution
main() {
    local email=""
    local domains=""
    local regions=""
    local environment="production"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --email)
                email="$2"
                shift 2
                ;;
            --domains)
                domains="$2"
                shift 2
                ;;
            --regions)
                regions="$2"
                shift 2
                ;;
            --environment)
                environment="$2"
                shift 2
                ;;
            *)
                log "ERROR" "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done

    # Validate required parameters
    if [[ -z "$email" || -z "$domains" || -z "$regions" ]]; then
        log "ERROR" "Required parameters missing. Usage: $0 --email <email> --domains <domains> --regions <regions> [--environment <env>]"
        exit 1
    }

    # Execute setup process
    validate_prerequisites
    install_cert_manager "$CERT_MANAGER_VERSION" "$CERT_MANAGER_NAMESPACE"
    setup_cluster_issuer "$email" "$regions"
    configure_certificates "$domains"
    verify_setup

    log "INFO" "SSL/TLS setup completed successfully"
}

# Script execution
main "$@"