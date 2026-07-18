# External S3-compatible backup commands

`scripts/backup/external-s3-restore.sh` provides the repository-controlled commands required by the Phase 6 external restore gate. It performs an authenticated application export, encrypts the export locally with AES-256-CBC using PBKDF2, uploads the encrypted object and manifest to an S3-compatible target, restores into the configured isolated staging endpoint, and requires an explicit verification response.

The script refuses missing inputs, non-HTTPS endpoints, and local/mock fallbacks. The bucket, prefix, encryption key, restore namespace, and verification endpoint must be selected by the operator and supplied through protected secrets.

Example command values for the GitHub environment, after the operator has configured the target:

```text
BACKUP_CREATE_COMMAND=BACKUP_SOURCE_URL=... BACKUP_OBJECT_KEY=... scripts/backup/external-s3-restore.sh create
BACKUP_RESTORE_COMMAND=BACKUP_OBJECT_KEY=... scripts/backup/external-s3-restore.sh restore
BACKUP_VERIFY_COMMAND=BACKUP_OBJECT_KEY=... scripts/backup/external-s3-restore.sh verify
```

The commands should be stored without credentials. Runtime credentials and target configuration belong in protected environment secrets. The create output contains the object key and digest; pass the exact object key to restore and verify. Evidence must record the non-secret object reference, digest, restore timestamps, and RPO/RTO without recording command output or credentials.
