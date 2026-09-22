# @cba/events

Shared Kafka event envelope, schemas, and publish/consume helpers used by
`exam-service`, `mcp-grading-server`, and `notifications-service`.

It is not published to a registry — consumers install it as a local tarball
(`cba-events.tgz`), built from this package's `dist/` output.

## Local setup

`docker-compose up --build` builds and packs this package automatically as
part of each dependent service's image build, so no manual step is needed
for the normal Docker workflow.

On a fresh clone, if you run a dependent service outside Docker (e.g.
`npm install` directly inside `exam-service`, `mcp-grading-server`, or
`notifications-service`), build and pack this package first:

```bash
cd shared/events
npm install
npm run pack:local
```

Then `npm install` in the dependent service as usual — its `package.json`
points at `../shared/events/cba-events.tgz`.
