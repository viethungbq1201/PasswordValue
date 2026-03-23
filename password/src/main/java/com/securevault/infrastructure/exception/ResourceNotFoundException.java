package com.securevault.infrastructure.exception;

/**
 * Thrown when a requested resource is not found.
 * Results in HTTP 404 Not Found.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
