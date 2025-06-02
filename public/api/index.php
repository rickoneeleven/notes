<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

define('CONFIG_PATH', '../../config.json');
define('NOTES_DIR', '../../notes/');

if (!file_exists(NOTES_DIR)) {
    mkdir(NOTES_DIR, 0755, true);
}

$config = json_decode(file_get_contents(CONFIG_PATH), true);
$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function isAuthenticated() {
    return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
}

function generateId() {
    return uniqid('note_', true);
}

function getNotes($includePrivate = false) {
    $notes = [];
    $files = glob(NOTES_DIR . '*.json');
    
    foreach ($files as $file) {
        $note = json_decode(file_get_contents($file), true);
        if ($note['visibility'] === 'public' || $includePrivate) {
            $notes[] = $note;
        }
    }
    
    usort($notes, function($a, $b) {
        return strtotime($b['modified']) - strtotime($a['modified']);
    });
    
    return $notes;
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

switch ($route) {
    case 'auth':
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $password = $input['password'] ?? '';
            
            if (password_verify($password, $config['password_hash'])) {
                $_SESSION['authenticated'] = true;
                setcookie('auth_session', session_id(), time() + (86400 * $config['session_lifetime_days']), '/');
                echo json_encode(['success' => true]);
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
        if ($method === 'GET') {
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
                'public_editable' => $input['public_editable'] ?? false
            ];
            $note = saveNote($note);
            echo json_encode($note);
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
        }
        break;
        
    default:
        if (preg_match('/^notes\/(.+)$/', $route, $matches)) {
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
                $filepath = NOTES_DIR . $noteId . '.json';
                if (file_exists($filepath)) {
                    unlink($filepath);
                    echo json_encode(['success' => true]);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Note not found']);
                }
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden']);
            }
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Route not found']);
        }
        break;
}
?>