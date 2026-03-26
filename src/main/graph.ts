import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { getAccessToken } from './auth';

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const token = await getAccessToken();
  const client = getGraphClient(token);

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: to
        .split(';')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0)
        .map(addr => ({ emailAddress: { address: addr } })),
    },
    saveToSentItems: true,
  };

  await client.api('/me/sendMail').post(message);
}

export async function getUserProfile(): Promise<{ displayName: string; mail: string }> {
  const token = await getAccessToken();
  const client = getGraphClient(token);
  const profile = await client.api('/me').select('displayName,mail,userPrincipalName').get();
  return {
    displayName: profile.displayName,
    mail: profile.mail || profile.userPrincipalName,
  };
}
