package com.securevault.api.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class VaultMatchingServiceTest {

    @Test
    void normalizeDomain_stripsProtocolAndWww() {
        assertEquals("github.com", VaultMatchingService.normalizeDomain("https://www.github.com"));
        assertEquals("github.com", VaultMatchingService.normalizeDomain("http://github.com"));
        assertEquals("github.com", VaultMatchingService.normalizeDomain("github.com"));
        assertEquals("github.com", VaultMatchingService.normalizeDomain("https://github.com/login"));
    }

    @Test
    void normalizeDomain_handlesPort() {
        assertEquals("localhost", VaultMatchingService.normalizeDomain("http://localhost:8080"));
    }

    @Test
    void normalizeDomain_handlesBlankInput() {
        assertEquals("", VaultMatchingService.normalizeDomain(""));
        assertEquals("", VaultMatchingService.normalizeDomain(null));
    }

    @Test
    void extractRootDomain_standardDomains() {
        assertEquals("google.com", VaultMatchingService.extractRootDomain("accounts.google.com"));
        assertEquals("facebook.com", VaultMatchingService.extractRootDomain("m.facebook.com"));
        assertEquals("github.com", VaultMatchingService.extractRootDomain("gist.github.com"));
        assertEquals("github.com", VaultMatchingService.extractRootDomain("github.com"));
    }

    @Test
    void extractRootDomain_multiPartTld() {
        assertEquals("bbc.co.uk", VaultMatchingService.extractRootDomain("bbc.co.uk"));
        assertEquals("bbc.co.uk", VaultMatchingService.extractRootDomain("www.bbc.co.uk"));
        assertEquals("example.com.au", VaultMatchingService.extractRootDomain("mail.example.com.au"));
    }

    @Test
    void extractRootDomain_shortDomain() {
        assertEquals("example.com", VaultMatchingService.extractRootDomain("example.com"));
    }

    @Test
    void extractRootDomain_blankInput() {
        assertEquals("", VaultMatchingService.extractRootDomain(""));
        assertEquals("", VaultMatchingService.extractRootDomain(null));
    }
}
