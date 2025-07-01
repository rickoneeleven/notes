#!/bin/bash
# Backend test runner with proper PHP version and Xdebug coverage
# Usage: ./run-backend-tests.sh [phpunit options]

XDEBUG_MODE=coverage php8.3 ../vendor/bin/phpunit -c ../phpunit.xml "$@"