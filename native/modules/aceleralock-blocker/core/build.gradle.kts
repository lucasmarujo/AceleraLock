// Sem `version` de proposito: este projeto e compilado em dois contextos. No
// build do app (incluido como ':aceleralock-blocker-core', ver
// native/plugins/withAceleralockBlocker.js) o plugin Kotlin ja vem no
// classpath do Expo/RN sem versao conhecida, e declarar uma aqui faz o Gradle
// recusar ("plugin is already on the classpath with an unknown version"). No
// build standalone quem fornece a versao e o `pluginManagement` do
// settings.gradle.kts ao lado.
plugins {
    kotlin("jvm")
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(17)
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}
