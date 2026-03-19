export const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'YOUR_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}`,
  },
};

export const graphScopes = ['User.Read', 'Mail.Send'];
