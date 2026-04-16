/**
 * useWebAuthn — helpers client-side para WebAuthn no portal do responsável.
 *
 * isSupported()              → boolean (sincrono)
 * isPlatformAvailable()      → Promise<boolean> — TouchID/FaceID/Windows Hello
 * registerCredential(...)    → registra nova credencial biométrica
 * authenticate(credentialId) → autentica com credencial existente; retorna boolean
 */
import { supabase } from '../../lib/supabase';

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function useWebAuthn() {
  function isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'credentials' in navigator &&
      typeof window.PublicKeyCredential !== 'undefined'
    );
  }

  async function isPlatformAvailable(): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async function registerCredential(params: {
    guardianId: string;
    guardianName: string;
    guardianEmail: string;
    deviceName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Solicitar challenge ao servidor
      const { data: chData, error: chErr } = await supabase.functions.invoke('webauthn', {
        body: { action: 'generate-challenge', purpose: 'register' },
      });
      if (chErr || !chData?.challengeId) return { success: false, error: 'Falha ao gerar challenge.' };

      const { challengeId, challenge } = chData as { challengeId: string; challenge: string };

      // 2. Criar credencial (dispara prompt biométrico)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge:  base64urlToBuffer(challenge),
          rp: {
            name: document.title || 'Escola',
            id:   window.location.hostname,
          },
          user: {
            id:          new TextEncoder().encode(params.guardianId),
            name:        params.guardianEmail,
            displayName: params.guardianName,
          },
          pubKeyCredParams: [
            { alg: -7,   type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification:        'required',
            residentKey:             'preferred',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) return { success: false, error: 'Credencial não criada.' };

      const credentialId = bufferToBase64url(credential.rawId);
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey
        ? bufferToBase64url(response.getPublicKey() ?? new ArrayBuffer(0))
        : null;

      // 3. Registrar no servidor
      const { data: regData, error: regErr } = await supabase.functions.invoke('webauthn', {
        body: { action: 'register', challengeId, credentialId, deviceName: params.deviceName, publicKey },
      });

      if (regErr || !regData?.registered) return { success: false, error: 'Falha ao registrar credencial.' };

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('not allowed')) {
        return { success: false, error: 'Permissão negada ou operação cancelada.' };
      }
      return { success: false, error: msg };
    }
  }

  async function authenticate(credentialId: string): Promise<{ verified: boolean; error?: string }> {
    try {
      // 1. Solicitar challenge
      const { data: chData, error: chErr } = await supabase.functions.invoke('webauthn', {
        body: { action: 'generate-challenge', purpose: 'auth' },
      });
      if (chErr || !chData?.challengeId) return { verified: false, error: 'Falha ao gerar challenge.' };

      const { challengeId, challenge } = chData as { challengeId: string; challenge: string };

      // 2. Autenticar (dispara prompt biométrico)
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge:        base64urlToBuffer(challenge),
          allowCredentials: [{ type: 'public-key', id: base64urlToBuffer(credentialId) }],
          userVerification: 'required',
          timeout:          60000,
        },
      }) as PublicKeyCredential | null;

      if (!assertion) return { verified: false, error: 'Autenticação cancelada.' };

      const returnedCredentialId = bufferToBase64url(assertion.rawId);

      // 3. Verificar no servidor
      const { data: authData, error: authErr } = await supabase.functions.invoke('webauthn', {
        body: { action: 'authenticate', challengeId, credentialId: returnedCredentialId },
      });

      if (authErr || !authData?.verified) return { verified: false, error: 'Verificação falhou.' };

      return { verified: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('not allowed')) {
        return { verified: false, error: 'Permissão negada ou operação cancelada.' };
      }
      return { verified: false, error: msg };
    }
  }

  return { isSupported, isPlatformAvailable, registerCredential, authenticate };
}
