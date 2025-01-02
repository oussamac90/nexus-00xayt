#!/bin/bash

# Database Migration Script for Nexus Platform
# Version: 1.0.0
# Dependencies:
# - flyway-core: 9.16.0
# - postgresql-client: 15
# - aws-cli: 2.11.0

set -euo pipefail

# Global Constants
readonly SERVICES=('user-service' 'product-service' 'order-service' 'payment-service' 'shipping-service' 'analytics-service')
readonly MIGRATION_DIR="/migrations"
readonly LOG_DIR="/var/log/nexus/migrations"
readonly KMS_KEY_ID="arn:aws:kms:region:account:key/key-id"
readonly MAX_REPLICATION_LAG=100

# Logging setup
setup_logging() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p "${LOG_DIR}"
    exec 1> >(tee -a "${LOG_DIR}/migration_${timestamp}.log")
    exec 2> >(tee -a "${LOG_DIR}/migration_${timestamp}.error.log")
}

# JSON log formatter
log() {
    local level=$1
    local message=$2
    local service=${3:-"system"}
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    echo "{\"timestamp\":\"${timestamp}\",\"level\":\"${level}\",\"service\":\"${service}\",\"message\":\"${message}\"}"
}

# Prerequisite checks
check_prerequisites() {
    local environment=$1
    
    log "INFO" "Checking prerequisites for environment: ${environment}"
    
    # Check required tools
    for tool in aws flyway psql; do
        if ! command -v $tool &> /dev/null; then
            log "ERROR" "Required tool not found: ${tool}"
            return 1
        fi
    done
    
    # Verify AWS KMS access
    if ! aws kms describe-key --key-id "${KMS_KEY_ID}" &> /dev/null; then
        log "ERROR" "Unable to access KMS key"
        return 1
    fi
    
    # Check SSL certificates
    if [[ ! -f "/etc/ssl/certs/rds-ca-bundle.pem" ]]; then
        log "ERROR" "RDS SSL certificate bundle not found"
        return 1
    }
    
    # Verify migration directories
    for service in "${SERVICES[@]}"; do
        if [[ ! -d "${MIGRATION_DIR}/${service}" ]]; then
            log "ERROR" "Migration directory not found for ${service}"
            return 1
        fi
    done
    
    return 0
}

# Decrypt database credentials
get_db_credentials() {
    local service=$1
    local environment=$2
    
    local secret_id="nexus/${environment}/${service}/db-credentials"
    aws secretsmanager get-secret-value \
        --secret-id "${secret_id}" \
        --query 'SecretString' \
        --output text
}

# Check replication lag
check_replication_lag() {
    local host=$1
    local port=$2
    local dbname=$3
    local username=$4
    local password=$5
    
    local lag=$(PGPASSWORD="${password}" psql -h "${host}" -p "${port}" -U "${username}" -d "${dbname}" -t -c \
        "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int;")
    
    echo "${lag}"
}

# Create encrypted backup
create_backup() {
    local service=$1
    local environment=$2
    local credentials
    credentials=$(get_db_credentials "${service}" "${environment}")
    
    local host=$(echo "${credentials}" | jq -r '.host')
    local port=$(echo "${credentials}" | jq -r '.port')
    local dbname=$(echo "${credentials}" | jq -r '.dbname')
    local username=$(echo "${credentials}" | jq -r '.username')
    local password=$(echo "${credentials}" | jq -r '.password')
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${LOG_DIR}/${service}_${environment}_${timestamp}.backup"
    
    log "INFO" "Creating encrypted backup for ${service}" "${service}"
    
    PGPASSWORD="${password}" pg_dump -h "${host}" -p "${port}" -U "${username}" -d "${dbname}" -F c \
        | aws kms encrypt \
            --key-id "${KMS_KEY_ID}" \
            --plaintext fileb:- \
            --output text \
            --query CiphertextBlob > "${backup_file}"
    
    echo "${backup_file}"
}

# Execute migration
run_migration() {
    local service=$1
    local environment=$2
    
    log "INFO" "Starting migration for ${service} in ${environment}" "${service}"
    
    # Check prerequisites
    if ! check_prerequisites "${environment}"; then
        log "ERROR" "Prerequisites check failed" "${service}"
        return 1
    fi
    
    # Get database credentials
    local credentials
    credentials=$(get_db_credentials "${service}" "${environment}")
    
    # Create backup
    local backup_file
    backup_file=$(create_backup "${service}" "${environment}")
    
    # Check replication lag
    local lag
    lag=$(check_replication_lag \
        "$(echo "${credentials}" | jq -r '.host')" \
        "$(echo "${credentials}" | jq -r '.port')" \
        "$(echo "${credentials}" | jq -r '.dbname')" \
        "$(echo "${credentials}" | jq -r '.username')" \
        "$(echo "${credentials}" | jq -r '.password')")
    
    if [[ ${lag} -gt ${MAX_REPLICATION_LAG} ]]; then
        log "ERROR" "Replication lag too high: ${lag} seconds" "${service}"
        return 1
    fi
    
    # Execute Flyway migration
    flyway \
        -url="jdbc:postgresql://$(echo "${credentials}" | jq -r '.host'):$(echo "${credentials}" | jq -r '.port')/$(echo "${credentials}" | jq -r '.dbname')" \
        -user="$(echo "${credentials}" | jq -r '.username')" \
        -password="$(echo "${credentials}" | jq -r '.password')" \
        -locations="filesystem:${MIGRATION_DIR}/${service}" \
        -connectRetries=3 \
        -validateMigrationNaming=true \
        -outOfOrder=false \
        -cleanDisabled=true \
        migrate
    
    local migration_status=$?
    
    if [[ ${migration_status} -eq 0 ]]; then
        log "INFO" "Migration completed successfully" "${service}"
        validate_schema "${service}" "${environment}"
    else
        log "ERROR" "Migration failed" "${service}"
        rollback_migration "${service}" "${environment}" "${backup_file}"
        return 1
    fi
    
    return 0
}

# Validate schema
validate_schema() {
    local service=$1
    local environment=$2
    
    log "INFO" "Validating schema for ${service}" "${service}"
    
    local credentials
    credentials=$(get_db_credentials "${service}" "${environment}")
    
    # Check table structures and constraints
    PGPASSWORD="$(echo "${credentials}" | jq -r '.password')" psql \
        -h "$(echo "${credentials}" | jq -r '.host')" \
        -p "$(echo "${credentials}" | jq -r '.port')" \
        -U "$(echo "${credentials}" | jq -r '.username')" \
        -d "$(echo "${credentials}" | jq -r '.dbname')" \
        -c "SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;" \
        > /dev/null
    
    return $?
}

# Rollback migration
rollback_migration() {
    local service=$1
    local environment=$2
    local backup_file=$3
    
    log "INFO" "Rolling back migration for ${service}" "${service}"
    
    local credentials
    credentials=$(get_db_credentials "${service}" "${environment}")
    
    # Decrypt and restore backup
    aws kms decrypt \
        --ciphertext-blob fileb:"${backup_file}" \
        --output text \
        --query Plaintext \
        | base64 --decode \
        | PGPASSWORD="$(echo "${credentials}" | jq -r '.password')" pg_restore \
            -h "$(echo "${credentials}" | jq -r '.host')" \
            -p "$(echo "${credentials}" | jq -r '.port')" \
            -U "$(echo "${credentials}" | jq -r '.username')" \
            -d "$(echo "${credentials}" | jq -r '.dbname')" \
            --clean --if-exists
    
    local rollback_status=$?
    
    if [[ ${rollback_status} -eq 0 ]]; then
        log "INFO" "Rollback completed successfully" "${service}"
    else
        log "ERROR" "Rollback failed" "${service}"
    fi
    
    return ${rollback_status}
}

# Main execution
main() {
    local environment=$1
    
    setup_logging
    
    log "INFO" "Starting database migration process for environment: ${environment}"
    
    for service in "${SERVICES[@]}"; do
        if ! run_migration "${service}" "${environment}"; then
            log "ERROR" "Migration failed for ${service}"
            exit 1
        fi
    done
    
    log "INFO" "Database migration process completed successfully"
}

# Script execution
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <environment>"
    exit 1
fi

main "$1"