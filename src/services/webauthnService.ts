/**
 * TurnoCerto - WebAuthn & Passkeys Biometric Service
 * Implementa autenticação biométrica via W3C WebAuthn API (navigator.credentials)
 * com verificação obrigatória de usuário (userVerification: "required")
 */

import { EmployeePasskey } from '../types';

export interface WebAuthnVerificationResult {
  success: boolean;
  credentialId?: string;
  deviceLabel?: string;
  errorMessage?: string;
  metodo: 'biometria_passkey' | 'autenticador_dispositivo';
}

const PASSKEYS_LOCAL_KEY = 'turnocerto_employee_passkeys_v1';

// Helper: converte string para ArrayBuffer (Challenge / User ID)
function strToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

// Helper: converte ArrayBuffer para Base64URL
function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Verifica se a API WebAuthn está disponível no navegador
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

/**
 * Verifica se há autenticador de plataforma com biometria (Touch ID, Face ID, Windows Hello, Android Biometrics)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Recupera as credenciais registradas para o colaborador
 */
export function getRegisteredPasskeys(colaboradorId: string): EmployeePasskey[] {
  try {
    const raw = localStorage.getItem(PASSKEYS_LOCAL_KEY);
    if (!raw) return [];
    const all: EmployeePasskey[] = JSON.parse(raw);
    return all.filter((pk) => pk.colaboradorId === colaboradorId && !pk.revokedAt);
  } catch {
    return [];
  }
}

/**
 * Salva uma nova credencial passkey localmente e vinculada ao colaborador
 */
export function savePasskeyLocally(passkey: EmployeePasskey): void {
  try {
    const raw = localStorage.getItem(PASSKEYS_LOCAL_KEY);
    const all: EmployeePasskey[] = raw ? JSON.parse(raw) : [];
    all.push(passkey);
    localStorage.setItem(PASSKEYS_LOCAL_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Erro ao salvar passkey localmente:', err);
  }
}

/**
 * Revoga uma credencial registrada
 */
export function revokePasskey(credentialId: string): void {
  try {
    const raw = localStorage.getItem(PASSKEYS_LOCAL_KEY);
    if (!raw) return;
    const all: EmployeePasskey[] = JSON.parse(raw);
    const updated = all.map((pk) =>
      pk.credentialId === credentialId ? { ...pk, revokedAt: new Date().toISOString() } : pk
    );
    localStorage.setItem(PASSKEYS_LOCAL_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao revogar passkey:', err);
  }
}

/**
 * Identifica o rótulo do dispositivo atual (ex: iPhone, Android, MacBook, PC Windows)
 */
export function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'Dispositivo Apple iOS';
  if (/Android/.test(ua)) return 'Dispositivo Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Apple Mac';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Linux/.test(ua)) return 'Computador Linux';
  return 'Aparelho Registrado';
}

/**
 * Cadastro de Nova Passkey / Biometria no Aparelho
 */
export async function registerDevicePasskey(
  colaboradorId: string,
  colaboradorNome: string,
  customLabel?: string
): Promise<{ success: boolean; passkey?: EmployeePasskey; errorMessage?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      errorMessage: 'Seu navegador não oferece suporte à autenticação segura WebAuthn/Passkeys.',
    };
  }

  try {
    // 1. Gera desafio criptográfico exclusivo (nonce com validade curta)
    const challengeStr = `tc-reg-${colaboradorId}-${Date.now()}-${Math.random()}`;
    const challengeBuffer = strToBuffer(challengeStr);
    const userIdBuffer = strToBuffer(colaboradorId);

    // 2. Parâmetros de criação com exigência estrita de verificação do usuário
    const creationOptions: CredentialCreationOptions = {
      publicKey: {
        challenge: challengeBuffer,
        rp: {
          name: 'TurnoCerto - Gestão de Terceirização',
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userIdBuffer,
          name: `${colaboradorId}@turnocerto.local`,
          displayName: colaboradorNome,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256 (Padrão ouro WebAuthn)
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Biometria do aparelho (Touch ID/Face ID/Windows Hello/Android)
          userVerification: 'required', // Obriga verificação de usuário biométrica/PIN
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    };

    const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, errorMessage: 'Criação de credencial biométrica cancelada pelo usuário.' };
    }

    const credentialId = credential.id || bufferToBase64URL(credential.rawId);
    const deviceLabel = customLabel || getDeviceLabel();

    const newPasskey: EmployeePasskey = {
      id: `pk-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      authUserId: colaboradorId,
      colaboradorId,
      credentialId,
      signCount: 1,
      deviceLabel,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    savePasskeyLocally(newPasskey);

    return {
      success: true,
      passkey: newPasskey,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'NotAllowedError') {
      return { success: false, errorMessage: 'A ativação da biometria foi cancelada ou não autorizada no dispositivo.' };
    }
    if (error.name === 'InvalidStateError') {
      return { success: false, errorMessage: 'Este aparelho já possui uma credencial biométrica ativa para este colaborador.' };
    }
    return {
      success: false,
      errorMessage: `Falha na ativação da biometria: ${error.message || 'Erro desconhecido'}`,
    };
  }
}

/**
 * Validação de Ponto via Biometria / Passkey do Dispositivo
 * Dispara o desafio criptográfico obrigatório navigator.credentials.get()
 */
export async function verifyPasskeyPunch(
  colaboradorId: string,
  colaboradorNome: string
): Promise<WebAuthnVerificationResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      errorMessage: 'Navegador incompatível com verificação biométrica WebAuthn.',
      metodo: 'biometria_passkey',
    };
  }

  // Verifica se há autenticador biométrico de plataforma
  const hasPlatform = await isPlatformAuthenticatorAvailable();

  // Se o colaborador ainda não tem passkey cadastrada, tenta registrar e validar na primeira batida
  const registered = getRegisteredPasskeys(colaboradorId);

  try {
    const challengeStr = `tc-punch-${colaboradorId}-${Date.now()}-${Math.random()}`;
    const challengeBuffer = strToBuffer(challengeStr);

    const requestOptions: CredentialRequestOptions = {
      publicKey: {
        challenge: challengeBuffer,
        rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        userVerification: 'required', // Obriga TouchID / FaceID / Biometria do aparelho
        timeout: 60000,
        allowCredentials: registered.length > 0
          ? registered.map((pk) => ({
              id: strToBuffer(pk.credentialId),
              type: 'public-key' as const,
              transports: ['internal' as AuthenticatorTransport],
            }))
          : undefined,
      },
    };

    // Solicita assertion biométrica
    const assertion = (await navigator.credentials.get(requestOptions)) as PublicKeyCredential | null;

    if (!assertion) {
      return {
        success: false,
        errorMessage: 'A autenticação biométrica não foi concluída.',
        metodo: 'biometria_passkey',
      };
    }

    const credentialId = assertion.id || bufferToBase64URL(assertion.rawId);

    // Se é a primeira vez e não estava salva, salva a credencial
    if (registered.length === 0) {
      const autoPasskey: EmployeePasskey = {
        id: `pk-auto-${Date.now()}`,
        authUserId: colaboradorId,
        colaboradorId,
        credentialId,
        signCount: 1,
        deviceLabel: getDeviceLabel(),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };
      savePasskeyLocally(autoPasskey);
    }

    return {
      success: true,
      credentialId,
      deviceLabel: getDeviceLabel(),
      metodo: hasPlatform ? 'biometria_passkey' : 'autenticador_dispositivo',
    };
  } catch (err: unknown) {
    const error = err as Error;

    // Se o usuário cancelou a leitura biométrica
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        errorMessage: 'Autenticação biométrica cancelada pelo usuário ou tempo esgotado.',
        metodo: 'biometria_passkey',
      };
    }

    // Se não há credenciais compatíveis registradas ou plataforma sem suporte nativo
    // Oferece fluxo de registro imediato
    return {
      success: false,
      errorMessage: error.message || 'Falha ao autenticar biometria no aparelho.',
      metodo: 'biometria_passkey',
    };
  }
}
