const test = require('node:test');
const assert = require('node:assert/strict');

test('production migration preserves the supplied database and uses Neon direct connectivity', async () => {
  const {productionDatabaseUrl} = await import('../../scripts/vercel-build.mjs');
  const env = {VERCEL:'1',VERCEL_ENV:'production',VERCEL_GIT_REPO_SLUG:'univesp-study-landing-page',APP_URL:'https://univesp-study-landing-page.vercel.app/',RESEND_API_KEY:'test-fake',RESEND_FROM_EMAIL:'test@example.invalid',DATABASE_URL:'postgresql://test:test@ep-example-pooler.us-east-1.aws.neon.tech/app?sslmode=require'};
  const direct = new URL(productionDatabaseUrl(env));
  assert.equal(direct.hostname,'ep-example.us-east-1.aws.neon.tech');
  assert.equal(direct.pathname,'/app'); assert.equal(direct.search,'?sslmode=require');
  assert.equal(productionDatabaseUrl({...env,DATABASE_URL_UNPOOLED:'postgresql://test:test@ep-other.us-east-1.aws.neon.tech/direct'}),'postgresql://test:test@ep-other.us-east-1.aws.neon.tech/direct');
  for(const changes of [{VERCEL_ENV:'preview'},{VERCEL:'0'},{RESEND_API_KEY:''},{RESEND_FROM_EMAIL:''},{APP_URL:'https://other.example'},{VERCEL_GIT_REPO_SLUG:'other'},{DATABASE_URL:'postgresql://test:test@localhost/app'},{DATABASE_URL:''}]) assert.throws(()=>productionDatabaseUrl({...env,...changes}));
});
