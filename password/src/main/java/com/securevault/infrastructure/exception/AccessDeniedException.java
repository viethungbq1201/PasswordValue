package com.securevault.infrastructure.exception;

/**
 * Thrown when a user attempts to access a resource they do not own.
 * Results in HTTP 403 Forbidden.
 */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
