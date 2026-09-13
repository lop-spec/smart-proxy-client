# Changelog

## 1.2.0 - 2026-09-13

- Add opt-in configurable website failure detection using correlated sing-box connection IDs, unique-error thresholds, a cooldown, and bounded state.
- Hot-switch directly to another subscription's historical best; without valid history, randomly choose another subscription/node. No connectivity or model probes are issued by failover.
- Exclude current/shared subscriptions, absent runtime nodes and cooling failures. Preserve unrelated live connections and cancel pending failover on manual selection or settings changes.
- Reconnect the core log stream without restarting the proxy; log disabled/unarmed, random-fallback and no-candidate reasons. Add deterministic regression coverage.

## 1.1.0 - 2026-09-09

- Cap the whole benchmark at four requests, with independent 30-second request timeouts and cooperative child-process cancellation.
- Keep one fixed account/model per round, require complete SSE and actual API usage, measure first text token, and recheck the top three candidates to three samples. Never switch nodes or close connections after measuring.
- Preserve last successful measurements separately from the latest attempt; treat bulk failures and system DNS diagnostics as inconclusive rather than marking all nodes dead.
- Add offline YAML source removal without deleting the file or restarting the core.
- Batch and bound logs, rotate new logs at 8 MiB with two retained rotations, and archive an existing oversized legacy log without deleting it.
- Coalesce and time-limit control-plane polling, reduce background polling, avoid hidden/unchanged connection DOM work, and query only the selected group.
- Exclude all personal configurations from future artifacts; upgrades continue using existing local files. Prior repository history/releases may still contain credentials and require separate rotation.
- Support hidden UI-only handoff onto the existing core; embedded builds always use their matching probe helper instead of stale external scripts.

## 1.0.1 - 2026-08-26

- Calibrate cross-model benchmark ranking against each model's current-round median.
- Keep displayed and persisted tok/s as the measured end-to-end value.
- Fall back to raw tok/s ranking when cross-model calibration lacks enough samples.

## 1.0.0 - 2026-08-25

- Add private GitHub CI/CD and tagged Release publishing.
- Add a verified single-file Windows portable build.
- Embed and first-run restore the owner's personal configuration snapshot.
- Pin and checksum Neutralinojs and sing-box build inputs.
