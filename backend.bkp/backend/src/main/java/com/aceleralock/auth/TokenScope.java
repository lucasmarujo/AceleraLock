package com.aceleralock.auth;

public enum TokenScope {

    DEVICE_REGISTER("device:register"),
    API("api");

    private final String claim;

    TokenScope(String claim) {
        this.claim = claim;
    }

    public String claim() {
        return claim;
    }
}
