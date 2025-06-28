<?php

namespace Tests\Backend\Utilities;

class TestHelper
{
    public static function createSampleNoteData(string $title = 'Test Note', string $content = 'Test content'): array
    {
        return [
            'title' => $title,
            'content' => $content,
            'created' => date('Y-m-d H:i:s'),
            'modified' => date('Y-m-d H:i:s'),
            'folder' => '',
            'public' => false
        ];
    }

    public static function createVersionTimestamp(int $hoursAgo = 0): string
    {
        $timestamp = time() - ($hoursAgo * 3600);
        return date('Y-m-d-H', $timestamp);
    }

    public static function generateNoteId(): string
    {
        return 'note_' . uniqid() . '_' . rand(10000, 99999);
    }

    public static function assertJsonStructure(array $expected, array $actual, string $path = ''): void
    {
        foreach ($expected as $key) {
            $currentPath = $path ? "{$path}.{$key}" : $key;
            if (!array_key_exists($key, $actual)) {
                throw new \Exception("Missing key '{$key}' at path '{$currentPath}'");
            }
        }
    }

    public static function mockApiResponse(int $statusCode, array $data = [], string $message = ''): array
    {
        return [
            'status' => $statusCode,
            'data' => $data,
            'message' => $message,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    public static function simulateFileHash(array $noteData): string
    {
        return md5(json_encode($noteData));
    }

    public static function createVersionFilename(string $timestamp): string
    {
        return "{$timestamp}.json";
    }

    public static function getVersionPath(string $noteId, string $timestamp): string
    {
        return "/notes/versions/{$noteId}/" . self::createVersionFilename($timestamp);
    }

    public static function cleanTestDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $files = array_diff(scandir($path), ['.', '..']);
        foreach ($files as $file) {
            $filePath = $path . '/' . $file;
            if (is_dir($filePath)) {
                self::cleanTestDirectory($filePath);
                rmdir($filePath);
            } else {
                unlink($filePath);
            }
        }
    }
}