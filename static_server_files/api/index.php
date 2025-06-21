<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

define('CONFIG_PATH', '../config.json');
define('NOTES_DIR', '../../notes/');
define('DELETED_DIR', '../../notes/deleted/');
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50MB

require_once 'assets.php';
require_once 'folders.php';

if (!file_exists(NOTES_DIR)) {
    mkdir(NOTES_DIR, 0755, true);
}

if (!file_exists(DELETED_DIR)) {
    mkdir(DELETED_DIR, 0755, true);
}

$config = json_decode(file_get_contents(CONFIG_PATH), true);
$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

error_log("API Request - Method: $method, Route: $route");


function isAuthenticated() {
    return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
}

function isTestSession() {
    return isset($_SESSION['is_test']) && $_SESSION['is_test'] === true;
}

function generateId() {
    return uniqid('note_', true);
}

function getNotes($includePrivate = false) {
    $rootNotes = [];
    $folderNotes = [];
    $folders = $includePrivate ? getFolders() : [];
    $folderMap = [];
    
    // Initialize folder map (only if authenticated)
    if ($includePrivate) {
        foreach ($folders as $folder) {
            $folderMap[$folder['name']] = [
                'type' => 'folder',
                'name' => $folder['name'],
                'lastModified' => $folder['lastModified'],
                'notes' => []
            ];
        }
    }
    
    // Process all notes
    $files = glob(NOTES_DIR . '*.json');
    foreach ($files as $file) {
        if (basename($file) === 'folders.json') continue;
        
        $note = json_decode(file_get_contents($file), true);
        if ($note['visibility'] === 'public' || $includePrivate) {
            if (isset($note['folderName']) && $note['folderName'] !== null && isset($folderMap[$note['folderName']])) {
                $folderMap[$note['folderName']]['notes'][] = $note;
            } else {
                $rootNotes[] = $note;
            }
        }
    }
    
    // Sort notes within each folder
    foreach ($folderMap as &$folder) {
        usort($folder['notes'], function($a, $b) {
            return strtotime($b['modified']) - strtotime($a['modified']);
        });
    }
    
    // Sort root notes by modified date
    usort($rootNotes, function($a, $b) {
        return strtotime($b['modified']) - strtotime($a['modified']);
    });
    
    // Sort folders by lastModified (only if authenticated)
    $folderArray = [];
    if ($includePrivate) {
        $folderArray = array_values($folderMap);
        usort($folderArray, function($a, $b) {
            return strtotime($b['lastModified']) - strtotime($a['lastModified']);
        });
    }
    
    // Combine: root notes first, then folders (folders only if authenticated)
    return array_merge($rootNotes, $folderArray);
}

function getNote($id, $includePrivate = false) {
    $filepath = NOTES_DIR . $id . '.json';
    if (!file_exists($filepath)) {
        return null;
    }
    
    $note = json_decode(file_get_contents($filepath), true);
    if ($note['visibility'] === 'private' && !$includePrivate) {
        return null;
    }
    
    return $note;
}

function saveNote($note) {
    $filepath = NOTES_DIR . $note['id'] . '.json';
    $note['modified'] = date('c');
    
    // Mark test notes ONLY if created during a verified test session
    if (isTestSession() && $_SESSION['is_test'] === true && !isset($note['is_test'])) {
        $note['is_test'] = true;
    } elseif (!isTestSession()) {
        // Ensure production notes NEVER get test flag
        unset($note['is_test']);
    }
    
    // Update folder timestamp if note belongs to a folder
    if (isset($note['folderName']) && $note['folderName'] !== null) {
        updateFolderTimestamp($note['folderName']);
    }
    
    cleanupOldDeletedNotes();
    
    $lockfile = $filepath . '.lock';
    $fp = fopen($lockfile, 'w');
    
    if (flock($fp, LOCK_EX)) {
        file_put_contents($filepath, json_encode($note, JSON_PRETTY_PRINT));
        flock($fp, LOCK_UN);
    }
    
    fclose($fp);
    @unlink($lockfile);
    
    return $note;
}

function cleanupOldDeletedNotes() {
    $lastCleanup = $_SESSION['last_cleanup'] ?? 0;
    $today = date('Y-m-d');
    
    if (date('Y-m-d', $lastCleanup) === $today) {
        return;
    }
    
    $files = glob(DELETED_DIR . '*.json');
    $cutoffTime = time() - (30 * 24 * 60 * 60);
    
    foreach ($files as $file) {
        if (filemtime($file) < $cutoffTime) {
            $note = json_decode(file_get_contents($file), true);
            if ($note && isset($note['id'])) {
                $assetsDir = NOTES_DIR . $note['id'] . '/assets';
                if (is_dir($assetsDir)) {
                    deleteDirectory($assetsDir);
                    @rmdir(NOTES_DIR . $note['id']);
                }
            }
            @unlink($file);
        }
    }
    
    $_SESSION['last_cleanup'] = time();
}

function moveToDeleted($noteId) {
    $sourceFile = NOTES_DIR . $noteId . '.json';
    $deletedFile = DELETED_DIR . $noteId . '.json';
    
    if (file_exists($sourceFile)) {
        $note = json_decode(file_get_contents($sourceFile), true);
        $note['deleted_at'] = date('c');
        
        file_put_contents($deletedFile, json_encode($note, JSON_PRETTY_PRINT));
        unlink($sourceFile);
        
        // Move assets directory to deleted folder structure
        $sourceAssets = NOTES_DIR . $noteId . '/assets';
        $deletedAssets = DELETED_DIR . $noteId . '/assets';
        if (is_dir($sourceAssets)) {
            if (!file_exists(DELETED_DIR . $noteId)) {
                mkdir(DELETED_DIR . $noteId, 0755, true);
            }
            rename($sourceAssets, $deletedAssets);
            @rmdir(NOTES_DIR . $noteId);
        }
        
        return true;
    }
    
    return false;
}

function getDeletedNotes() {
    $deletedNotes = [];
    $files = glob(DELETED_DIR . '*.json');
    
    foreach ($files as $file) {
        $note = json_decode(file_get_contents($file), true);
        if ($note) {
            $deletedAt = new DateTime($note['deleted_at']);
            $now = new DateTime();
            $interval = $now->diff($deletedAt);
            $note['days_deleted'] = $interval->days;
            $deletedNotes[] = $note;
        }
    }
    
    usort($deletedNotes, function($a, $b) {
        return strtotime($b['deleted_at']) - strtotime($a['deleted_at']);
    });
    
    return $deletedNotes;
}

function restoreNote($noteId) {
    $deletedFile = DELETED_DIR . $noteId . '.json';
    $targetFile = NOTES_DIR . $noteId . '.json';
    
    if (file_exists($deletedFile)) {
        $note = json_decode(file_get_contents($deletedFile), true);
        unset($note['deleted_at']);
        $note['modified'] = date('c');
        
        file_put_contents($targetFile, json_encode($note, JSON_PRETTY_PRINT));
        unlink($deletedFile);
        
        // Restore assets directory
        $deletedAssets = DELETED_DIR . $noteId . '/assets';
        $targetAssets = NOTES_DIR . $noteId . '/assets';
        if (is_dir($deletedAssets)) {
            if (!file_exists(NOTES_DIR . $noteId)) {
                mkdir(NOTES_DIR . $noteId, 0755, true);
            }
            rename($deletedAssets, $targetAssets);
            @rmdir(DELETED_DIR . $noteId);
        }
        
        return $note;
    }
    
    return false;
}

switch ($route) {
    case 'public-notes':
        if ($method === 'GET') {
            $notes = getNotes(false);
            echo json_encode($notes);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
        }
        break;
        
    case 'auth':
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $password = $input['password'] ?? '';
            
            // Check for dual password system
            $isValidPassword = false;
            $isTestPassword = false;
            
            if (isset($config['auth'])) {
                // New dual password system
                if (password_verify($password, $config['auth']['user_password_hash'])) {
                    $isValidPassword = true;
                    $isTestPassword = false; // Explicitly set to false for user password
                } elseif (password_verify($password, $config['auth']['test_password_hash'])) {
                    $isValidPassword = true;
                    $isTestPassword = true;
                }
            } else {
                // Fallback to old single password system
                $isValidPassword = password_verify($password, $config['password_hash']);
                $isTestPassword = false; // Explicitly set to false for old system
            }
            
            if ($isValidPassword) {
                $_SESSION['authenticated'] = true;
                $_SESSION['is_test'] = $isTestPassword;
                setcookie('auth_session', session_id(), time() + (86400 * $config['session_lifetime_days']), '/');
                echo json_encode(['success' => true, 'is_test' => $isTestPassword]);
            } else {
                http_response_code(401);
                echo json_encode(['error' => 'Invalid password']);
            }
        }
        break;
        
    case 'logout':
        if ($method === 'POST') {
            session_destroy();
            setcookie('auth_session', '', time() - 3600, '/');
            echo json_encode(['success' => true]);
        }
        break;
        
    case 'notes':
        if ($method === 'GET' && isAuthenticated()) {
            $notes = getNotes(isAuthenticated());
            echo json_encode($notes);
        } elseif ($method === 'POST' && isAuthenticated()) {
            $input = json_decode(file_get_contents('php://input'), true);
            $note = [
                'id' => generateId(),
                'title' => $input['title'] ?? 'Untitled',
                'content' => $input['content'] ?? '',
                'created' => date('c'),
                'modified' => date('c'),
                'visibility' => $input['visibility'] ?? 'private',
                'public_editable' => $input['public_editable'] ?? false,
                'assets' => []
            ];
            $note = saveNote($note);
            echo json_encode($note);
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
        }
        break;
        
    case 'deleted-notes':
        if ($method === 'GET' && isAuthenticated()) {
            $deletedNotes = getDeletedNotes();
            echo json_encode($deletedNotes);
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
        }
        break;
        
    default:
        if (preg_match('/^notes\/([^\/]+)\/assets$/', $route, $matches)) {
            $noteId = $matches[1];
            
            if ($method === 'POST' && isAuthenticated()) {
                handleAssetUpload($noteId);
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif (preg_match('/^notes\/([^\/]+)\/assets\/(.+)$/', $route, $matches)) {
            $noteId = $matches[1];
            $assetName = urldecode($matches[2]);
            
            if ($method === 'DELETE' && isAuthenticated()) {
                handleAssetDelete($noteId, $assetName);
            } elseif ($method === 'PUT' && isAuthenticated()) {
                handleAssetRename($noteId, $assetName);
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif (preg_match('/^notes\/([^\/]+)\/move$/', $route, $matches) && isAuthenticated()) {
            if ($method === 'PUT') {
                $noteId = $matches[1];
                $input = json_decode(file_get_contents('php://input'), true);
                $folderName = $input['folderName'] ?? null;
                
                $result = moveNoteToFolder($noteId, $folderName);
                if (isset($result['error'])) {
                    http_response_code($result['code']);
                    echo json_encode($result);  // Return full result including debug info
                } else {
                    echo json_encode($result['note']);
                }
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
        } elseif (preg_match('/^notes\/(.+)$/', $route, $matches)) {
            $noteId = $matches[1];
            
            if ($method === 'GET') {
                $note = getNote($noteId, isAuthenticated());
                if ($note) {
                    echo json_encode($note);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Note not found']);
                }
            } elseif ($method === 'PUT') {
                $note = getNote($noteId, true);
                if (!$note) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Note not found']);
                    break;
                }
                
                $canEdit = isAuthenticated() || 
                          ($note['visibility'] === 'public' && $note['public_editable']);
                
                if ($canEdit) {
                    $input = json_decode(file_get_contents('php://input'), true);
                    
                    if (isAuthenticated()) {
                        $note['title'] = $input['title'] ?? $note['title'];
                        $note['visibility'] = $input['visibility'] ?? $note['visibility'];
                        $note['public_editable'] = $input['public_editable'] ?? $note['public_editable'];
                    }
                    
                    $note['content'] = $input['content'] ?? $note['content'];
                    $note = saveNote($note);
                    echo json_encode($note);
                } else {
                    http_response_code(403);
                    echo json_encode(['error' => 'Forbidden']);
                }
            } elseif ($method === 'DELETE' && isAuthenticated()) {
                if (moveToDeleted($noteId)) {
                    echo json_encode(['success' => true]);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Note not found']);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif (preg_match('/^deleted-notes\/(.+)\/restore$/', $route, $matches)) {
            $noteId = $matches[1];
            
            if ($method === 'POST' && isAuthenticated()) {
                $restoredNote = restoreNote($noteId);
                if ($restoredNote) {
                    echo json_encode($restoredNote);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Deleted note not found']);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif ($route === 'test-cleanup') {
            if ($method === 'POST' && isAuthenticated() && isTestSession()) {
                $deletedCount = 0;
                $files = glob(NOTES_DIR . '*.json');
                
                foreach ($files as $file) {
                    $note = json_decode(file_get_contents($file), true);
                    if (isset($note['is_test']) && $note['is_test'] === true) {
                        // Delete test note
                        moveToDeleted($note['id']);
                        $deletedCount++;
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'deleted_count' => $deletedCount,
                    'message' => "Cleaned up $deletedCount test notes"
                ]);
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden - test cleanup requires test session']);
            }
        } elseif ($route === 'folders' && isAuthenticated()) {
            if ($method === 'GET') {
                $folders = getFolders();
                echo json_encode(['folders' => $folders]);
            } elseif ($method === 'POST') {
                $input = json_decode(file_get_contents('php://input'), true);
                $folderName = trim($input['name'] ?? '');
                
                $result = createFolder($folderName);
                if (isset($result['error'])) {
                    http_response_code($result['code']);
                    echo json_encode(['error' => $result['error']]);
                } else {
                    echo json_encode($result);
                }
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
        } elseif (preg_match('/^folders\/(.+)$/', $route, $matches) && isAuthenticated()) {
            $folderName = urldecode($matches[1]);
            
            if ($method === 'PUT') {
                $input = json_decode(file_get_contents('php://input'), true);
                $newName = trim($input['name'] ?? '');
                
                $result = renameFolder($folderName, $newName);
                if (isset($result['error'])) {
                    http_response_code($result['code']);
                    echo json_encode(['error' => $result['error']]);
                } else {
                    echo json_encode($result);
                }
            } elseif ($method === 'DELETE') {
                $result = deleteFolder($folderName);
                if (isset($result['error'])) {
                    http_response_code($result['code']);
                    echo json_encode(['error' => $result['error']]);
                } else {
                    echo json_encode($result);
                }
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Route not found']);
        }
        break;
}
?>