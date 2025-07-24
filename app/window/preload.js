import { ipcRenderer } from "electron";

import Pad from "../class/Pad.js";
import Softkey from "../class/Softkey.js";

/** @type {Pad[]} */
const pads = new Array(64);
const apcColorIndexes = [3, 8, 5, 9, 13, 16, 17, 21, 29, 37, 41, 45, 49, 53, 57, 4, 12, 20, 36, 52];

/** @type {string} */
let pathToAdd;
let shiftPressed = false;
let targetPad = -1; // for edit/delete actions

const softkey = {
    empty: new Softkey("", () => {}),

    // main
    addItem: new Softkey("Add item", () => ipcRenderer.send("add-item")),
    editItem: new Softkey("Edit item", () => state.change(state.PROMPT_EDIT)),
    deleteItem: new Softkey("Delete item", () => state.change(state.PROMPT_DELETE)),
    stopAllItems: new Softkey("Stop all items", () => {
        for (const pad of pads) {
            if (pad.audio) pad.audio.currentTime = pad.audio.duration;
        }
    }),

    // edit
    editProceedAfterFail: new Softkey("Stop and continue", () => {
        pads[targetPad].audio.currentTime = pads[targetPad].audio.duration;
    }),
    itemColor: new Softkey("Change color", () => {
        document.getElementById("color-selection").style.display = "grid";
        setColorSelectorPosition();

        state.change(state.EDIT_COLOR);
    }),

    // returns
    returnToMain: new Softkey("Cancel", () => {
        if (targetPad > -1) initiatePad(targetPad);
        state.change(state.NORMAL);
    }),
    returnToEdit: new Softkey("Back", () => {
        state.change(state.EDITING);
        document.getElementById("color-selection").style.display = "";
    }),
};

const brightness = {
    NORMAL: 3,
    ACTIVE: 6,
    BREATHE: 10,
    FLASH: 15
};

const state = {
    NORMAL: 0,
    PROMPT_ADD: 1,
    PROMPT_EDIT: 2,
    PROMPT_DELETE: 3,
    CONFIRM_DELETE: 4,
    EDITING: 5,
    EDIT_FAIL: 6,
    EDIT_COLOR: 7,

    current: 0,
    softkeyList: [
        [softkey.addItem, softkey.editItem, softkey.deleteItem, null, null, null, null, softkey.stopAllItems],
        [null, null, null, null, softkey.returnToMain, null, null, null],
        [null, null, null, null, softkey.returnToMain, null, null, null],
        [null, null, null, null, softkey.returnToMain, null, null, null],
        [null, null, null, null, softkey.returnToMain, null, null, null],
        [softkey.itemColor, null, null, null, null, null, softkey.returnToMain, null],
        [null, null, null, null, null, softkey.editProceedAfterFail, softkey.returnToMain, null],
        [null, null, null, null, null, null, softkey.returnToEdit, null]
    ],
    labelList: [
        "",
        "Select a pad to locate the sound effect",
        "Select a pad to edit",
        "Select a pad to delete",
        "Press again to confirm, or press [Cancel] to abort",
        "Select a property to edit",
        "This pad cannot be edited because it is active right now",
        "Select a color from the list"
    ],
    change: (to) => {
        state.current = to;
        document.getElementById("info-label").textContent = state.labelList[to];

        for (let i=0; i<8; i++) {
            const target = state.softkeyList[to][i] ?? softkey.empty;
            document.getElementById("softkeys").children[i].textContent = target.element.textContent;
            document.getElementById("softkeys").children[i].className = target.element.className;
            document.getElementById("softkeys").children[i].onclick = target.element.onclick;

            ipcRenderer.send("softkey-led", i, Boolean(state.softkeyList[to][i]));
        }

        if (pads[targetPad] && to == state.NORMAL) targetPad = -1;
    }
};

const setColorSelectorPosition = () => {
    if (targetPad == -1) return;

    const left = pads[targetPad].element.offsetLeft - (document.getElementById("color-selection").offsetWidth - pads[targetPad].element.offsetWidth) / 2;
    const top = (targetPad < 32) ? pads[targetPad].element.offsetTop - document.getElementById("color-selection").offsetHeight - 5 : pads[targetPad].element.offsetTop + 65;
    const min = document.getElementById("button-grid").offsetLeft;
    const max = min + document.getElementById("button-grid").offsetWidth - document.getElementById("color-selection").offsetWidth;

    document.getElementById("color-selection").style.left = `${Math.min(Math.max(min, left), max)}px`;
    document.getElementById("color-selection").style.top = `${top}px`;
};

const initiatePad = (pad) => {
    ipcRenderer.send("pad-led", pad, pads[pad].getColor(), pads[pad].playing ? brightness.ACTIVE : brightness.NORMAL);

    pads[pad].audio.onplay = () => {
        pads[pad].playing = true;
        pads[pad].element.style.boxShadow = "0 0 12px white";
        ipcRenderer.send("pad-led", pad, pads[pad].getColor(), brightness.ACTIVE);
    };
    pads[pad].audio.onended = () => {
        pads[pad].playing = false;
        pads[pad].element.style.boxShadow = "";

        if (state.current == state.EDIT_FAIL) state.change(state.EDITING);
        else ipcRenderer.send("pad-led", pad, pads[pad].getColor(), brightness.NORMAL);
    };
};

addEventListener("DOMContentLoaded", () => {
    state.change(state.NORMAL);

    for (let i=0; i<pads.length; i++) {
        pads[i] = new Pad(i);
        if (pads[i].isOccupied()) initiatePad(i);

        document.getElementById("button-grid").appendChild(pads[i].element);
    }
    for (let i=0; i<apcColorIndexes.length; i++) {
        const button = document.createElement("button");
        button.style.backgroundColor = `var(--apc${apcColorIndexes[i]})`;

        const x = i % 5 + 1;
        const y = Math.floor(i / 5) + 1;
        button.style.gridArea = `${y} / ${x} / ${y} / ${x}`;
        button.onclick = () => {
            pads[targetPad].setColor(apcColorIndexes[i]);
            ipcRenderer.send("pad-led", pads[targetPad].index, apcColorIndexes[i], brightness.BREATHE);
            document.getElementById("color-selection").style.display = "";
            state.change(state.EDITING);
        };

        document.getElementById("color-selection").appendChild(button);
    }
    addEventListener("resize", setColorSelectorPosition);

    ipcRenderer.on("pkg-version", (_e, ver) => document.querySelector("body > h1 span").textContent += ` v${ver}`);

    ipcRenderer.on("shift-pressed", () => shiftPressed = true);
    ipcRenderer.on("shift-released", () => shiftPressed = false);

    ipcRenderer.on("apc-connect-failed", () => {
        document.getElementById("overlay").style.display = "block";
    });

    ipcRenderer.on("item-selected", (_e, path) => {
        state.change(state.PROMPT_ADD);
        pathToAdd = path;
    });

    ipcRenderer.on("softkey-pressed", (_e, sk) => state.softkeyList[state.current][+sk] ? state.softkeyList[state.current][+sk].element.click() : sk);
    ipcRenderer.on("pad-pressed", (_e, pad) => {
        if (state.current == state.NORMAL && pads[pad].isOccupied()) {
            if (shiftPressed) {
                pads[pad].audio.currentTime = pads[pad].audio.duration;
            } else {
                pads[pad].audio.currentTime = 0;
                pads[pad].audio.play();
            }
        } else if (state.current == state.PROMPT_ADD) {
            pads[pad].add(pathToAdd, apcColorIndexes[Math.floor(Math.random() * apcColorIndexes.length)]);
            initiatePad(pad);

            state.change(state.NORMAL);
        } else if (state.current == state.PROMPT_EDIT && pads[pad].isOccupied()) {
            targetPad = pad;
            ipcRenderer.send("pad-led", pad, pads[pad].getColor(), brightness.BREATHE);

            state.change(pads[pad].playing ? state.EDIT_FAIL : state.EDITING);
        } else if (state.current == state.PROMPT_DELETE && pads[pad].isOccupied()) {
            targetPad = pad;
            ipcRenderer.send("pad-led", pad, pads[pad].getColor(), brightness.FLASH);

            state.change(state.CONFIRM_DELETE);
        } else if (state.current == state.CONFIRM_DELETE && pad == targetPad) {
            pads[pad].audio.currentTime = pads[pad].audio.duration;
            pads[pad].delete();
            ipcRenderer.send("pad-led", pad, 0, brightness.ACTIVE);

            state.change(state.NORMAL);
        }
    });
});
