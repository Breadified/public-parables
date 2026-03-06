/**
 * Apple Client Secret Generator - Supabase Edge Function
 *
 * This function generates Apple Sign-In client secrets on-demand,
 * eliminating the need to manually rotate secrets every 180 days.
 *
 * Deploy: supabase functions deploy apple-client-secret
 *
 * Note: You'll need to store your Apple private key as a Supabase secret:
 *   supabase secrets set APPLE_PRIVATE_KEY="$(cat .keys/apple-signin/AuthKey_Z8HNXVK2RY.p8)"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const TEAM_ID = 'A9QXKW8LYQ'
const KEY_ID = 'Z8HNXVK2RY'
const CLIENT_ID = 'com.parables.app'

serve(async (req) => {
  try {
    // Get the private key from environment
    const privateKeyPEM = Deno.env.get('APPLE_PRIVATE_KEY')

    if (!privateKeyPEM) {
      throw new Error('APPLE_PRIVATE_KEY not configured')
    }

    // Import the private key
    const privateKey = await jose.importPKCS8(privateKeyPEM, 'ES256')

    // Generate JWT with 180 day expiry
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setIssuedAt()
      .setExpirationTime('180d')
      .setAudience('https://appleid.apple.com')
      .setIssuer(TEAM_ID)
      .setSubject(CLIENT_ID)
      .sign(privateKey)

    return new Response(
      JSON.stringify({ client_secret: jwt }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
