import APCMini from "./class/APCMini.js"

const map = (x, in_min, in_max, out_min, out_max) => (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;

const apc = new APCMini();
apc.blackout();
process.on("SIGINT", () => {
    apc.blackout();
    process.exit(0);
});

const startButtons = [0x1b, 0x1c, 0x23, 0x24];
const snakeColors = [APCMini.color.GREEN, APCMini.color.APPLE_GREEN, APCMini.color.YELLOW];
const snake = [{x: 3, y: 1}, {x: 2, y: 1}, {x: 1, y: 1}];
const apple = {x: Math.floor(Math.random() * 8), y: Math.floor(Math.random() * 5) + 3, eaten: false};
const snakeStartLength = snake.length;
const score = {apples: 0, total: 0};
const time = {start: 0, end: 0};

/** @type {"left" | "right" | "up" | "down"} */
let direction = "";
/** @type {"left" | "right" | "up" | "down"} */
let actualDirection = "";
let gameOver = false;
let startMenu = true;
let updateInterval = 500;


direction = "right";
actualDirection = "right";

apc.on("track-button-pressed", e => {
    if (e == 4 && actualDirection != "down") direction = "up";
    else if (e == 5 && actualDirection != "up") direction = "down";
    else if (e == 6 && actualDirection != "right") direction = "left";
    else if (e == 7 && actualDirection != "left") direction = "right";
});
apc.on("fader-change", e => {
    if (e.fader != 8 || !startMenu) return;

    updateInterval = map(e.value, 0, 127, 1000, 100);
    for (let i in apc.sceneLaunchButtons) apc.sceneLaunchButtons[7 - i] = (i / 8 * 127 <= e.value) ? APCMini.buttonState.ON : APCMini.buttonState.OFF;
    apc.update();
});
apc.on("pad-pressed", e => {
    if (startMenu && startButtons.includes(e)) {
        startMenu = false;
        for (let i=4; i<8; i++) apc.trackButtons[i] = APCMini.buttonState.ON;

        update();
        setInterval(update, Math.round(updateInterval));
        console.log(`\x1b[32mStarting with \x1b[33m${Math.round(updateInterval)}ms\x1b[32m update interval!\x1b[0m`);
        time.start = new Date().getTime();
    }
});

const update = () => {
    if (gameOver) return;

    actualDirection = direction;

    const newSnake = JSON.parse(JSON.stringify(snake[0]));
    if (direction == "up") {
        if (newSnake.y++ >= 7) newSnake.y = 0;
    } else if (direction == "down") {
        if (newSnake.y-- <= 0) newSnake.y = 7;
    } else if (direction == "left") {
        if (newSnake.x-- <= 0) newSnake.x = 7;
    } else if (direction == "right") {
        if (newSnake.x++ >= 7) newSnake.x = 0;
    }

    for (let i=1; i<snake.length - 1; i++) {
        if (newSnake.x == snake[i].x && newSnake.y == snake[i].y) {
            gameOver = true;
            break;
        }
    }

    if (newSnake.x == apple.x && newSnake.y == apple.y) apple.eaten = true;
    snake.unshift(newSnake);

    if (apple.eaten) {
        apple.x = Math.floor(Math.random() * 8);
        apple.y = Math.floor(Math.random() * 8);
    } else if (!gameOver) snake.pop();

    for (const pad of apc.pads) pad.color = APCMini.color.BLACK;
    for (let i in snake) {
        const pad = snake[i].y * 8 + snake[i].x;
        const color = (i == 0) ? snakeColors[2] : snakeColors[Number(i % 2 == 1)];

        apc.pads[pad].color = (gameOver) ? APCMini.color.RED_ORANGE : color;
        apc.pads[pad].state = (gameOver) ? APCMini.state.FLASHING_4 : APCMini.state.BRIGHTNESS_100;
    }
    apc.pads[apple.y * 8 + apple.x].color = APCMini.color.RED;

    score.apples = snake.length - snakeStartLength - 1;
    score.total = score.apples * map(updateInterval, 100, 1000, 5, 1);
    apple.eaten = false;
    apc.update();

    if (gameOver) {
        time.end = new Date().getTime();

        let appleMessage = `\x1b[33m${score.apples}\x1b[31m `;
        appleMessage += (score.apples == 1) ? "apple" : "apples";
        let scoreMessage = `\x1b[33m${score.total.toFixed(1)}\x1b[31m `;
        scoreMessage += (score.total == 1) ? "point" : "points";
        const timeMessage = `\x1b[33m${Math.round((time.end - time.start) / 1000)}\x1b[31m seconds`;

        console.warn(`\x1b[31mGame over! You ate ${appleMessage} in ${timeMessage} and earned ${scoreMessage}!\x1b[0m`);
        process.exit(1);
    }
};

for (const i of startButtons) {
    apc.pads[i].color = APCMini.color.SEA_GREEN;
    apc.pads[i].state = APCMini.state.BREATHING_2;
}
apc.update();