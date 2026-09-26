#!/usr/bin/env bash
# Deploys a commit of main to the CBA server (exams.cba.org.bo).
#
# Installed on the server as /usr/local/sbin/cba-deploy (a copy, so a deploy
# never rewrites the script it is running). GitHub Actions calls it over SSH
# with a key restricted to this command in authorized_keys, so its only input
# is the commit SHA, which arrives in $SSH_ORIGINAL_COMMAND. By hand:
#
#   cba-deploy <full-sha>                  # move forward to <sha>
#   ALLOW_OLDER=1 cba-deploy <full-sha>    # go back to an older commit
#
# It rebuilds only the services whose build inputs changed, one at a time
# (parallel builds have taken the whole stack down before), then waits for
# every service to be running and healthy. If they are not, it redeploys the
# previous commit.
set -euo pipefail
# Keep going if the SSH session drops in the middle of a build.
trap '' HUP

REPO=/opt/cba-exams
LOCK=/run/lock/cba-deploy.lock
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-300}
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

log() { printf '[%s] %s\n' "$(date +%T)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

target=${1:-${SSH_ORIGINAL_COMMAND:-}}
[[ $target =~ ^[0-9a-f]{40}$ ]] || die "expected a full commit SHA, got '${target}'"

exec 9>"$LOCK"
if ! flock -n 9; then
  log "another deploy is running; waiting for it"
  flock 9
fi

cd "$REPO"
git fetch -q origin main
git merge-base --is-ancestor "$target" origin/main || die "$target is not on origin/main"

previous=$(git rev-parse HEAD)
if [[ $previous == "$target" ]]; then
  log "already at $target"
  exit 0
fi
if [[ ${ALLOW_OLDER:-} != 1 ]] && ! git merge-base --is-ancestor "$previous" "$target"; then
  die "$target is older than the deployed $previous (set ALLOW_OLDER=1 to go back on purpose)"
fi

# Changed paths on stdin -> compose services whose image must be rebuilt.
services_for() {
  local path
  while IFS= read -r path; do
    case $path in
      frontend/*) echo frontend ;;
      nginx/*) echo api-gateway ;;
      identity-service/*) echo identity-service ;;
      notifications-service/*) echo notifications-service ;;
      exam-service/*) echo exam-service ;;
      session-manager-service/*) echo session-manager-service ;;
      mcp-grading-server/*) echo grading-service ;;
      # @cba/events is copied into these three images.
      shared/events/*) printf '%s\n' notifications-service exam-service grading-service ;;
    esac
  done | sort -u
}

# Checks out <sha>, rebuilds the given services one by one, then lets compose
# recreate whatever changed (new images or a changed compose file).
deploy_to() {
  local sha=$1 svc
  shift
  git reset -q --hard "$sha" || return 1
  for svc in "$@"; do
    log "building $svc"
    "${COMPOSE[@]}" build "$svc" || return 1
  done
  log "starting the stack"
  "${COMPOSE[@]}" up -d || return 1
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) expected present missing bad
  expected=$("${COMPOSE[@]}" config --services | sort)
  while :; do
    present=$("${COMPOSE[@]}" ps -a --format '{{.Service}}' | sort)
    missing=$(comm -23 <(echo "$expected") <(echo "$present"))
    # A service is fine when it is running and either has no healthcheck or
    # reports healthy.
    bad=$("${COMPOSE[@]}" ps -a --format '{{.Service}} {{.State}} {{.Health}}' \
      | awk '$2 != "running" || ($3 != "" && $3 != "healthy")')
    if [[ -z $missing && -z $bad ]] && curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8088/; then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      log "not healthy after ${HEALTH_TIMEOUT}s"
      [[ -n $missing ]] && log "missing: $(echo "$missing" | tr '\n' ' ')"
      [[ -n $bad ]] && printf '%s\n' "$bad"
      return 1
    fi
    sleep 5
  done
}

changed=$(git diff --name-only "$previous" "$target")
mapfile -t build < <(services_for <<<"$changed")
log "deploying ${previous:0:7} -> ${target:0:7}; rebuilding: ${build[*]:-nothing}"
if grep -q '^deploy/cba/' <<<"$changed"; then
  log "WARNING: deploy/cba/ changed. The host nginx site is shared and is NOT updated automatically; apply it by hand (docs/deploy-cba.md)."
fi
if grep -q '^scripts/deploy/' <<<"$changed"; then
  log "WARNING: scripts/deploy/ changed. Reinstall /usr/local/sbin/cba-deploy by hand (docs/deploy-cba.md)."
fi

if deploy_to "$target" "${build[@]}" && wait_healthy; then
  docker image prune -f >/dev/null
  log "deployed ${target:0:7}"
  exit 0
fi

log "deploy of ${target:0:7} failed; rolling back to ${previous:0:7}"
if deploy_to "$previous" "${build[@]}" && wait_healthy; then
  die "deploy of ${target:0:7} failed; the server is back on ${previous:0:7}"
fi
die "ROLLBACK FAILED: the stack needs attention (docker compose ps, docker compose logs)"
