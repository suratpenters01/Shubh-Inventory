import crypto from 'crypto';

/**
 * Returns true if running in production mode:
 * Either NODE_ENV === 'production' OR running on Render (RENDER === 'true').
 */
export function isProdEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}

let devRandomJwtSecret: string | null = null;

/**
 * Retrieves the JWT Secret for token signing and verification.
 * In production: strictly enforces that JWT_SECRET is present. Refuses to start if missing.
 * In development: generates a loud warning and ephemeral random secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) {
    return secret.trim();
  }

  if (isProdEnvironment()) {
    console.error('\n========================================================================');
    console.error('❌ [FATAL CONFIG ERROR] JWT_SECRET environment variable is missing in production!');
    console.error('Render/Production requires a strong, non-empty JWT_SECRET to protect authentication tokens.');
    console.error('Please configure JWT_SECRET in your Render Environment Variables.');
    console.error('========================================================================\n');
    process.exit(1);
  }

  if (!devRandomJwtSecret) {
    devRandomJwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('\n************************************************************************');
    console.warn('⚠️  [SECURITY WARNING] JWT_SECRET not configured in development!');
    console.warn('⚠️  Generated an ephemeral random secret for this session.');
    console.warn('⚠️  Set JWT_SECRET in your .env file to maintain login across restarts.');
    console.warn('************************************************************************\n');
  }

  return devRandomJwtSecret;
}
