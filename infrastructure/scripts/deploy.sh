#!/bin/bash

# Enable strict error handling and pipeline failure detection
set -e -o pipefail

# Global variables
AWS_REGION=${AWS_REGION:-us-west-2}
SECONDARY_REGION=${SECONDARY_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}
CLUSTER_NAME=${CLUSTER_NAME:-nexus-${ENVIRONMENT}}
HELM_TIMEOUT="300s"
HELM_VALUES_FILE="../helm/nexus/values.yaml"
HELM_CHART_PATH="../helm/nexus"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=30
DEPLOYMENT_TIMEOUT=600

# Trap handlers for cleanup and error reporting
trap 'handle_error $? $LINENO' ERR
trap 'cleanup' EXIT

# Error handling function
handle_error() {
    local exit_code=$1
    local line_number=$2
    echo "Error occurred in script at line: ${line_number}, exit code: ${exit_code}"
    notify_team "error" "Deployment failed at line ${line_number}" "{\"exit_code\": ${exit_code}, \"environment\": \"${ENVIRONMENT}\", \"region\": \"${AWS_REGION}\"}"
    exit ${exit_code}
}

# Cleanup function
cleanup() {
    echo "Performing cleanup operations..."
    # Remove temporary files and configurations
    rm -f /tmp/kubeconfig.* 2>/dev/null || true
    rm -f /tmp/helm-values.* 2>/dev/null || true
}

# Check deployment prerequisites
check_prerequisites() {
    echo "Checking deployment prerequisites..."
    
    # Check required tools
    local required_tools=("aws" "kubectl" "helm" "argocd")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &>/dev/null; then
            echo "Error: Required tool '${tool}' is not installed"
            return 1
        fi
    done

    # Verify AWS CLI configuration
    if ! aws sts get-caller-identity &>/dev/null; then
        echo "Error: AWS CLI is not properly configured"
        return 1
    fi

    # Verify required environment variables
    local required_vars=("ENVIRONMENT" "AWS_REGION" "CLUSTER_NAME")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo "Error: Required environment variable '${var}' is not set"
            return 1
        fi
    done

    # Check ArgoCD authentication
    if ! argocd account list &>/dev/null; then
        echo "Error: ArgoCD authentication failed"
        return 1
    }

    return 0
}

# Update kubeconfig for cluster access
update_kubeconfig() {
    local cluster_name=$1
    local region=$2
    local role_arn=$3

    echo "Updating kubeconfig for cluster: ${cluster_name} in region: ${region}"
    
    aws eks update-kubeconfig \
        --name "${cluster_name}" \
        --region "${region}" \
        --role-arn "${role_arn}" \
        --alias "${cluster_name}-${region}"

    # Verify cluster connectivity
    if ! kubectl cluster-info; then
        echo "Error: Failed to connect to cluster ${cluster_name} in ${region}"
        return 1
    }

    return 0
}

# Deploy Helm release with enhanced validation
deploy_helm_release() {
    local release_name=$1
    local namespace=$2
    local values_file=$3
    local region=$4

    echo "Deploying Helm release: ${release_name} to namespace: ${namespace} in region: ${region}"

    # Validate Helm chart dependencies
    helm dependency update "${HELM_CHART_PATH}"
    
    # Verify resource quotas
    kubectl describe quota -n "${namespace}" || true
    
    # Deploy/upgrade Helm release
    if ! helm upgrade --install "${release_name}" "${HELM_CHART_PATH}" \
        --namespace "${namespace}" \
        --create-namespace \
        --values "${values_file}" \
        --set "global.region=${region}" \
        --set "global.environment=${ENVIRONMENT}" \
        --timeout "${HELM_TIMEOUT}" \
        --atomic \
        --wait; then
        echo "Error: Helm deployment failed"
        return 1
    }

    # Wait for deployment completion
    local timeout=${DEPLOYMENT_TIMEOUT}
    while ((timeout > 0)); do
        if kubectl get pods -n "${namespace}" | grep -v Running | grep -v Completed; then
            sleep 5
            ((timeout-=5))
        else
            break
        fi
    done

    if ((timeout <= 0)); then
        echo "Error: Deployment timeout reached"
        return 1
    }

    return 0
}

# Verify deployment health
verify_deployment() {
    echo "Verifying deployment health..."
    
    local services=("api-gateway" "auth-service" "user-service" "product-service" "order-service" "payment-service" "shipping-service")
    
    for service in "${services[@]}"; do
        # Check pod status
        if ! kubectl get pods -l "app=${service}" -n "${ENVIRONMENT}" | grep -q "Running"; then
            echo "Error: ${service} pods are not running"
            return 1
        }

        # Check service endpoints
        if ! kubectl get endpoints "${service}" -n "${ENVIRONMENT}" | grep -q ":"; then
            echo "Error: ${service} endpoints are not ready"
            return 1
        }

        # Verify service health endpoints
        local retries=${HEALTH_CHECK_RETRIES}
        while ((retries > 0)); do
            if kubectl exec -it "deploy/${service}" -n "${ENVIRONMENT}" -- curl -s http://localhost:8080/actuator/health | grep -q "UP"; then
                break
            fi
            sleep "${HEALTH_CHECK_INTERVAL}"
            ((retries--))
        done

        if ((retries <= 0)); then
            echo "Error: Health check failed for ${service}"
            return 1
        }
    done

    return 0
}

# Send deployment notifications
notify_team() {
    local status=$1
    local details=$2
    local metrics=$3

    # Format notification message
    local message="Deployment Status: ${status}\nEnvironment: ${ENVIRONMENT}\nRegion: ${AWS_REGION}\nDetails: ${details}\nMetrics: ${metrics}"

    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${message}\"}" \
            "${SLACK_WEBHOOK_URL}"
    fi

    # Send email notification
    if [[ -n "${EMAIL_RECIPIENTS}" ]]; then
        echo "${message}" | mail -s "Deployment Status: ${status}" "${EMAIL_RECIPIENTS}"
    fi
}

# Main deployment function
main() {
    echo "Starting deployment process for environment: ${ENVIRONMENT}"

    # Check prerequisites
    if ! check_prerequisites; then
        echo "Prerequisites check failed"
        exit 1
    fi

    # Update kubeconfig for primary region
    if ! update_kubeconfig "${CLUSTER_NAME}" "${AWS_REGION}" "${AWS_ROLE_ARN}"; then
        echo "Failed to update kubeconfig for primary region"
        exit 1
    fi

    # Deploy to primary region
    if ! deploy_helm_release "nexus" "${ENVIRONMENT}" "${HELM_VALUES_FILE}" "${AWS_REGION}"; then
        echo "Deployment failed in primary region"
        exit 1
    fi

    # Verify deployment health
    if ! verify_deployment; then
        echo "Deployment verification failed"
        exit 1
    fi

    # Deploy to secondary region if multi-region is enabled
    if [[ -n "${SECONDARY_REGION}" ]]; then
        if ! update_kubeconfig "${CLUSTER_NAME}" "${SECONDARY_REGION}" "${AWS_ROLE_ARN}"; then
            echo "Failed to update kubeconfig for secondary region"
            exit 1
        fi

        if ! deploy_helm_release "nexus" "${ENVIRONMENT}" "${HELM_VALUES_FILE}" "${SECONDARY_REGION}"; then
            echo "Deployment failed in secondary region"
            exit 1
        fi

        if ! verify_deployment; then
            echo "Deployment verification failed in secondary region"
            exit 1
        fi
    fi

    # Send success notification
    notify_team "success" "Deployment completed successfully" "{\"duration\": \"$(date +%s)\", \"environment\": \"${ENVIRONMENT}\"}"

    echo "Deployment completed successfully"
    return 0
}

# Execute main function
main "$@"