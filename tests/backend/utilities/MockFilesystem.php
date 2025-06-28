<?php

namespace Tests\Backend\Utilities;

class MockFilesystem
{
    private array $files = [];
    private array $directories = [];
    private bool $simulateFailures = false;
    private array $failurePatterns = [];

    public function __construct()
    {
        $this->reset();
    }

    public function reset(): void
    {
        $this->files = [];
        $this->directories = ['/'];
        $this->simulateFailures = false;
        $this->failurePatterns = [];
    }

    public function enableFailureSimulation(array $patterns = []): void
    {
        $this->simulateFailures = true;
        $this->failurePatterns = $patterns;
    }

    public function disableFailureSimulation(): void
    {
        $this->simulateFailures = false;
        $this->failurePatterns = [];
    }

    public function fileExists(string $path): bool
    {
        if ($this->shouldSimulateFailure($path, 'exists')) {
            return false;
        }
        return isset($this->files[$path]);
    }

    public function isDir(string $path): bool
    {
        return in_array($path, $this->directories);
    }

    public function fileGetContents(string $path): string|false
    {
        if ($this->shouldSimulateFailure($path, 'read')) {
            return false;
        }
        return $this->files[$path] ?? false;
    }

    public function filePutContents(string $path, string $content): int|false
    {
        if ($this->shouldSimulateFailure($path, 'write')) {
            return false;
        }
        
        $this->ensureDirectoryExists(dirname($path));
        $this->files[$path] = $content;
        return strlen($content);
    }

    public function mkdir(string $path, int $mode = 0755, bool $recursive = false): bool
    {
        if ($this->shouldSimulateFailure($path, 'mkdir')) {
            return false;
        }

        if ($recursive) {
            $parts = explode('/', trim($path, '/'));
            $currentPath = '';
            foreach ($parts as $part) {
                $currentPath .= '/' . $part;
                if (!in_array($currentPath, $this->directories)) {
                    $this->directories[] = $currentPath;
                }
            }
        } else {
            if (!in_array($path, $this->directories)) {
                $this->directories[] = $path;
            }
        }
        
        return true;
    }

    public function unlink(string $path): bool
    {
        if ($this->shouldSimulateFailure($path, 'delete')) {
            return false;
        }
        
        if (isset($this->files[$path])) {
            unset($this->files[$path]);
            return true;
        }
        return false;
    }

    public function scandir(string $path): array|false
    {
        if ($this->shouldSimulateFailure($path, 'scandir')) {
            return false;
        }

        if (!in_array($path, $this->directories)) {
            return false;
        }

        $results = ['.', '..'];
        
        foreach ($this->files as $filePath => $content) {
            if (dirname($filePath) === rtrim($path, '/')) {
                $results[] = basename($filePath);
            }
        }
        
        foreach ($this->directories as $dirPath) {
            if (dirname($dirPath) === rtrim($path, '/') && $dirPath !== $path) {
                $results[] = basename($dirPath);
            }
        }
        
        return array_unique($results);
    }

    public function filemtime(string $path): int|false
    {
        if ($this->shouldSimulateFailure($path, 'mtime')) {
            return false;
        }
        
        if (!isset($this->files[$path])) {
            return false;
        }
        
        return time() - 3600;
    }

    public function md5File(string $path): string|false
    {
        if ($this->shouldSimulateFailure($path, 'hash')) {
            return false;
        }
        
        $content = $this->fileGetContents($path);
        if ($content === false) {
            return false;
        }
        
        return md5($content);
    }

    public function createTestNoteStructure(): void
    {
        $this->mkdir('/notes', 0755, true);
        $this->mkdir('/notes/versions', 0755, true);
        
        $sampleNote = [
            'title' => 'Sample Note',
            'content' => 'This is a sample note for testing',
            'created' => '2023-10-27 10:00:00',
            'modified' => '2023-10-27 10:00:00'
        ];
        
        $this->filePutContents('/notes/note_123.json', json_encode($sampleNote));
        $this->filePutContents('/notes/versions/snapshot_state.json', json_encode(['note_123' => md5(json_encode($sampleNote))]));
    }

    public function getFiles(): array
    {
        return $this->files;
    }

    public function getDirectories(): array
    {
        return $this->directories;
    }

    private function ensureDirectoryExists(string $path): void
    {
        if (!in_array($path, $this->directories)) {
            $this->mkdir($path, 0755, true);
        }
    }

    private function shouldSimulateFailure(string $path, string $operation): bool
    {
        if (!$this->simulateFailures) {
            return false;
        }
        
        foreach ($this->failurePatterns as $pattern) {
            if (isset($pattern['path']) && fnmatch($pattern['path'], $path)) {
                return in_array($operation, $pattern['operations'] ?? []);
            }
        }
        
        return false;
    }
}