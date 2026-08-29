package com.aceleralock.unlock;

public enum UnlockRequestStatus {

    PENDING,
    GRANTED,
    CONSUMED,
    DENIED,
    CANCELLED;

    public boolean isTerminal() {
        return this == CONSUMED || this == DENIED || this == CANCELLED;
    }

    public boolean isOpen() {
        return this == PENDING || this == GRANTED;
    }
}
