import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface VerifiedUser {
  uid: string;
  name: string | null;
  picture: string | null;
}

export type TokenVerifier = (token: string) => Promise<VerifiedUser>;

const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

/** Verifies Firebase Auth ID tokens against Google's published signing keys; no service account needed. */
export function firebaseVerifier(projectId: string): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token has no subject');
    return {
      uid: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  };
}
