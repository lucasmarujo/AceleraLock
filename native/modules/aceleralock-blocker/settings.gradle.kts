// Versao do Kotlin do build standalone (testes JVM do core). No build do app
// este settings nao e lido — o core entra como subprojeto do settings gerado
// pelo Expo e herda o Kotlin do classpath dele. Ver core/build.gradle.kts.
pluginManagement {
    plugins {
        id("org.jetbrains.kotlin.jvm") version "2.2.20"
    }
}

rootProject.name = "aceleralock-blocker"
include("core")
