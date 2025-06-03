<?php
function deleteDirectory($dir) {
    if (!is_dir($dir)) return;
    
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    rmdir($dir);
}

function getAssetPath($noteId, $filename) {
    return NOTES_DIR . $noteId . '/assets/' . $filename;
}

function ensureAssetsDirectory($noteId) {
    $assetsDir = NOTES_DIR . $noteId . '/assets';
    if (!file_exists($assetsDir)) {
        mkdir($assetsDir, 0755, true);
    }
    return $assetsDir;
}

function generateAssetFilename($noteId, $originalName) {
    $assetsDir = ensureAssetsDirectory($noteId);
    $pathInfo = pathinfo($originalName);
    $basename = $pathInfo['filename'];
    $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';
    
    $filename = $basename . $extension;
    $counter = 1;
    
    while (file_exists($assetsDir . '/' . $filename)) {
        $filename = $basename . '(' . $counter . ')' . $extension;
        $counter++;
    }
    
    return $filename;
}

function handleAssetUpload($noteId) {
    if (!isset($_FILES['asset'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded']);
        return;
    }
    
    $note = getNote($noteId, true);
    if (!$note) {
        http_response_code(404);
        echo json_encode(['error' => 'Note not found']);
        return;
    }
    
    $file = $_FILES['asset'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload failed']);
        return;
    }
    
    if ($file['size'] > MAX_UPLOAD_SIZE) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large']);
        return;
    }
    
    $filename = generateAssetFilename($noteId, $file['name']);
    $targetPath = getAssetPath($noteId, $filename);
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        if (!isset($note['assets'])) {
            $note['assets'] = [];
        }
        $note['assets'][] = $filename;
        $note['assets'] = array_values(array_unique($note['assets']));
        sort($note['assets']);
        saveNote($note);
        
        echo json_encode(['filename' => $filename, 'assets' => $note['assets']]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save file']);
    }
}

function handleAssetDelete($noteId, $assetName) {
    $note = getNote($noteId, true);
    if (!$note) {
        http_response_code(404);
        echo json_encode(['error' => 'Note not found']);
        return;
    }
    
    $assetPath = getAssetPath($noteId, $assetName);
    if (file_exists($assetPath)) {
        unlink($assetPath);
        if (isset($note['assets'])) {
            $note['assets'] = array_values(array_diff($note['assets'], [$assetName]));
            saveNote($note);
        }
        echo json_encode(['success' => true, 'assets' => $note['assets'] ?? []]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Asset not found']);
    }
}

function handleAssetRename($noteId, $assetName) {
    $input = json_decode(file_get_contents('php://input'), true);
    $newName = $input['name'] ?? '';
    
    if (empty($newName)) {
        http_response_code(400);
        echo json_encode(['error' => 'New name required']);
        return;
    }
    
    $note = getNote($noteId, true);
    if (!$note) {
        http_response_code(404);
        echo json_encode(['error' => 'Note not found']);
        return;
    }
    
    $oldPath = getAssetPath($noteId, $assetName);
    $newFilename = generateAssetFilename($noteId, $newName);
    $newPath = getAssetPath($noteId, $newFilename);
    
    if (file_exists($oldPath)) {
        rename($oldPath, $newPath);
        if (isset($note['assets'])) {
            $index = array_search($assetName, $note['assets']);
            if ($index !== false) {
                $note['assets'][$index] = $newFilename;
                sort($note['assets']);
                saveNote($note);
            }
        }
        echo json_encode(['success' => true, 'newName' => $newFilename, 'assets' => $note['assets']]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Asset not found']);
    }
}
?>