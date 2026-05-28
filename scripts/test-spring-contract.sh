#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SPRING_CONTRACT_PORT:-18080}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${ROOT_DIR}/backend/target/spring-contract.log"
MAVEN_JAVA_VERSION="${MAVEN_JAVA_VERSION:-21}"
SPRING_PID=""

cleanup() {
  if [[ -n "${SPRING_PID}" ]] && kill -0 "${SPRING_PID}" >/dev/null 2>&1; then
    kill "${SPRING_PID}" >/dev/null 2>&1 || true
    wait "${SPRING_PID}" >/dev/null 2>&1 || true
  fi
}

print_log() {
  if [[ -f "${LOG_FILE}" ]]; then
    tail -n 200 "${LOG_FILE}"
  fi
}

trap cleanup EXIT

mkdir -p "$(dirname "${LOG_FILE}")"
rm -f "${LOG_FILE}"

cd "${ROOT_DIR}"

mvn -f backend/pom.xml spring-boot:run \
  -Djava.version="${MAVEN_JAVA_VERSION}" \
  -Dspring-boot.run.useTestClasspath=true \
  -Dspring-boot.run.arguments="--server.port=${PORT} --spring.datasource.url=jdbc:h2:mem:mathlabcontract;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH --spring.datasource.driver-class-name=org.h2.Driver --spring.datasource.username=sa --spring.datasource.password= --spring.flyway.enabled=false --spring.jpa.hibernate.ddl-auto=create-drop --spring.jpa.open-in-view=false --spring.data.redis.repositories.enabled=false --management.health.redis.enabled=false --mathlab.jwt.secret=mathlab-pro-contract-test-secret-change-me-at-least-32-chars --logging.level.root=WARN --logging.level.com.mathlabpro=INFO --debug=false" \
  >"${LOG_FILE}" 2>&1 &

SPRING_PID="$!"

for _ in {1..90}; do
  if ! kill -0 "${SPRING_PID}" >/dev/null 2>&1; then
    echo "Spring backend exited before becoming healthy." >&2
    print_log
    exit 1
  fi

  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    MATHLAB_API_BASE_URL="${BASE_URL}" npm run test:contract
    exit 0
  fi

  sleep 1
done

echo "Spring backend did not become healthy at ${BASE_URL}." >&2
print_log
exit 1
