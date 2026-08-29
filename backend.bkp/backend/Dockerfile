FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN adduser -S -u 10001 app
WORKDIR /app
COPY --from=build /build/target/aceleralock-backend-*.jar app.jar
USER app

EXPOSE 8080 8081

# start-period medido: pior de tres boots limpos foi 26,2s (JDK 21, Postgres 17).
# 60s e ~2,3x isso. Sonda que falha dentro da janela nao conta para retries e nao
# marca unhealthy, entao a folga nao atrasa deploy bom: so adia o veredito do ruim,
# e esse adiamento ja tem teto no deploy.sh. Remedir no host no primeiro deploy.
HEALTHCHECK --interval=5s --timeout=3s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8081/actuator/health/readiness | grep -q '"status":"UP"'

ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=70.0", \
    "-XX:+ExitOnOutOfMemoryError", \
    "-Duser.timezone=UTC", \
    "-jar", "/app/app.jar"]
