import assert from 'node:assert/strict';

// Read process environment only. Never load the workspace's production .env.
export function checkStagingEnv(env) {
  const failures = [];
  const require = (condition, message) => { if (!condition) failures.push(message); };
  require(env.FLATWAIVER_ENV === 'staging', 'FLATWAIVER_ENV must be staging.');
  const ref = env.STAGING_SUPABASE_PROJECT_REF;
  require(Boolean(ref && /^[a-z]{20}$/.test(ref) && ref !== 'uyzmhibyegdkacpouqvx'), 'Provide the isolated staging project reference, never the main FlatWaiver reference.');
  require(env.NEXT_PUBLIC_SUPABASE_URL === `https://${ref}.supabase.co`, 'Supabase URL must match the isolated staging reference.');
  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'CRON_SECRET']) require(Boolean(env[key]?.trim()), `${key} is required.`);
  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const value = env[key];
    if (value?.startsWith('eyJ')) {
      try { require(JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).ref === ref, `${key} JWT project must match staging.`); }
      catch { failures.push(`${key} is not a valid legacy JWT.`); }
    }
  }
  try {
    const url = new URL(env.NEXT_PUBLIC_APP_URL);
    require(url.protocol === 'https:' && !['flatwaiver.com','www.flatwaiver.com'].includes(url.hostname) && !url.username && !url.password, 'App origin must be a separate HTTPS staging origin.');
    require(url.pathname === '/' && !url.search && !url.hash, 'App origin cannot contain a path, query or fragment.');
  } catch { failures.push('NEXT_PUBLIC_APP_URL must be a valid staging origin.'); }
  require(env.CREEM_SERVER === 'test', 'CREEM_SERVER must be test.');
  require(!env.CREEM_API_KEY || env.CREEM_API_KEY.startsWith('creem_test_'), 'Creem key must be sandbox-only.');
  require(!env.STRIPE_SECRET_KEY, 'Leave dormant Stripe credentials unset.');
  for (const key of ['RESEND_API_KEY','ANTHROPIC_API_KEY','NEXT_PUBLIC_GA_MEASUREMENT_ID','NEXT_PUBLIC_GOOGLE_ADS_ID','NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL','NEXT_PUBLIC_CLARITY_PROJECT_ID','NEXT_PUBLIC_TAWK_SRC','GOOGLE_SITE_VERIFICATION']) require(!env[key]?.trim(), `${key} must be unset in the safe staging baseline.`);
  for (const key of ['ALLOW_DEV_SEED','OPENAI_ADS_PIXEL_ENABLED','TIKTOK_PIXEL_ENABLED']) require(env[key] !== 'true', `${key} must not be enabled.`);
  return failures;
}

if (process.argv.includes('--self-test')) {
  const ref='abcdefghijklmnopqrst';
  const good={FLATWAIVER_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:ref,NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_APP_URL:'https://staging.example.com',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-key',SUPABASE_SERVICE_ROLE_KEY:'test-key',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'test-key',TURNSTILE_SECRET_KEY:'test-key',CRON_SECRET:'test-key',CREEM_SERVER:'test'};
  assert.deepEqual(checkStagingEnv(good),[]);
  for(const bad of [{FLATWAIVER_ENV:'production'},{STAGING_SUPABASE_PROJECT_REF:'uyzmhibyegdkacpouqvx'},{NEXT_PUBLIC_APP_URL:'https://www.flatwaiver.com'},{CREEM_API_KEY:'creem_live_example'},{RESEND_API_KEY:'live'},{STRIPE_SECRET_KEY:'sk_live_example'},{ALLOW_DEV_SEED:'true'},{TIKTOK_PIXEL_ENABLED:'true'}])assert.ok(checkStagingEnv({...good,...bad}).length);
  console.log('PASS: staging preflight rejects production connections, live billing, mail and unsafe flags.');
} else {
  const failures=checkStagingEnv(process.env);
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Staging environment preflight passed (configuration only; remote resources not verified).');
}
