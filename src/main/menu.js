import { Menu, app, shell, dialog } from 'electron';
import { startOAuthFlow, fetchAvailableProperties, selectProperty, hasCredentials } from './gsc-auth.js';
import { disconnectProvider, getProvider } from './db.js';

export function buildMenu(mainWindow) {
    const isMac = process.platform === 'darwin';

    const template = [
        ...(isMac
            ? [{
                label: app.name,
                submenu: [
                    { role: 'about' },
                    {
                        label: 'Check for Updates...',
                        enabled: false,
                    },
                    { type: 'separator' },
                    {
                        label: 'Settings...',
                        accelerator: 'CmdOrCtrl+,',
                        enabled: false,
                    },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' },
                ],
            }]
            : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
            ],
        },
        {
            label: 'Accounts',
            submenu: [
                {
                    label: 'Google Search Console',
                    submenu: [
                        {
                            label: 'Connect...',
                            click: async function () {
                                if (!hasCredentials()) {
                                    dialog.showErrorBox(
                                        'Missing Credentials',
                                        'GSC_CLIENT_ID and GSC_CLIENT_SECRET must be set in .env file.'
                                    );
                                    return;
                                }
                                try {
                                    const result = await startOAuthFlow();
                                    mainWindow.webContents.send('provider-action', {
                                        provider: 'gsc',
                                        action: 'connected',
                                        properties: result.properties.map(function (p) { return p.siteUrl; }),
                                        selectedProperty: result.selectedProperty,
                                    });
                                } catch (err) {
                                    dialog.showErrorBox('Connection Failed', err.message);
                                }
                            },
                        },
                        {
                            label: 'Disconnect',
                            click: function () {
                                disconnectProvider('gsc');
                                mainWindow.webContents.send('provider-action', {
                                    provider: 'gsc',
                                    action: 'disconnected',
                                });
                            },
                        },
                        { type: 'separator' },
                        {
                            label: 'Switch Property...',
                            click: async function () {
                                const provider = getProvider('gsc');
                                if (!provider || !provider.connected) {
                                    dialog.showErrorBox('Not Connected', 'Please connect GSC first.');
                                    return;
                                }
                                try {
                                    const properties = await fetchAvailableProperties();
                                    const siteUrls = properties.map(function (p) { return p.siteUrl; });
                                    mainWindow.webContents.send('provider-action', {
                                        provider: 'gsc',
                                        action: 'switch-property',
                                        properties: siteUrls,
                                        currentProperty: provider.property,
                                    });
                                } catch (err) {
                                    dialog.showErrorBox('Error', err.message);
                                }
                            },
                        },
                    ],
                },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac
                    ? [
                        { type: 'separator' },
                        { role: 'front' },
                    ]
                    : [
                        { role: 'close' },
                    ]),
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: `Version ${app.getVersion()}`,
                    enabled: false,
                },
                { type: 'separator' },
                {
                    label: 'Learn More...',
                    click: function () {
                        shell.openExternal('https://web.archive.org/');
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
