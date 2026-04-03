import { Menu, app, shell } from 'electron';

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
                            click: () => {
                                mainWindow.webContents.send('provider-action', {
                                    provider: 'gsc',
                                    action: 'connect',
                                });
                            },
                        },
                        {
                            label: 'Disconnect',
                            click: () => {
                                mainWindow.webContents.send('provider-action', {
                                    provider: 'gsc',
                                    action: 'disconnect',
                                });
                            },
                        },
                        { type: 'separator' },
                        {
                            label: 'Switch Property...',
                            click: () => {
                                mainWindow.webContents.send('provider-action', {
                                    provider: 'gsc',
                                    action: 'switch-property',
                                });
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
                    click: () => shell.openExternal('https://web.archive.org/'),
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
