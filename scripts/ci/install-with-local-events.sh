#!/usr/bin/env bash
# Installs a service that depends on the local @cba/events tarball
# (file:../shared/events/cba-events.tgz).
#
# The tarball is rebuilt on every run and is not byte-reproducible across
# Node/npm versions, so the integrity hash recorded in the service's
# package-lock.json can legitimately differ, and npm fails with EINTEGRITY.
# Drop only that one entry's integrity; every other dependency is still
# checked against the lockfile.
set -euo pipefail

node -e '
const fs = require("fs");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const entry = lock.packages && lock.packages["node_modules/@cba/events"];
if (entry) delete entry.integrity;
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
'
npm install --no-audit --no-fund
