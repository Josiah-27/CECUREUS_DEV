# Maestro E2E flows — NOT YET EXECUTED

These flows target a preview/dev build (`appId: com.cecureus.app`) on an Android emulator or device.
They have **not been run**: the development machine used so far has no Android SDK/emulator.

Run (after installing Maestro and a preview APK on a device/emulator):

    maestro test .maestro/

Requirements: a staging backend with a test account whose OTP is known (e.g. a fixed test OTP on staging only),
passed via `-e TEST_EMAIL=... -e TEST_OTP=...`. Never use production accounts.
