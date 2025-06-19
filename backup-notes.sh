#!/bin/bash
# Hourly backup script for notes
# This script copies all notes to the backup folder without deleting existing backups

NOTES_DIR="/home/loopnova/domains/notes.pinescore.com/public_html/notes"
BACKUP_DIR="/home/loopnova/domains/notes.pinescore.com/public_html/backup"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Copy all notes to backup folder (overwrite existing, preserve deleted ones)
cp -rf "$NOTES_DIR"/* "$BACKUP_DIR"/ 2>/dev/null

# Log the backup
echo "$(date): Notes backup completed" >> "$BACKUP_DIR/backup.log"