import { shell } from 'electron';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { upsertProvider, getProvider } from './db.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites';

let clientId = '';
let clientSecret = '';

export function loadCredentials() {
    clientId = process.env.GSC_CLIENT_ID || '';
    clientSecret = process.env.GSC_CLIENT_SECRET || '';
}


export function hasCredentials() {
    return Boolean(clientId && clientSecret);
}


export async function startOAuthFlow() {
    if (!hasCredentials()) {
        throw new Error('GSC_CLIENT_ID and GSC_CLIENT_SECRET must be set in .env');
    }

    const { code, redirectUri } = await openBrowserAndWaitForCode();

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const properties = await fetchProperties(tokens.access_token);

    const selectedProperty = properties.length > 0 ? properties[0].siteUrl : null;

    upsertProvider({
        id: 'gsc',
        name: 'Google Search Console',
        connected: 1,
        property: selectedProperty,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry: Date.now() + (tokens.expires_in * 1000),
    });

    return { properties, selectedProperty };
}


export async function getValidAccessToken() {
    const provider = getProvider('gsc');
    if (!provider || !provider.connected) {
        throw new Error('GSC not connected');
    }

    if (provider.token_expiry && Date.now() < provider.token_expiry - 60_000) {
        return provider.access_token;
    }

    if (!provider.refresh_token) {
        throw new Error('No refresh token available. Please reconnect GSC.');
    }

    const tokens = await refreshAccessToken(provider.refresh_token);

    upsertProvider({
        ...provider,
        access_token: tokens.access_token,
        token_expiry: Date.now() + (tokens.expires_in * 1000),
    });

    return tokens.access_token;
}


export async function fetchAvailableProperties() {
    const token = await getValidAccessToken();
    return await fetchProperties(token);
}


export function selectProperty(siteUrl) {
    const provider = getProvider('gsc');
    if (!provider) return;

    upsertProvider({ ...provider, property: siteUrl });
}


function openBrowserAndWaitForCode() {
    return new Promise(function (resolve, reject) {
        const server = createServer(function (req, res) {
            const reqUrl = new URL(req.url, `http://127.0.0.1`);

            if (reqUrl.pathname !== '/callback') {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const code = reqUrl.searchParams.get('code');
            const error = reqUrl.searchParams.get('error');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Authorization complete. You can close this window.</h2></body></html>');

            server.close();

            if (error) {
                reject(new Error(`OAuth error: ${error}`));
                return;
            }

            if (!code) {
                reject(new Error('No authorization code received'));
                return;
            }

            resolve({ code, redirectUri: `http://127.0.0.1:${server.address().port}/callback` });
        });

        server.listen(0, '127.0.0.1', function () {
            const port = server.address().port;
            const redirectUri = `http://127.0.0.1:${port}/callback`;

            const authUrl = new URL(AUTH_ENDPOINT);
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', SCOPE);
            authUrl.searchParams.set('access_type', 'offline');
            authUrl.searchParams.set('prompt', 'consent');

            shell.openExternal(authUrl.toString());
        });

        setTimeout(function () {
            server.close();
            reject(new Error('OAuth flow timed out after 120 seconds'));
        }, 120_000);
    });
}


async function exchangeCodeForTokens(code, redirectUri) {
    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${text}`);
    }

    return await response.json();
}


async function refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${text}`);
    }

    return await response.json();
}


async function fetchProperties(accessToken) {
    const response = await fetch(SITES_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch properties: ${response.status}`);
    }

    const data = await response.json();
    return data.siteEntry || [];
}
