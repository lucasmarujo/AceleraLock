package com.aceleralock.time;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ServerTimeFilter extends OncePerRequestFilter {

    private final TimeAuthority timeAuthority;

    public ServerTimeFilter(TimeAuthority timeAuthority) {
        this.timeAuthority = timeAuthority;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader(TimeAuthority.SERVER_TIME_HEADER, timeAuthority.now().toString());
        long skew = timeAuthority.skewSeconds(request.getHeader(TimeAuthority.DEVICE_TIME_HEADER));
        response.setHeader(TimeAuthority.CLOCK_SKEW_HEADER, Long.toString(skew));
        chain.doFilter(request, response);
    }
}
