/** @callback EmptyCallback */

export default class Softkey {
    /**
     * @constructor
     * @param {string} label
     * @param {EmptyCallback} onclick
     */
    constructor(label, onclick) {
        this.element = document.createElement("div");

        if (label.length > 0) this.element.className = "softkey-active";
        this.element.textContent = (label) ? label : "\u00a0";
        this.element.onclick = onclick;
    }
};
