#!/bin/bash

# Nexus Platform Secrets Rotation Script
# Version: 1.0.0
# Description: Automated rotation of various secrets and credentials used across the Nexus Platform
# Dependencies: aws-cli (2.x), kubectl (1.27+), jq (1.6+)

set -euo pipefail

# Global variables
AWS_REGION=${AWS_REGION:-us-west-2}
ENVIRONMENT=${ENVIRONMENT:-production}
ROTATION_INTERVAL=30
LOG_FILE=/var/log/nexus/secrets-rotation.log
TEMP_DIR=$(mktemp -d)
LOCK_FILE="/var/run/nexus-secrets-rotation.lock"

# Cleanup function
cleanup() {
    rm -rf "${TEMP_DIR}"
    rm -f "${LOCK_FILE}"
}

# Error handling
trap 'cleanup' EXIT
trap 'error_handler $? $LINENO $BASH_LINENO "$BASH_COMMAND" $(printf "::%s" ${FUNCNAME[@]:-})' ERR

# Logging function
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Error handler
error_handler() {
    local exit_code=$1
    local line_no=$2
    local bash_lineno=$3
    local last_command=$4
    local func_trace=$5
    
    log "ERROR" "Exit code ${exit_code} at line ${line_no}. Command: ${last_command}"
    log "ERROR" "Function trace: ${func_trace}"
    
    cleanup
    exit "${exit_code}"
}

# Check prerequisites
check_prerequisites() {
    local missing_deps=()
    
    for cmd in aws kubectl jq; do
        if ! command -v "${cmd}" &> /dev/null; then
            missing_deps+=("${cmd}")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "ERROR" "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Rotate database credentials
rotate_database_credentials() {
    local db_instance_identifier=$1
    local temp_password_file="${TEMP_DIR}/db_password.tmp"
    
    log "INFO" "Starting database credentials rotation for ${db_instance_identifier}"
    
    # Generate new password meeting PCI DSS requirements
    local new_password=$(aws secretsmanager get-random-password \
        --password-length 32 \
        --require-each-included-type \
        --exclude-characters "\"'\\/" \
        --region "${AWS_REGION}" \
        --output text --query RandomPassword)
    
    echo "${new_password}" > "${temp_password_file}"
    
    # Update RDS master password with retry logic
    local retries=3
    local success=false
    
    while [ $retries -gt 0 ] && [ "$success" = false ]; do
        if aws rds modify-db-instance \
            --db-instance-identifier "${db_instance_identifier}" \
            --master-user-password "${new_password}" \
            --region "${AWS_REGION}"; then
            success=true
        else
            retries=$((retries-1))
            sleep 5
        fi
    done
    
    if [ "$success" = false ]; then
        log "ERROR" "Failed to update RDS password after multiple attempts"
        return 1
    fi
    
    # Update Kubernetes secret
    kubectl create secret generic nexus-db-credentials \
        --from-file=password="${temp_password_file}" \
        --dry-run=client -o yaml | \
        kubectl apply -f -
    
    rm -f "${temp_password_file}"
    log "INFO" "Database credentials rotation completed successfully"
    return 0
}

# Rotate API keys
rotate_api_keys() {
    local service_name=$1
    
    log "INFO" "Starting API key rotation for ${service_name}"
    
    # Generate new API key
    local new_api_key=$(aws secretsmanager get-random-password \
        --password-length 48 \
        --require-each-included-type \
        --region "${AWS_REGION}" \
        --output text --query RandomPassword)
    
    # Store new API key in AWS Secrets Manager
    aws secretsmanager update-secret \
        --secret-id "nexus/${ENVIRONMENT}/${service_name}/api-key" \
        --secret-string "${new_api_key}" \
        --region "${AWS_REGION}"
    
    # Update Kubernetes secret
    kubectl create secret generic "${service_name}-api-key" \
        --from-literal=api-key="${new_api_key}" \
        --dry-run=client -o yaml | \
        kubectl apply -f -
    
    log "INFO" "API key rotation completed for ${service_name}"
    return 0
}

# Rotate JWT signing keys
rotate_jwt_secret() {
    log "INFO" "Starting JWT signing key rotation"
    
    # Generate new JWT secret
    local new_jwt_secret=$(openssl rand -base64 64)
    
    # Store new JWT secret with versioning
    local timestamp=$(date +%s)
    aws secretsmanager update-secret \
        --secret-id "nexus/${ENVIRONMENT}/jwt-secret" \
        --secret-string "{\"key\":\"${new_jwt_secret}\",\"version\":\"${timestamp}\"}" \
        --region "${AWS_REGION}"
    
    # Update Kubernetes secret with overlapping validity
    kubectl create secret generic nexus-jwt-secret \
        --from-literal=current-key="${new_jwt_secret}" \
        --from-literal=previous-key="$(kubectl get secret nexus-jwt-secret -o jsonpath='{.data.current-key}' | base64 -d)" \
        --dry-run=client -o yaml | \
        kubectl apply -f -
    
    log "INFO" "JWT signing key rotation completed"
    return 0
}

# Rotate encryption keys
rotate_encryption_keys() {
    log "INFO" "Starting encryption key rotation"
    
    # Get KMS key ID from Terraform output
    local kms_key_id=$(aws kms describe-key \
        --key-id "alias/nexus-platform-${ENVIRONMENT}" \
        --region "${AWS_REGION}" \
        --query 'KeyMetadata.KeyId' \
        --output text)
    
    # Create new key version
    aws kms create-key \
        --description "Nexus Platform encryption key - ${ENVIRONMENT}" \
        --region "${AWS_REGION}" \
        --tags TagKey=Environment,TagValue="${ENVIRONMENT}"
    
    # Update key alias
    aws kms update-alias \
        --alias-name "alias/nexus-platform-${ENVIRONMENT}" \
        --target-key-id "${kms_key_id}" \
        --region "${AWS_REGION}"
    
    log "INFO" "Encryption key rotation completed"
    return 0
}

# Validate rotation
validate_rotation() {
    local secret_type=$1
    local service_name=$2
    
    log "INFO" "Validating rotation for ${secret_type} in ${service_name}"
    
    # Perform health checks
    if ! kubectl rollout status deployment "${service_name}" -n default; then
        log "ERROR" "Service deployment health check failed"
        return 1
    fi
    
    # Verify secret accessibility
    if ! kubectl get secret "${service_name}-${secret_type}" &> /dev/null; then
        log "ERROR" "Unable to access rotated secret"
        return 1
    }
    
    log "INFO" "Rotation validation successful for ${secret_type}"
    return 0
}

# Main execution
main() {
    # Prevent multiple instances
    if ! mkdir "${LOCK_FILE}" 2>/dev/null; then
        log "ERROR" "Another instance is running"
        exit 1
    fi
    
    # Check prerequisites
    check_prerequisites
    
    log "INFO" "Starting secrets rotation process"
    
    # Rotate database credentials
    rotate_database_credentials "nexus-${ENVIRONMENT}-db" && \
        validate_rotation "db-credentials" "nexus-db"
    
    # Rotate service API keys
    for service in "payment" "notification"; do
        rotate_api_keys "${service}-service" && \
            validate_rotation "api-key" "${service}-service"
    done
    
    # Rotate JWT signing keys
    rotate_jwt_secret && \
        validate_rotation "jwt-secret" "auth-service"
    
    # Rotate encryption keys
    rotate_encryption_keys && \
        validate_rotation "encryption-key" "nexus-platform"
    
    log "INFO" "Secrets rotation process completed successfully"
}

# Execute main function
main "$@"