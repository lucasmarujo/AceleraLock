package com.aceleralock.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "block_window")
public class BlockWindow {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false)
    private BlockProfile profile;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 16)
    private DayOfWeek dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    protected BlockWindow() {
    }

    public BlockWindow(BlockProfile profile, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.profile = profile;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public boolean wrapsMidnight() {
        return endTime.isBefore(startTime);
    }

    public boolean covers(LocalTime localTime) {
        if (startTime.equals(endTime)) {
            return true;
        }
        if (wrapsMidnight()) {
            return !localTime.isBefore(startTime) || localTime.isBefore(endTime);
        }
        return !localTime.isBefore(startTime) && localTime.isBefore(endTime);
    }

    public UUID getId() {
        return id;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }
}
