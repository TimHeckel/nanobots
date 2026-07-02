# Sprinto SOC 2 Shim

`nanobots` can act as an engineering-control shim for Sprinto by exporting recent scan activity into Sprinto Custom Integrations as structured `engineering_controls` entities.

The intended use is narrow:

- Keep Sprinto as the system of record for your SOC 2 program.
- Use `nanobots` to evaluate secure SDLC and code-change controls Sprinto only monitors lightly.
- Push the resulting evidence into Sprinto so custom controls and tests can track it continuously.

## What this fills

This shim is designed for control gaps that usually fall between GRC tooling and code reality:

- application security findings in the actual changed code
- GitHub Actions hardening and workflow hygiene
- evidence that a scan happened on a repository revision
- evidence that failed checks produced remediation artifacts

## What the exporter emits

For each recent `scanId`, the exporter builds four control entities:

- `NB-CC-001` Security scan executed on repository changes
- `NB-CC-002` No application security findings remain in the scanned revision
- `NB-CC-003` GitHub Actions workflows are hardened
- `NB-CC-004` Open scan findings have a remediation artifact

Each entity includes:

- `control_key`
- `control_name`
- `suggested_soc2_mapping`
- `status`
- `finding_count`
- `highest_severity`
- `repo`
- `scan_id`
- `remediation_urls_csv`
- `evidence_markdown`
- `sample_findings_json`

## Sprinto setup

1. Create a Sprinto Custom Integration and copy the Sprinto-issued integration identifier.
2. Create a schema or custom model that accepts `engineering_controls` records.
3. Create custom checks in Sprinto against fields like:
   - `status == "pass"`
   - `finding_count == 0`
   - `highest_severity not in ["critical", "high"]`
   - `remediation_count > 0` when `status == "in_progress"`
4. Map the entities to the controls you want as engineering evidence inside your SOC 2 program.

Sprinto docs that informed this shim:

- `Custom Integrations` describe the session model for the Entities Sync API.
- `Integration Monitoring` documents the external push API base URL and integration status endpoint.

## Nanobots setup

Generate or reuse a `nanobots` API key, then either set env vars or send Sprinto config in the request body:

```bash
export SPRINTO_API_KEY=...
export SPRINTO_INTEGRATION_ID=...
export SPRINTO_ENTITY_TYPE=engineering_controls
```

Preview the payload first:

```bash
curl -X POST http://localhost:6100/api/compliance/sprinto/export \
  -H "Authorization: Bearer nbk_your_nanobots_api_key" \
  -H "Content-Type: application/json" \
  -d '{"preview": true, "limit": 5}'
```

Push the latest scan evidence into Sprinto:

```bash
curl -X POST http://localhost:6100/api/compliance/sprinto/export \
  -H "Authorization: Bearer nbk_your_nanobots_api_key" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

Filter to one repository:

```bash
curl -X POST http://localhost:6100/api/compliance/sprinto/export \
  -H "Authorization: Bearer nbk_your_nanobots_api_key" \
  -H "Content-Type: application/json" \
  -d '{"preview": true, "repo": "acme/api"}'
```

## Operational notes

- The exporter reads recent activity and groups events by `scanId`.
- It works best for scans that emitted the normal `scan.started`, `bot.finding`, `pr.created`, and `scan.completed` events.
- The Sprinto API client uses the documented `api-key` header and the public external push base URL.
- The session and entity endpoints are implemented as a direct client for Sprinto Custom Integrations. Validate against a preview payload before first live sync.
