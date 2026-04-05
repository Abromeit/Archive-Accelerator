import { Menu, app, shell, dialog } from 'electron';
import { startOAuthFlow, hasCredentials } from './gsc-auth.js';
import { disconnectProvider, getProvider } from './db.js';

export function buildMenu() {
    const isMac = process.platform === 'darwin';
    const gsc = getProvider('gsc');
    const gscConnected = Boolean(gsc && gsc.connected);

    const gscSubmenu = gscConnected
        ? [
            {
                label: `Connected to ${gsc.email || 'Google Account'}`,
                enabled: false,
            },
            { type: 'separator' },
            {
                label: 'Disconnect',
                click: function () {
                    disconnectProvider('gsc');
                    buildMenu();
                },
            },
        ]
        : [
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
                        await startOAuthFlow();
                        buildMenu();
                    } catch (err) {
                        dialog.showErrorBox('Connection Failed', err.message);
                    }
                },
            },
        ];

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
                    submenu: gscSubmenu,
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
