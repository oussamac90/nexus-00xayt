#!/bin/bash

# Nexus Platform Backup Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.x
# - postgresql-client v15.x

set -euo pipefail

# Global Variables
BACKUP_ROOT="/tmp/nexus-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
S3_BUCKET="${S3_BUCKET_NAME}"
RDS_ENDPOINT="${RDS_ENDPOINT}"
BACKUP_RETENTION_DAYS=30
COMPRESSION_LEVEL=9
MAX_PARALLEL_JOBS=4
S3_STORAGE_CLASS="INTELLIGENT_TIERING"
KMS_KEY_ID="${KMS_KEY_ID}"
LOG_LEVEL="INFO"
LOG_FILE="/var/log/nexus/backups.log"

# Logging setup
setup_logging() {
    local log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
}

log() {
    local level=$1
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S')|${level}|${FUNCNAME[1]}|$*"
}

# Trap handlers for cleanup
trap 'cleanup "SIGTERM"' SIGTERM
trap 'cleanup "SIGINT"' SIGINT
trap 'cleanup "SIGQUIT"' SIGQUIT
trap 'cleanup "SIGHUP"' SIGHUP

cleanup() {
    local signal=$1
    log "INFO" "Received signal: $signal. Starting cleanup..."
    rm -rf "${BACKUP_ROOT}/${TIMESTAMP}"
    log "INFO" "Cleanup completed"
    exit 1
}

# Environment setup and validation
setup_backup_environment() {
    log "INFO" "Setting up backup environment"
    
    # Check disk space
    local required_space=$((50 * 1024 * 1024)) # 50GB minimum
    local available_space=$(df -k "${BACKUP_ROOT%/*}" | awk 'NR==2 {print $4}')
    
    if [ "$available_space" -lt "$required_space" ]; then
        log "ERROR" "Insufficient disk space. Required: ${required_space}KB, Available: ${available_space}KB"
        return 1
    fi

    # Create backup directory with secure permissions
    mkdir -p "${BACKUP_ROOT}/${TIMESTAMP}"
    chmod 700 "${BACKUP_ROOT}/${TIMESTAMP}"

    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log "ERROR" "Invalid AWS credentials"
        return 1
    }

    # Validate KMS key access
    if ! aws kms describe-key --key-id "$KMS_KEY_ID" >/dev/null 2>&1; then
        log "ERROR" "Invalid KMS key or insufficient permissions"
        return 1
    }

    # Test PostgreSQL connection
    if ! PGPASSWORD="${PGPASSWORD}" psql -h "$RDS_ENDPOINT" -U "${PGUSER}" -c '\l' >/dev/null 2>&1; then
        log "ERROR" "Unable to connect to PostgreSQL database"
        return 1
    }

    log "INFO" "Backup environment setup completed successfully"
    return 0
}

# Database backup function with parallel processing
backup_database() {
    local db_name=$1
    local output_path=$2
    local compression_level=$3
    local parallel_jobs=$4
    
    log "INFO" "Starting backup of database: $db_name"
    
    # Calculate optimal parallel jobs based on CPU cores
    local cpu_cores=$(nproc)
    local optimal_jobs=$(( cpu_cores > parallel_jobs ? parallel_jobs : cpu_cores ))
    
    # Perform backup with progress monitoring
    PGPASSWORD="${PGPASSWORD}" pg_dump \
        -h "$RDS_ENDPOINT" \
        -U "${PGUSER}" \
        -d "$db_name" \
        -j "$optimal_jobs" \
        -Fd \
        -Z "$compression_level" \
        -f "$output_path" 2>&1 | \
    while read -r line; do
        log "INFO" "pg_dump progress: $line"
    done
    
    if [ $? -ne 0 ]; then
        log "ERROR" "Database backup failed for: $db_name"
        return 1
    fi
    
    # Generate checksum
    sha256sum "$output_path"/* > "${output_path}.sha256"
    
    # Encrypt backup using AWS KMS
    for file in "$output_path"/*; do
        aws kms encrypt \
            --key-id "$KMS_KEY_ID" \
            --plaintext "fileb://$file" \
            --output text \
            --query CiphertextBlob > "${file}.encrypted"
        rm "$file"
    done
    
    log "INFO" "Database backup completed successfully: $db_name"
    return 0
}

# S3 upload with advanced features
upload_to_s3() {
    local local_path=$1
    local s3_path=$2
    local storage_class=$3
    
    log "INFO" "Starting upload to S3: $s3_path"
    
    # Enable S3 transfer acceleration
    aws configure set default.s3.use_accelerate_endpoint true
    
    # Calculate optimal multipart chunk size (minimum 5MB)
    local file_size=$(du -b "$local_path" | cut -f1)
    local chunk_size=$((file_size / 10000 + 5242880))
    
    # Upload with progress monitoring
    aws s3 cp \
        "$local_path" \
        "s3://${S3_BUCKET}/${s3_path}" \
        --storage-class "$storage_class" \
        --sse aws:kms \
        --sse-kms-key-id "$KMS_KEY_ID" \
        --metadata "timestamp=${TIMESTAMP}" \
        --expected-size "$file_size" \
        --multipart-chunk-size "$chunk_size" \
        --only-show-errors
    
    if [ $? -ne 0 ]; then
        log "ERROR" "S3 upload failed for: $s3_path"
        return 1
    }
    
    log "INFO" "S3 upload completed successfully: $s3_path"
    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    local backup_dir=$1
    local retention_days=$2
    local force_cleanup=${3:-false}
    
    log "INFO" "Starting cleanup of old backups"
    
    # Find and remove old local backups
    find "$backup_dir" -maxdepth 1 -type d -mtime +"$retention_days" | while read -r dir; do
        if [ -d "$dir" ]; then
            log "INFO" "Removing old backup: $dir"
            rm -rf "$dir"
        fi
    done
    
    # Cleanup old S3 backups (if force_cleanup is true)
    if [ "$force_cleanup" = true ]; then
        aws s3 ls "s3://${S3_BUCKET}/backups/" | \
        while read -r line; do
            local backup_date=$(echo "$line" | awk '{print $1}')
            local days_old=$(( ( $(date +%s) - $(date -d "$backup_date" +%s) ) / 86400 ))
            
            if [ "$days_old" -gt "$retention_days" ]; then
                local backup_path=$(echo "$line" | awk '{print $4}')
                log "INFO" "Removing old S3 backup: $backup_path"
                aws s3 rm "s3://${S3_BUCKET}/backups/$backup_path"
            fi
        done
    fi
    
    log "INFO" "Backup cleanup completed"
    return 0
}

# Send notifications
send_notification() {
    local status=$1
    local message=$2
    local metrics=$3
    
    log "INFO" "Sending backup notification: $status"
    
    # Format message with metrics
    local notification_message="Backup Status: $status
Message: $message
Metrics: $metrics
Timestamp: $TIMESTAMP"
    
    # Send SNS notification
    aws sns publish \
        --topic-arn "${SNS_TOPIC_ARN}" \
        --message "$notification_message" \
        --subject "Nexus Platform Backup: $status"
    
    # Update CloudWatch metrics
    aws cloudwatch put-metric-data \
        --namespace "NexusPlatform/Backups" \
        --metric-name "BackupStatus" \
        --value "$([[ $status == "SUCCESS" ]] && echo 1 || echo 0)" \
        --timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    log "INFO" "Notification sent successfully"
    return 0
}

# Main execution
main() {
    local start_time=$(date +%s)
    local backup_status="SUCCESS"
    local error_message=""
    
    # Setup logging
    setup_logging
    
    log "INFO" "Starting Nexus Platform backup process"
    
    # Initialize backup environment
    if ! setup_backup_environment; then
        backup_status="FAILED"
        error_message="Failed to setup backup environment"
        send_notification "$backup_status" "$error_message" ""
        exit 1
    fi
    
    # Backup databases
    for db in "nexus_prod" "nexus_analytics"; do
        local db_backup_path="${BACKUP_ROOT}/${TIMESTAMP}/${db}"
        
        if ! backup_database "$db" "$db_backup_path" "$COMPRESSION_LEVEL" "$MAX_PARALLEL_JOBS"; then
            backup_status="FAILED"
            error_message="Failed to backup database: $db"
            send_notification "$backup_status" "$error_message" ""
            exit 1
        fi
        
        # Upload to S3
        if ! upload_to_s3 "$db_backup_path" "backups/${TIMESTAMP}/${db}" "$S3_STORAGE_CLASS"; then
            backup_status="FAILED"
            error_message="Failed to upload backup to S3: $db"
            send_notification "$backup_status" "$error_message" ""
            exit 1
        fi
    done
    
    # Cleanup old backups
    if ! cleanup_old_backups "$BACKUP_ROOT" "$BACKUP_RETENTION_DAYS" false; then
        log "WARNING" "Backup cleanup failed but continuing"
    fi
    
    # Calculate metrics
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local metrics="Duration: ${duration}s"
    
    # Send success notification
    send_notification "$backup_status" "Backup completed successfully" "$metrics"
    
    log "INFO" "Backup process completed successfully"
    exit 0
}

# Execute main function
main