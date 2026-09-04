#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
db_path="${BASEBALL_DB_PATH:-$project_dir/data/baseball.db}"
backup_dir="${BASEBALL_BACKUP_DIR:-$project_dir/backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_name="baseball-${timestamp}.db"
backup_path="$backup_dir/$backup_name"

if [[ ! -f "$db_path" ]]; then
  echo "database not found: $db_path" >&2
  exit 1
fi

mkdir -p "$backup_dir"
cp "$db_path" "$backup_path"

if command -v gzip >/dev/null 2>&1; then
  gzip -f "$backup_path"
  backup_path="$backup_path.gz"
fi

echo "created backup: $backup_path"

if [[ -n "${GCS_URI:-}" ]]; then
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "GCS_URI is set but gcloud is not installed" >&2
    exit 1
  fi
  gcloud storage cp "$backup_path" "${GCS_URI%/}/"
fi

if [[ -n "${S3_URI:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "S3_URI is set but aws CLI is not installed" >&2
    exit 1
  fi
  aws s3 cp "$backup_path" "${S3_URI%/}/"
fi

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "RCLONE_REMOTE is set but rclone is not installed" >&2
    exit 1
  fi
  rclone copy "$backup_path" "${RCLONE_REMOTE%/}/"
fi
