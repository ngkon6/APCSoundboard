import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { lookup } from "mime-types";
import { join } from "path";

import APCMini from "./class/APCMini.js";
import pkg from "../package.json" with {type: "json"};


app.setName("APCSoundboard");
app.whenReady().then(() => {
    const window = new BrowserWindow({
        minWidth: 1337,
        minHeight: 780,
        width: 1920,
        height: 1080,
        show: false,
        webPreferences: {
            sandbox: false,
            devTools: !app.isPackaged,
            preload: join(import.meta.dirname, "window", "preload.js")
        }
    });
    window.removeMenu();
    window.loadFile(join(import.meta.dirname, "window", "index.html"));
    window.setIcon(join(import.meta.dirname, "icon.png"));

    if (!window.isMaximized()) window.maximize();
    window.on("ready-to-show", () => window.show());
    window.webContents.on("dom-ready", () => window.webContents.send("pkg-version", pkg.version));

    if (APCMini.isConnected()) {
        const apc = new APCMini();

        apc.on("pad-pressed", pad => window.webContents.send("pad-pressed", pad));
        apc.on("scene-launch-button-pressed", btn => window.webContents.send("softkey-pressed", btn));
        apc.on("shift-pressed", () => window.webContents.send("shift-pressed"));
        apc.on("shift-released", () => window.webContents.send("shift-released"));

        ipcMain.on("add-item", () => {
            dialog.showOpenDialog(window, {
                defaultPath: app.getPath("music"),
                title: "Select an audio file to add",
                filters: [{name: "Audio files", extensions: ["mp3", "wav", "m4a", "ogg", "aac", "flac", "aiff", "wma"]}],
                properties: ["openFile"]
            }).then((e) => {
                const path = e.filePaths[0];
                if (e.canceled || !/audio\/(\w+)/.test(lookup(path))) return;

                window.webContents.send("item-selected", path);
            });
        });
        ipcMain.on("pad-led", (_e, index, color, state) => {
            apc.pads[index].color = color;
            apc.pads[index].state = state;
            apc.update();
        });
        ipcMain.on("softkey-led", (_e, index, state) => {
            apc.sceneLaunchButtons[index] = Number(state);
            apc.update();
        });

        app.on("before-quit", () => apc.blackout());

        setInterval(() => {
            if (!APCMini.isConnected()) window.webContents.send("apc-connect-failed");
        }, 2000);
    } else window.webContents.send("apc-connect-failed");
});
