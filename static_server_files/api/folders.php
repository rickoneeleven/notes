<?php

// FOLDERS_FILE is already defined in index.php

function getFolders() {
    if (!file_exists(FOLDERS_FILE)) {
        return [];
    }
    
    $folders = json_decode(file_get_contents(FOLDERS_FILE), true);
    return $folders ?: [];
}

function saveFolders($folders) {
    file_put_contents(FOLDERS_FILE, json_encode($folders, JSON_PRETTY_PRINT));
}

function updateFolderTimestamp($folderName) {
    $folders = getFolders();
    $found = false;
    
    foreach ($folders as &$folder) {
        if ($folder['name'] === $folderName) {
            $folder['lastModified'] = date('c');
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        $folders[] = [
            'name' => $folderName,
            'lastModified' => date('c')
        ];
    }
    
    saveFolders($folders);
}

function createFolder($folderName) {
    if (empty($folderName)) {
        return ['error' => 'Folder name is required', 'code' => 400];
    }
    
    $folders = getFolders();
    foreach ($folders as $folder) {
        if ($folder['name'] === $folderName) {
            return ['error' => 'Folder already exists', 'code' => 409];
        }
    }
    
    $folders[] = [
        'name' => $folderName,
        'lastModified' => date('c')
    ];
    saveFolders($folders);
    
    return ['success' => true, 'folder' => ['name' => $folderName, 'lastModified' => date('c')]];
}

function renameFolder($oldName, $newName) {
    if (empty($newName)) {
        return ['error' => 'New folder name is required', 'code' => 400];
    }
    
    $folders = getFolders();
    $found = false;
    
    // Check if new name already exists
    foreach ($folders as $folder) {
        if ($folder['name'] === $newName && $folder['name'] !== $oldName) {
            return ['error' => 'Folder name already exists', 'code' => 409];
        }
    }
    
    // Rename folder
    foreach ($folders as &$folder) {
        if ($folder['name'] === $oldName) {
            $folder['name'] = $newName;
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        return ['error' => 'Folder not found', 'code' => 404];
    }
    
    saveFolders($folders);
    
    // Update all notes in the folder
    $files = glob(NOTES_DIR . '*.json');
    foreach ($files as $file) {
        if (basename($file) === 'folders.json') continue;
        
        $note = json_decode(file_get_contents($file), true);
        if (isset($note['folderName']) && $note['folderName'] === $oldName) {
            $note['folderName'] = $newName;
            file_put_contents($file, json_encode($note, JSON_PRETTY_PRINT));
        }
    }
    
    return ['success' => true];
}

function deleteFolder($folderName) {
    // Find folder and remove it from live folders.json
    $folders = getFolders();
    $folderToTrash = null;
    $newLiveFolders = [];
    foreach ($folders as $folder) {
        if ($folder['name'] === $folderName) {
            $folderToTrash = $folder;
        } else {
            $newLiveFolders[] = $folder;
        }
    }

    if ($folderToTrash === null) {
        return ['error' => 'Folder not found', 'code' => 404];
    }

    saveFolders($newLiveFolders); // Save the updated list of live folders

    // Add folder to deleted_folders.json
    $deletedFoldersFile = NOTES_DIR . 'deleted_folders.json';
    $deletedFolders = file_exists($deletedFoldersFile) ? json_decode(file_get_contents($deletedFoldersFile), true) : [];
    $folderToTrash['deleted_at'] = date('c');
    $deletedFolders[] = $folderToTrash;
    file_put_contents($deletedFoldersFile, json_encode($deletedFolders, JSON_PRETTY_PRINT));

    // Move all notes in the folder to the trash
    $files = glob(NOTES_DIR . '*.json');
    foreach ($files as $file) {
        if (basename($file) === 'folders.json' || basename($file) === 'deleted_folders.json') continue;

        $note = json_decode(file_get_contents($file), true);
        if (isset($note['folderName']) && $note['folderName'] === $folderName) {
            // trashNote is defined in api/index.php
            trashNote($note['id']);
        }
    }

    return ['success' => true];
}

function moveNoteToFolder($noteId, $folderName) {
    $filepath = NOTES_DIR . $noteId . '.json';
    if (!file_exists($filepath)) {
        return ['error' => 'Note not found', 'code' => 404];
    }
    
    $note = json_decode(file_get_contents($filepath), true);
    if (!$note) {
        return ['error' => 'Note not found', 'code' => 404];
    }
    
    // Validate folder exists if not moving to root
    if ($folderName !== null) {
        $folders = getFolders();
        $folderExists = false;
        foreach ($folders as $folder) {
            if ($folder['name'] === $folderName) {
                $folderExists = true;
                break;
            }
        }
        
        if (!$folderExists) {
            return ['error' => 'Folder does not exist', 'code' => 400];
        }
    }
    
    // Update note's folder
    if ($folderName === null) {
        unset($note['folderName']);
    } else {
        $note['folderName'] = $folderName;
    }
    
    // Update modified timestamp
    $note['modified'] = date('c');
    
    // Save note directly
    file_put_contents($filepath, json_encode($note, JSON_PRETTY_PRINT));
    
    // Update folder timestamp if moving to a folder
    if ($folderName !== null) {
        updateFolderTimestamp($folderName);
    }
    
    return ['note' => $note];
}

function restoreFolder($folderName) {
    $deletedFoldersFile = NOTES_DIR . 'deleted_folders.json';
    if (!file_exists($deletedFoldersFile)) {
        return ['error' => 'No deleted folders found', 'code' => 404];
    }

    $deletedFolders = json_decode(file_get_contents($deletedFoldersFile), true);
    $folderToRestore = null;
    $newDeletedFolders = [];

    // 1. Find the folder in the deleted list
    foreach ($deletedFolders as $folder) {
        if ($folder['name'] === $folderName) {
            $folderToRestore = $folder;
        } else {
            $newDeletedFolders[] = $folder;
        }
    }

    if ($folderToRestore === null) {
        return ['error' => 'Deleted folder not found', 'code' => 404];
    }

    // 2. Remove 'deleted_at' and add it back to the live folders list
    unset($folderToRestore['deleted_at']);
    $liveFolders = getFolders();
    $liveFolders[] = $folderToRestore;
    saveFolders($liveFolders);

    // 3. Save the updated list of deleted folders
    file_put_contents($deletedFoldersFile, json_encode($newDeletedFolders, JSON_PRETTY_PRINT));

    // 4. Restore all notes belonging to this folder
    $files = glob(DELETED_NOTES_DIR . '*.json');
    foreach ($files as $file) {
        $note = json_decode(file_get_contents($file), true);
        if (isset($note['folderName']) && $note['folderName'] === $folderName) {
            // restoreNote is defined in api/index.php
            restoreNote($note['id']);
        }
    }

    return ['success' => true];
}

?>