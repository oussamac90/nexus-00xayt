#!/bin/bash

# Nexus Platform Rollback Script
# Version: 1.0.0
# Description: Enterprise-grade rollback script for Nexus Platform deployments
# Handles application and database state rollback with minimal downtime

# Enable strict error handling
set -e
set -o pipefail

# Global variables
readonly AWS_REGION=${AWS_REGION:-us-west-2}
readonly ENVIRONMENT=${ENVIRONMENT:-production}
readonly CLUSTER_NAME=${CLUSTER_NAME:-nexus-${ENVIRONMENT}}
readonly HELM_TIMEOUT="300s"
readonly MAX_RETRY_ATTEMPTS=3
readonly ROLLBACK_LOG="/var/log/nexus/rollback.log"
readonly APPROVAL_REQUIRED="${ENVIRONMENT} == 'production' || ${ENVIRONMENT} == 'staging'"
readonly BACKUP_RETENTION=30
readonly HEALTH_CHECK_TIMEOUT="600s"

# Set up logging
log() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local level=$1
    local message=$2
    local correlation_id=${3:-$(uuidgen)}
    echo "${timestamp}|rollback|${level}|${message}|${correlation_id}" | tee -a "${ROLLBACK_LOG}"
}

# Error handling
trap 'handle_error $? $LINENO' ERR
trap 'cleanup' EXIT

handle_error() {
    local exit_code=$1
    local line_number=$2
    log "ERROR" "Rollback failed at line ${line_number} with exit code ${exit_code}"
    notify_team "FAILURE" "Rollback failed at line ${line_number}. Check ${ROLLBACK_LOG} for details."
    cleanup
    exit 1
}

cleanup() {
    log "INFO" "Performing cleanup operations"
    # Release any locks
    release_locks
    # Remove temporary files
    rm -f /tmp/rollback-*.tmp
}

check_prerequisites() {
    log "INFO" "Checking prerequisites"
    
    # Check required tools
    local required_tools=("aws" "kubectl" "helm" "argocd")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done

    # Verify AWS CLI configuration
    aws sts get-caller-identity &> /dev/null || {
        log "ERROR" "AWS CLI not properly configured"
        return 1
    }

    # Verify kubectl access
    kubectl cluster-info &> /dev/null || {
        log "ERROR" "kubectl not properly configured"
        return 1
    }

    # Check ArgoCD authentication
    argocd account list &> /dev/null || {
        log "ERROR" "ArgoCD not properly authenticated"
        return 1
    }

    return 0
}

get_previous_version() {
    local release_name=$1
    local namespace=$2
    
    log "INFO" "Getting previous stable version for ${release_name} in ${namespace}"
    
    # Get Helm release history
    local previous_version=$(helm history "${release_name}" -n "${namespace}" -o json | \
        jq -r 'map(select(.status == "deployed" and .description != "Rollback"))[.-2].revision')
    
    if [[ -z "${previous_version}" ]]; then
        log "ERROR" "No previous stable version found"
        return 1
    }
    
    echo "${previous_version}"
}

rollback_helm_release() {
    local release_name=$1
    local namespace=$2
    local version=$3
    
    log "INFO" "Rolling back ${release_name} to version ${version}"
    
    # Scale down current deployment
    kubectl scale deployment -n "${namespace}" -l "app=${release_name}" --replicas=0
    
    # Take pre-rollback snapshot
    take_snapshot "${release_name}" "${namespace}"
    
    # Execute Helm rollback
    if ! helm rollback "${release_name}" "${version}" \
        -n "${namespace}" \
        --timeout "${HELM_TIMEOUT}" \
        --wait; then
        log "ERROR" "Helm rollback failed"
        return 1
    fi
    
    return 0
}

rollback_database() {
    local backup_id=$1
    
    log "INFO" "Rolling back database to backup ${backup_id}"
    
    # Stop affected services
    kubectl scale deployment -n "${ENVIRONMENT}" -l "tier=application" --replicas=0
    
    # Create recovery point
    create_recovery_point
    
    # Restore database
    if ! restore_database "${backup_id}"; then
        log "ERROR" "Database restore failed"
        return 1
    fi
    
    # Verify data consistency
    verify_data_consistency
    
    return 0
}

verify_rollback() {
    log "INFO" "Verifying rollback status"
    
    # Check pod status
    local pod_status=$(kubectl get pods -n "${ENVIRONMENT}" -o json | \
        jq -r '.items[].status.phase' | grep -v "Running" | wc -l)
    
    if [[ "${pod_status}" -ne 0 ]]; then
        log "ERROR" "Pod verification failed"
        return 1
    }
    
    # Check service health
    if ! timeout "${HEALTH_CHECK_TIMEOUT}" verify_service_health; then
        log "ERROR" "Service health check failed"
        return 1
    }
    
    # Verify database connectivity
    if ! verify_database_connectivity; then
        log "ERROR" "Database connectivity check failed"
        return 1
    }
    
    return 0
}

notify_team() {
    local status=$1
    local details=$2
    
    log "INFO" "Sending notifications - Status: ${status}"
    
    # Send Slack notification
    send_slack_notification "${status}" "${details}"
    
    # Send email notification
    send_email_notification "${status}" "${details}"
    
    # Create incident ticket if failure
    if [[ "${status}" == "FAILURE" ]]; then
        create_incident_ticket "${details}"
    fi
}

main() {
    local release_name=$1
    local namespace=$2
    
    log "INFO" "Starting rollback procedure for ${release_name}"
    
    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    }
    
    # Get previous version
    local previous_version
    if ! previous_version=$(get_previous_version "${release_name}" "${namespace}"); then
        log "ERROR" "Failed to get previous version"
        exit 1
    }
    
    # Check if approval is required
    if [[ "${APPROVAL_REQUIRED}" == "true" ]]; then
        if ! get_rollback_approval "${release_name}" "${previous_version}"; then
            log "INFO" "Rollback not approved"
            exit 0
        fi
    fi
    
    # Execute rollback
    if ! rollback_helm_release "${release_name}" "${namespace}" "${previous_version}"; then
        log "ERROR" "Helm rollback failed"
        exit 1
    fi
    
    # Rollback database if needed
    if [[ -n "${BACKUP_ID}" ]]; then
        if ! rollback_database "${BACKUP_ID}"; then
            log "ERROR" "Database rollback failed"
            exit 1
        fi
    fi
    
    # Verify rollback
    if ! verify_rollback; then
        log "ERROR" "Rollback verification failed"
        exit 1
    fi
    
    log "INFO" "Rollback completed successfully"
    notify_team "SUCCESS" "Rollback of ${release_name} to version ${previous_version} completed successfully"
    
    return 0
}

# Execute main function with arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi