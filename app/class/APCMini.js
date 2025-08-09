/**
 * @typedef {{color: number, state: number}} Pad
 */

import easymidi from "easymidi";
import { EventEmitter } from "events";

export default class APCMini extends EventEmitter {
    #input;
    #output;

    #lastPads;
    #lastTrackButtons;
    #lastSceneLaunchButtons;

    static color = {
        BLACK: 0,
        WHITE: 3,
        WARM_WHITE: 8,
        RED: 5,
        ORANGE: 9,
        YELLOW: 13,
        MINT_GREEN: 16,
        APPLE_GREEN: 17,
        GREEN: 21,
        SEA_GREEN: 29,
        CYAN: 37,
        LAVENDER: 41,
        BLUE: 45,
        PURPLE: 49,
        MAGENTA: 53,
        PINK: 57,
        LIGHT_RED: 4,
        LIGHT_YELLOW: 12,
        LIGHT_GREEN: 20,
        LIGHT_BLUE: 36,
        LIGHT_MAGENTA: 52,
        RED_ORANGE: 60
    };

    static state = {
        BRIGHTNESS_10: 0,
        BRIGHTNESS_25: 1,
        BRIGHTNESS_50: 2,
        BRIGHTNESS_65: 3,
        BRIGHTNESS_75: 4,
        BRIGHTNESS_90: 5,
        BRIGHTNESS_100: 6,
        BREATHING_16: 7,
        BREATHING_8: 8,
        BREATHING_4: 9,
        BREATHING_2: 10,
        FLASHING_24: 11,
        FLASHING_16: 12,
        FLASHING_8: 13,
        FLASHING_4: 14,
        FLASHING_2: 15
    };

    static buttonState = {
        OFF: 0,
        ON: 1,
        FLASHING: 2
    };

    /**
     * Check whether the corresponding input and output devices are found, and return their indexes.
     * @returns {{input: number, output: number}}
     * @throws {Error}
     */
    static #getIO() {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        let input = -1;
        let output = -1;

        for (let i in inputs)
            if (inputs[i].includes("APC mini mk2 Contr")) input = +i;
        for (let i in outputs)
            if (outputs[i].includes("APC mini mk2 Contr")) output = +i;

        if (input == -1 || output == -1) throw new Error("APC Mini Mk2 not found.");

        return {input, output};
    }

    /**
     * Check whether the device is connected.
     * @returns {boolean}
     */
    static isConnected() {
        try {
            APCMini.#getIO();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Make an independent clone of an object.
     * @param {object} item
     * @returns {object}
     */
    #clone(item) {
        return JSON.parse(JSON.stringify(item));
    }

    /** @constructor */
    constructor() {
        super();

        const dev = APCMini.#getIO();

        this.#input = new easymidi.Input(easymidi.getInputs()[dev.input]);
        this.#output = new easymidi.Output(easymidi.getOutputs()[dev.output]);

        /** @type {Pad[]} */
        this.pads = new Array(64).fill().map(() => ({color: APCMini.color.BLACK, state: APCMini.state.BRIGHTNESS_100}));
        /** @type {number[]} */
        this.trackButtons = new Array(8).fill(APCMini.buttonState.OFF);
        /** @type {number[]} */
        this.sceneLaunchButtons = new Array(8).fill(APCMini.buttonState.OFF);

        /** @type {Pad[]} */
        this.#lastPads = this.#clone(this.pads);
        /** @type {number[]} */
        this.#lastTrackButtons = this.#clone(this.trackButtons);
        /** @type {number[]} */
        this.#lastSceneLaunchButtons = this.#clone(this.sceneLaunchButtons);

        this.#input.on("noteon", e => {
            if (e.note < 64)
                super.emit("pad-pressed", e.note);
            else if (e.note < 112)
                super.emit("track-button-pressed", e.note - 100);
            else if (e.note < 122)
                super.emit("scene-launch-button-pressed", e.note - 112);
            else
                super.emit("shift-pressed");
        });
        this.#input.on("noteoff", e => {
            if (e.note < 64)
                super.emit("pad-released", e.note);
            else if (e.note < 112)
                super.emit("track-button-released", e.note - 100);
            else if (e.note < 122)
                super.emit("scene-launch-button-released", e.note - 112);
            else
                super.emit("shift-released");
        });
        this.#input.on("cc", e => {
            super.emit("fader-change", {fader: e.controller - 48, value: e.value});
        });

        this.update();
    }

    /**
     * Synchronize the pads, track buttons and scene launch buttons to the actual device.
     * @param {boolean} force - whether to force update the APC Mini, regardless of the current pad state.
     */
    update(force = false) {
        for (let i=0; i<this.pads.length; i++) {
            if (this.pads[i] != this.#lastPads[i] || force) {
                this.#output.send("noteon", {note: i, velocity: this.pads[i].color, channel: this.pads[i].state});
                this.#lastPads[i] = this.#clone(this.pads[i]);
            }
        }
        for (let i=0; i<this.trackButtons.length; i++) {
            if (this.trackButtons[i] != this.#lastTrackButtons[i] || force) {
                this.#output.send("noteon", {note: i + 100, velocity: this.trackButtons[i], channel: 0});
                this.#lastTrackButtons[i] = this.#clone(this.trackButtons[i]);
            }
        }
        for (let i=0; i<this.sceneLaunchButtons.length; i++) {
            if (this.sceneLaunchButtons[i] != this.#lastSceneLaunchButtons[i] || force) {
                this.#output.send("noteon", {note: i + 112, velocity: this.sceneLaunchButtons[i], channel: 0});
                this.#lastSceneLaunchButtons[i] = this.#clone(this.sceneLaunchButtons[i]);
            }
        }
    }

    /** Set all pads and buttons to black. */
    blackout() {
        for (const pad of this.pads) {
            pad.color = APCMini.color.BLACK;
            pad.state = APCMini.state.BRIGHTNESS_100;
        }
        for (let tb in this.trackButtons) this.trackButtons[tb] = APCMini.buttonState.OFF;
        for (let slb in this.sceneLaunchButtons) this.sceneLaunchButtons[slb] = APCMini.buttonState.OFF;

        this.update(true);
    }
};
