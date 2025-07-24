import { basename } from "path";

export default class Pad {
    /**
     * @constructor
     * @param {number} index
     */
    constructor(index) {
        this.index = index;
        this.element = document.createElement("div");

        const x = index % 8 + 1;
        const y = 8 - Math.floor(index / 8);
        this.element.style.gridArea = `${y} / ${x} / ${y} / ${x}`;

        /** @type {HTMLAudioElement | null} */
        this.audio = null;
        this.playing = false;

        this.#setElement();
    }

    #setElement() {
        const audio = localStorage.getItem(`pad-${this.index}-audio`);
        const color = localStorage.getItem(`pad-${this.index}-color`);

        this.element.textContent = (audio) ? basename(audio) : "Empty";
        this.element.style.border = `2px solid var(--${color ? `apc${color}` : "foreground-empty"})`;
        this.element.style.color = `var(--${color ? `apc${color}` : "foreground-empty"})`;

        this.audio = (audio) ? new Audio(audio) : null;
    }

    /** @returns {boolean} */
    isOccupied() {
        return Boolean(this.audio);
    }

    /** @returns {string} */
    getColor() {
        return localStorage.getItem(`pad-${this.index}-color`) ?? 0;
    }
    /** @param {number} to */
    setColor(to) {
        localStorage.setItem(`pad-${this.index}-color`, to);
        this.#setElement();
    }

    /**
     * @param {string} audioPath
     * @param {number} color
     */
    add(audioPath, color) {
        localStorage.setItem(`pad-${this.index}-audio`, audioPath);
        localStorage.setItem(`pad-${this.index}-color`, color.toString());

        this.#setElement();
    }

    delete() {
        localStorage.removeItem(`pad-${this.index}-audio`);
        localStorage.removeItem(`pad-${this.index}-color`);

        this.#setElement();
    }
};
