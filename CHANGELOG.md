# Changelog

## 1.0.1 - 2026-08-26

- Calibrate cross-model benchmark ranking against each model's current-round median.
- Keep displayed and persisted tok/s as the measured end-to-end value.
- Fall back to raw tok/s ranking when cross-model calibration lacks enough samples.

## 1.0.0 - 2026-08-25

- Add private GitHub CI/CD and tagged Release publishing.
- Add a verified single-file Windows portable build.
- Embed and first-run restore the owner's personal configuration snapshot.
- Pin and checksum Neutralinojs and sing-box build inputs.
