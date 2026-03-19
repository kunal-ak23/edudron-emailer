import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from '@azure/msal-node';
import { shell } from 'electron';
import { msalConfig, graphScopes } from './auth-config';
import type { UserProfile } from '../shared/ipc-types';

let pca: PublicClientApplication;
let currentAccount: AccountInfo | null = null;

export async function initAuth(): Promise<void> {
  pca = new PublicClientApplication({ auth: msalConfig.auth });
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
  }
}

export async function login(): Promise<UserProfile> {
  const authResult = await pca.acquireTokenInteractive({
    scopes: graphScopes,
    openBrowser: async (url) => { await shell.openExternal(url); },
    successTemplate: '<h1>Signed in! You can close this window.</h1>',
    errorTemplate: '<h1>Sign-in failed. Check the app for details.</h1>',
  });
  currentAccount = authResult.account;
  return {
    displayName: authResult.account.name || authResult.account.username,
    email: authResult.account.username,
  };
}

export async function logout(): Promise<void> {
  if (currentAccount) {
    await pca.getTokenCache().removeAccount(currentAccount);
    currentAccount = null;
  }
}

export async function getAccessToken(): Promise<string> {
  if (!currentAccount) throw new Error('Not logged in');
  try {
    const result = await pca.acquireTokenSilent({
      scopes: graphScopes,
      account: currentAccount,
    });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const result = await pca.acquireTokenInteractive({
        scopes: graphScopes,
        openBrowser: async (url) => { await shell.openExternal(url); },
      });
      currentAccount = result.account;
      return result.accessToken;
    }
    throw error;
  }
}

export function getStatus(): UserProfile | null {
  if (!currentAccount) return null;
  return {
    displayName: currentAccount.name || currentAccount.username,
    email: currentAccount.username,
  };
}
