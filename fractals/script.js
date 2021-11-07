const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d');
const container = document.getElementById("content");

let cameraOffset = { x: 0, y: 0 }
let cameraZoom = 0.7;
const MAX_ZOOM = 5;

const MAX_ITERATIONS = 100;
const colors = [];
let theme = 'grey';
let func = 'ctg';

(function () {
    setGreyTheme();
    resizeCanvas();
})();

function setGreyTheme(noDraw) {
    for (let n = 0; n < MAX_ITERATIONS; n++) {
        colors[n] = [n * 255 / MAX_ITERATIONS, n * 255 / MAX_ITERATIONS, n * 255 / MAX_ITERATIONS];
    }
    theme = 'grey';
    if (!noDraw) draw();
}

function setColoredTheme(noDraw) {
    for (let n = 0; n < MAX_ITERATIONS; n++) {
        colors[n] = hslToRgb(n / MAX_ITERATIONS / 3, 1, n / MAX_ITERATIONS);
    }
    theme = 'color';
    if (!noDraw) draw();
}

function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}

function cMul(one, two) {
    return {
        x: one.x * two.x - one.y * two.y,
        y: one.x * two.y + one.y * two.x
    };
}

// https://dlmf.nist.gov/4.21#E40
function cSin(vec) {
    return {
        x: Math.sin(vec.x) * Math.cosh(vec.y),
        y: Math.cos(vec.x) * Math.sinh(vec.y),
    }
}

function cCos(vec) {
    return {
        x: Math.cos(vec.x) * Math.cosh(vec.y),
        y: -Math.sin(vec.x) * Math.sinh(vec.y),
    }
}

function cCot(vec) {
    let c2 = { x: vec.x * 2, y: vec.y * 2 };
    return {
        x: Math.sin(c2.x) / (Math.cosh(c2.y) - Math.cos(c2.x)),
        y: -Math.sinh(c2.y) / (Math.cosh(c2.y) - Math.cos(c2.x))
    };
}

function cTan(vec) {
    let c2 = { x: vec.x * 2, y: vec.y * 2 };
    return {
        x: Math.sin(c2.x) / (Math.cosh(c2.y) + Math.cos(c2.x)),
        y: Math.sinh(c2.y) / (Math.cosh(c2.y) + Math.cos(c2.x))
    };
}

function draw() {
    const { width, height } = canvas;
    const zoom = cameraZoom / 100;

    let imageData = ctx.createImageData(width, height);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let a = (x - cameraOffset.x - width / 2) * zoom;
            let b = (y - cameraOffset.y - height / 2) * zoom;

            let ca = a;
            let cb = b;

            let n = 0;

            while (n < MAX_ITERATIONS) {
                const v = {
                    x: a,
                    y: b,
                }
                let aa, bb;
                switch (func) {
                    case 'ctg':
                        ({ x: aa, y: bb } = cCot(cMul(v, v)));
                        break;
                    case 'tg':
                        ({ x: aa, y: bb } = cTan(cMul(v, v)));
                        break;
                    case 'sin':
                        ({ x: aa, y: bb } = cMul(v, cSin(v)));
                        break;
                    case 'cos':
                        ({ x: aa, y: bb } = cMul(v, cCos(v)));
                        break;
                    case 'mandelbrot':
                    default:
                        ({ x: aa, y: bb } = cMul(v, v));
                        break;
                }
                a = aa;
                b = bb;
                if (func === 'mandelbrot') {
                    a += ca;
                    b += cb;
                }
                if (a * a + b * b > 4) {
                    break;
                }
                n++;
            }

            let pix = (x + y * width) * 4;
            if (n === MAX_ITERATIONS) {
                imageData.data[pix + 0] = 0;
                imageData.data[pix + 1] = 0;
                imageData.data[pix + 2] = 0;
                imageData.data[pix + 3] = 255;
            } else {
                imageData.data[pix + 0] = colors[n][0];
                imageData.data[pix + 1] = colors[n][1];
                imageData.data[pix + 2] = colors[n][2];
                imageData.data[pix + 3] = 255;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// Gets the relevant location from a mouse or single touch event
function getEventLocation(e) {
    if (e.touches && e.touches.length == 1) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    else if (e.clientX && e.clientY) {
        return { x: e.clientX, y: e.clientY }
    }
}

let isDragging = false
let dragStart = { x: 0, y: 0 }

function onPointerDown(e) {
    isDragging = true
    dragStart.x = getEventLocation(e).x - cameraOffset.x
    dragStart.y = getEventLocation(e).y - cameraOffset.y
}

function onPointerUp(e) {
    isDragging = false
    initialPinchDistance = null
    lastZoom = cameraZoom
}

async function onPointerMove(e) {
    if (isDragging) {
        cameraOffset.x = getEventLocation(e).x - dragStart.x
        cameraOffset.y = getEventLocation(e).y - dragStart.y
        draw();
    }

}

async function handleTouch(e, singleTouchHandler) {
    if (e.touches.length == 1) {
        singleTouchHandler(e)
    }
    else if (e.type == "touchmove" && e.touches.length == 2) {
        isDragging = false
        handlePinch(e)
    }
}

let initialPinchDistance = null
let lastZoom = cameraZoom

async function handlePinch(e) {
    e.preventDefault()

    let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY }

    // This is distance squared, but no need for an expensive sqrt as it's only used in ratio
    let currentDistance = (touch1.x - touch2.x) ** 2 + (touch1.y - touch2.y) ** 2

    if (initialPinchDistance == null) {
        initialPinchDistance = currentDistance
    }
    else {
        adjustZoom(null, currentDistance / initialPinchDistance)
    }
}

async function adjustZoom(zoomAmount, zoomFactor) {
    const oldZoom = cameraZoom;
    if (!isDragging) {
        if (zoomAmount) {
            cameraZoom += Math.sign(zoomAmount) * cameraZoom * 0.1;
        }
        else if (zoomFactor) {
            console.log(zoomFactor)
            cameraZoom = zoomFactor * lastZoom
        }

        cameraZoom = Math.min(cameraZoom, MAX_ZOOM)
        cameraOffset.x *= oldZoom / cameraZoom;
        cameraOffset.y *= oldZoom / cameraZoom;
        draw();
    }
}

function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

canvas.addEventListener('mousedown', onPointerDown)
canvas.addEventListener('touchstart', (e) => handleTouch(e, onPointerDown))
canvas.addEventListener('mouseup', onPointerUp)
canvas.addEventListener('touchend', (e) => handleTouch(e, onPointerUp))
canvas.addEventListener('mousemove', onPointerMove)
canvas.addEventListener('touchmove', (e) => handleTouch(e, onPointerMove))
canvas.addEventListener('wheel', (e) => adjustZoom(e.deltaY))
window.addEventListener('resize', resizeCanvas);

document.getElementById('zoomIn').addEventListener('click', () => adjustZoom(-1));
document.getElementById('zoomOut').addEventListener('click', () => adjustZoom(1));
document.getElementById('theme').addEventListener('click', () => {
    if (theme === 'grey') {
        setColoredTheme();
    } else {
        setGreyTheme();
    }
});
document.getElementById('info').addEventListener('click', () => {
    document.getElementById('modal').classList.toggle('visible');
});
document.getElementById('exit').addEventListener('click', () => {
    document.getElementById('modal').classList.remove('visible');
});
document.getElementById("type").addEventListener('input', (event) => {
    func = event.target.value;
    cameraZoom = 0.7;
    cameraOffset = { x: 0, y: 0 };
    draw();
});

draw()