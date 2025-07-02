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
define('DELETED_NOTES_DIR', DELETED_DIR . 'notes/');
define('DELETED_ASSETS_DIR', DELETED_DIR . 'assets/');
define('DELETED_FOLDERS_FILE', NOTES_DIR . 'deleted_folders.json');
define('FOLDERS_FILE', NOTES_DIR . 'folders.json');
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50MB

require_once 'assets.php';
require_once 'folders.php';
require_once 'CoreVersioningLogic.php';

if (!file_exists(NOTES_DIR)) {
    mkdir(NOTES_DIR, 0755, true);
}

if (!file_exists(DELETED_DIR)) {
    mkdir(DELETED_DIR, 0755, true);
}

if (!file_exists(DELETED_NOTES_DIR)) {
    mkdir(DELETED_NOTES_DIR, 0755, true);
}

if (!file_exists(DELETED_ASSETS_DIR)) {
    mkdir(DELETED_ASSETS_DIR, 0755, true);
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
        if (basename($file) === 'folders.json' || basename($file) === 'deleted_folders.json') continue;
        
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
    // This session check prevents the function from running on every single save.
    // It's a simple throttle to run it once per day per user session.
    $lastCleanup = $_SESSION['last_cleanup'] ?? 0;
    $today = date('Y-m-d');
    if (date('Y-m-d', $lastCleanup) === $today) {
        return;
    }

    $cutoffTime = time() - (30 * 24 * 60 * 60);

    // 1. Purge old deleted notes and their assets (existing logic)
    $files = glob(DELETED_NOTES_DIR . '*.json');
    foreach ($files as $file) {
        if (filemtime($file) < $cutoffTime) {
            $note = json_decode(file_get_contents($file), true);
            if ($note && isset($note['id'])) {
                $assetsDir = DELETED_ASSETS_DIR . $note['id'];
                if (is_dir($assetsDir)) {
                    // This `deleteDirectory` helper must be included or defined.
                    // Assuming it exists in assets.php which is required in index.php
                    deleteDirectory($assetsDir);
                }
            }
            @unlink($file);
        }
    }
    
    // 2. NEW LOGIC: Purge old deleted folder definitions
    if (file_exists(DELETED_FOLDERS_FILE)) {
        $deletedFolders = json_decode(file_get_contents(DELETED_FOLDERS_FILE), true);
        $remainingFolders = [];
        foreach ($deletedFolders as $folder) {
            $deletedTimestamp = strtotime($folder['deleted_at']);
            if ($deletedTimestamp >= $cutoffTime) {
                $remainingFolders[] = $folder;
            }
        }
        // Save the file back with only the non-expired folders
        file_put_contents(DELETED_FOLDERS_FILE, json_encode($remainingFolders, JSON_PRETTY_PRINT));
    }

    $_SESSION['last_cleanup'] = time();
}

function moveToDeleted($noteId) {
    // Delegate to the new centralized trashNote function
    return trashNote($noteId);
}

function trashNote($noteId) {
    $sourceFile = NOTES_DIR . $noteId . '.json';
    if (!file_exists($sourceFile)) {
        return false;
    }

    // 1. Add deleted_at timestamp to note data
    $note = json_decode(file_get_contents($sourceFile), true);
    $note['deleted_at'] = date('c');

    // 2. Move the note file to the new trash location
    $targetFile = DELETED_NOTES_DIR . $noteId . '.json';
    file_put_contents($targetFile, json_encode($note, JSON_PRETTY_PRINT));
    unlink($sourceFile);

    // 3. Move the assets directory
    $sourceAssets = NOTES_DIR . $noteId . '/assets';
    if (is_dir($sourceAssets)) {
        $targetAssets = DELETED_ASSETS_DIR . $noteId;
        // The assets are moved into a directory named after the noteId
        rename($sourceAssets, $targetAssets);
        // Clean up the empty parent note directory
        @rmdir(NOTES_DIR . $noteId);
    }

    return true;
}

function getDeletedNotes() {
    $deletedFoldersMap = [];
    $standaloneNotes = [];
    $now = new DateTime();

    // 1. Process deleted folders first
    if (file_exists(DELETED_FOLDERS_FILE)) {
        $folders = json_decode(file_get_contents(DELETED_FOLDERS_FILE), true);
        foreach ($folders as $folder) {
            $deletedAt = new DateTime($folder['deleted_at']);
            $interval = $now->diff($deletedAt);
            $folder['days_deleted'] = $interval->days;
            $folder['notes'] = []; // Prepare to hold child notes
            $deletedFoldersMap[$folder['name']] = $folder;
        }
    }

    // 2. Process all deleted notes and group them
    $files = glob(DELETED_NOTES_DIR . '*.json');
    foreach ($files as $file) {
        $note = json_decode(file_get_contents($file), true);
        if ($note) {
            $deletedAt = new DateTime($note['deleted_at']);
            $interval = $now->diff($deletedAt);
            $note['days_deleted'] = $interval->days;

            // If note belongs to a trashed folder, add it to the map
            if (isset($note['folderName']) && isset($deletedFoldersMap[$note['folderName']])) {
                $deletedFoldersMap[$note['folderName']]['notes'][] = $note;
            } else {
                // Otherwise, it's a standalone deleted note
                $standaloneNotes[] = $note;
            }
        }
    }

    // 3. Sort everything for consistent ordering
    // Sort notes within each folder by deletion date (most recent first)
    foreach ($deletedFoldersMap as &$folder) {
        usort($folder['notes'], function($a, $b) {
            return strtotime($b['deleted_at']) - strtotime($a['deleted_at']);
        });
    }
    
    // Convert map to a simple array and sort folders by deletion date
    $deletedFoldersList = array_values($deletedFoldersMap);
    usort($deletedFoldersList, function($a, $b) {
        return strtotime($b['deleted_at']) - strtotime($a['deleted_at']);
    });

    // Sort standalone notes by deletion date
    usort($standaloneNotes, function($a, $b) {
        return strtotime($b['deleted_at']) - strtotime($a['deleted_at']);
    });

    // 4. Return the final structured object
    return [
        'deletedFolders' => $deletedFoldersList,
        'standaloneDeletedNotes' => $standaloneNotes
    ];
}

function restoreNote($noteId) {
    $deletedFile = DELETED_NOTES_DIR . $noteId . '.json';
    if (!file_exists($deletedFile)) {
        return false;
    }

    $note = json_decode(file_get_contents($deletedFile), true);

    // 1. Remove deletion-related metadata
    unset($note['deleted_at']);
    $note['modified'] = date('c');

    // 2. Check if the note's folder is still in the trash.
    // If so, unset the folderName to restore the note to root.
    if (isset($note['folderName'])) {
        $deletedFoldersFile = NOTES_DIR . 'deleted_folders.json';
        $isFolderStillDeleted = false;
        if (file_exists($deletedFoldersFile)) {
            $deletedFolders = json_decode(file_get_contents($deletedFoldersFile), true);
            if (in_array($note['folderName'], array_column($deletedFolders, 'name'))) {
                $isFolderStillDeleted = true;
            }
        }
        // Also check if the folder is not in the live folders list
        $liveFolders = getFolders(); // getFolders() is in folders.php
        $isFolderLive = in_array($note['folderName'], array_column($liveFolders, 'name'));

        // If the folder is deleted OR doesn't exist live, restore to root
        if ($isFolderStillDeleted || !$isFolderLive) {
            unset($note['folderName']);
        }
    }
    
    // 3. Save the updated note to the live directory
    $targetFile = NOTES_DIR . $noteId . '.json';
    file_put_contents($targetFile, json_encode($note, JSON_PRETTY_PRINT));
    unlink($deletedFile); // Remove from trash

    // 4. Restore assets directory
    $deletedAssets = DELETED_ASSETS_DIR . $noteId;
    if (is_dir($deletedAssets)) {
        $targetNoteDir = NOTES_DIR . $noteId;
        if (!is_dir($targetNoteDir)) {
            mkdir($targetNoteDir, 0755, true);
        }
        $targetAssets = $targetNoteDir . '/assets';
        rename($deletedAssets, $targetAssets);
    }
    
    return $note;
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
        } elseif (preg_match('/^notes\/([^\/]+)\/versions\/([^\/]+)$/', $route, $matches)) {
            // GET /api/notes/{note_id}/versions/{timestamp}
            $noteId = $matches[1];
            $timestamp = $matches[2];
            
            if ($method === 'GET' && isAuthenticated()) {
                try {
                    $versioningLogic = new CoreVersioningLogic(NOTES_DIR);
                    
                    // Validate note exists and user has access
                    $note = getNote($noteId, true);
                    if (!$note) {
                        http_response_code(404);
                        echo json_encode(['error' => 'Note not found']);
                        break;
                    }
                    
                    // Validate and parse timestamp
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/', $timestamp)) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid timestamp format. Expected: YYYY-MM-DD-HH-MM-SS']);
                        break;
                    }
                    
                    // Convert timestamp to Unix timestamp for CoreVersioningLogic
                    $dateTime = DateTime::createFromFormat('Y-m-d-H-i-s', $timestamp);
                    if (!$dateTime) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid timestamp format']);
                        break;
                    }
                    $unixTimestamp = $dateTime->getTimestamp();
                    
                    // Get version content
                    $versionContent = $versioningLogic->getVersionByTimestamp($noteId, $unixTimestamp);
                    
                    if ($versionContent === false) {
                        http_response_code(404);
                        echo json_encode(['error' => 'Version not found']);
                    } else {
                        echo json_encode($versionContent);
                    }
                    
                } catch (Exception $e) {
                    error_log("Error fetching version: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(['error' => 'Internal server error']);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif (preg_match('/^notes\/([^\/]+)\/versions$/', $route, $matches)) {
            // GET /api/notes/{note_id}/versions
            $noteId = $matches[1];
            
            if ($method === 'GET' && isAuthenticated()) {
                try {
                    $versioningLogic = new CoreVersioningLogic(NOTES_DIR);
                    
                    // Validate note exists and user has access
                    $note = getNote($noteId, true);
                    if (!$note) {
                        http_response_code(404);
                        echo json_encode(['error' => 'Note not found']);
                        break;
                    }
                    
                    // Get version history
                    $versions = $versioningLogic->getVersionHistory($noteId);
                    
                    // Format response with metadata
                    $response = [
                        'noteId' => $noteId,
                        'noteTitle' => $note['title'],
                        'totalVersions' => count($versions),
                        'versions' => array_map(function($versionFilename) {
                            // Parse timestamp from filename
                            if (preg_match('/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.json$/', $versionFilename, $matches)) {
                                $timestampString = $matches[1];
                                $dateTime = DateTime::createFromFormat('Y-m-d-H-i-s', $timestampString);
                                
                                return [
                                    'timestamp' => $timestampString,
                                    'created' => $dateTime ? $dateTime->format('c') : null,
                                    'filename' => $versionFilename,
                                    'size' => null
                                ];
                            }
                            return null;
                        }, $versions)
                    ];
                    
                    // Remove any null entries from failed parsing
                    $response['versions'] = array_filter($response['versions']);
                    
                    // Sort by timestamp (newest first)
                    usort($response['versions'], function($a, $b) {
                        return strcmp($b['timestamp'], $a['timestamp']);
                    });
                    
                    echo json_encode($response);
                    
                } catch (Exception $e) {
                    error_log("Error fetching versions: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(['error' => 'Internal server error']);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
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
        } elseif (preg_match('/^deleted-folders\/(.+)\/restore$/', $route, $matches)) {
            $folderName = urldecode($matches[1]);
            
            if ($method === 'POST' && isAuthenticated()) {
                $result = restoreFolder($folderName);
                if (isset($result['error'])) {
                    http_response_code($result['code']);
                    echo json_encode(['error' => $result['error']]);
                } else {
                    echo json_encode($result);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } elseif ($route === 'test-cleanup') {
            if ($method === 'POST' && isAuthenticated() && isTestSession()) {
                $deletedCount = 0;
                $versionDirsCleanedCount = 0;
                $files = glob(NOTES_DIR . '*.json');
                
                foreach ($files as $file) {
                    $note = json_decode(file_get_contents($file), true);
                    if (isset($note['is_test']) && $note['is_test'] === true) {
                        $noteId = $note['id'];
                        
                        // Clean up version directory if it exists
                        $versionDir = NOTES_DIR . 'versions/' . str_replace('.', '_', $noteId);
                        if (is_dir($versionDir)) {
                            // Remove all files in version directory
                            $versionFiles = glob($versionDir . '/*');
                            foreach ($versionFiles as $versionFile) {
                                unlink($versionFile);
                            }
                            rmdir($versionDir);
                            $versionDirsCleanedCount++;
                        }
                        
                        // Delete test note
                        moveToDeleted($noteId);
                        $deletedCount++;
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'deleted_count' => $deletedCount,
                    'version_dirs_cleaned' => $versionDirsCleanedCount,
                    'message' => "Cleaned up $deletedCount test notes and $versionDirsCleanedCount version directories"
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