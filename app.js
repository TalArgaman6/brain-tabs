/* global Matter, decomp */

if (typeof window !== 'undefined' && !window.decomp) {
    window.decomp = decomp;
}

const { Engine, World, Bodies, Body, Common, Runner, Events, Query, Sleeping } = Matter;
Common.setDecomp(window.decomp);

const galleryWall = document.getElementById('galleryWall');
const scene = document.getElementById('scene');
const container = document.getElementById('windowContainer');
const interior = document.getElementById('windowInterior');
const canvas = document.getElementById('worldCanvas');
const bgText = document.getElementById('bgText');
const addBtn = document.getElementById('addBtn');
const removeBtn = document.getElementById('removeBtn');
const countInput = document.getElementById('countInput');
const editTextBtn = document.getElementById('editTextBtn');

const DEFAULT_QUOTE = 'when your brain has too many tabs open';

const engine = Engine.create({
    gravity: { x: 0, y: 1.15 }
});

let width = 0;
let height = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let bodiesList = [];
let ground;
let leftWall;
let rightWall;
let isCountEditing = false;
let isTextEditing = false;
const pointer = { x: 0, y: 0, active: false, vx: 0, vy: 0 };
let latchedBody = null;
let pointerDown = { x: 0, y: 0, body: null };
let quoteTapCount = 0;
let quoteTapTimer = null;
let lastLayoutWidth = 0;
let lastLayoutHeight = 0;

const MAX_TABS = 1500;
const HOVER_STIFFNESS = 0.0014;
const HOVER_DAMPING = 0.9;
const LATCH_STIFFNESS = 0.0032;
const QUOTE_TAP_WINDOW_MS = 500;

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const motionAccess = { granted: false, requested: false };
const tilt = { x: 0, y: 0, targetX: 0, targetY: 0, prevMag: 0 };

const SPRITE_SIZE = 200;
const characterSprite = document.createElement('canvas');
characterSprite.width = SPRITE_SIZE;
characterSprite.height = SPRITE_SIZE;
const spriteCtx = characterSprite.getContext('2d');

const DUNE_PROFILE = [
    { center: 0.24, spread: 0.16, weight: 0.4, peak: 0.58 },
    { center: 0.5, spread: 0.2, weight: 0.18, peak: 0.16 },
    { center: 0.74, spread: 0.15, weight: 0.42, peak: 0.48 }
];

function pathMascot(ctx, radius) {
    const r = radius;
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, -r * 0.58);
    ctx.bezierCurveTo(-r * 0.08, -r * 0.64, r * 0.08, -r * 0.64, r * 0.22, -r * 0.58);
    ctx.bezierCurveTo(r * 0.34, -r * 0.52, r * 0.36, -r * 0.36, r * 0.44, -r * 0.39);
    ctx.lineTo(r * 0.84, -r * 0.56);
    ctx.bezierCurveTo(r * 0.96, -r * 0.53, r * 0.97, -r * 0.4, r * 0.86, -r * 0.34);
    ctx.bezierCurveTo(r * 0.58, -r * 0.08, r * 0.42, r * 0.14, r * 0.7, r * 0.68);
    ctx.bezierCurveTo(r * 0.76, r * 0.78, r * 0.64, r * 0.83, r * 0.54, r * 0.81);
    ctx.bezierCurveTo(r * 0.24, r * 0.46, -r * 0.24, r * 0.46, -r * 0.54, r * 0.81);
    ctx.bezierCurveTo(-r * 0.64, r * 0.83, -r * 0.76, r * 0.78, -r * 0.7, r * 0.68);
    ctx.bezierCurveTo(-r * 0.42, r * 0.14, -r * 0.58, -r * 0.08, -r * 0.86, -r * 0.34);
    ctx.bezierCurveTo(-r * 0.97, -r * 0.4, -r * 0.96, -r * 0.53, -r * 0.84, -r * 0.56);
    ctx.lineTo(-r * 0.44, -r * 0.39);
    ctx.bezierCurveTo(-r * 0.36, -r * 0.36, -r * 0.34, -r * 0.52, -r * 0.22, -r * 0.58);
    ctx.closePath();
}

function drawSparkle(ctx, sx, sy, sw, sh) {
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(sx, sy - sh);
    ctx.quadraticCurveTo(sx, sy, sx + sw, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + sh);
    ctx.quadraticCurveTo(sx, sy, sx - sw, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - sh);
    ctx.closePath();
    ctx.fill();
}

function drawEye(ctx, ex, ey, ew, eh) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.beginPath();
    ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2);
    const eyeGrad = ctx.createRadialGradient(-ew * 0.2, -eh * 0.25, ew * 0.05, 0, 0, ew);
    eyeGrad.addColorStop(0, '#3a3a3a');
    eyeGrad.addColorStop(1, '#111111');
    ctx.fillStyle = eyeGrad;
    ctx.fill();
    drawSparkle(ctx, ew * 0.28, -eh * 0.28, ew * 0.42, eh * 0.42);
    drawSparkle(ctx, -ew * 0.25, eh * 0.28, ew * 0.22, eh * 0.22);
    ctx.restore();
}

function drawEyebrow(ctx, bx, by, isLeft) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(isLeft ? 0.18 : -0.18);
    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -2);
    ctx.lineTo(5, 3);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.restore();
}

function preRenderMascot() {
    const cx = SPRITE_SIZE / 2;
    const cy = SPRITE_SIZE / 2 + SPRITE_SIZE * 0.03;
    const r = SPRITE_SIZE * 0.42;

    spriteCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    spriteCtx.save();
    spriteCtx.translate(cx, cy);

    spriteCtx.save();
    spriteCtx.scale(1, 0.28);
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, r * 0.72, r * 0.62, r * 0.22, 0, 0, Math.PI * 2);
    spriteCtx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    spriteCtx.filter = 'blur(6px)';
    spriteCtx.fill();
    spriteCtx.filter = 'none';
    spriteCtx.restore();

    pathMascot(spriteCtx, r);
    const yellowGrad = spriteCtx.createRadialGradient(-r * 0.28, -r * 0.42, r * 0.08, r * 0.08, r * 0.05, r * 1.05);
    yellowGrad.addColorStop(0, '#ffe48a');
    yellowGrad.addColorStop(0.42, '#f5c842');
    yellowGrad.addColorStop(0.88, '#e0ad2a');
    yellowGrad.addColorStop(1, '#c9921a');
    spriteCtx.fillStyle = yellowGrad;
    spriteCtx.fill();

    spriteCtx.save();
    pathMascot(spriteCtx, r);
    spriteCtx.clip();
    const whiteGrad = spriteCtx.createLinearGradient(-r * 1.2, r * 1.2, r * 1.1, -r * 1.1);
    whiteGrad.addColorStop(0, '#efefef');
    whiteGrad.addColorStop(0.38, '#ffffff');
    whiteGrad.addColorStop(0.72, '#f6f6f6');
    whiteGrad.addColorStop(1, '#dcdcdc');
    spriteCtx.fillStyle = whiteGrad;
    spriteCtx.beginPath();
    spriteCtx.moveTo(-r * 1.6, r * 1.6);
    spriteCtx.lineTo(-r * 0.55, r * 0.38);
    spriteCtx.bezierCurveTo(-r * 0.28, r * 0.08, r * 0.28, -r * 0.08, r * 0.82, -r * 0.34);
    spriteCtx.lineTo(r * 1.6, -r * 1.6);
    spriteCtx.lineTo(r * 1.6, r * 1.6);
    spriteCtx.closePath();
    spriteCtx.fill();
    spriteCtx.restore();

    spriteCtx.save();
    pathMascot(spriteCtx, r);
    spriteCtx.clip();
    const gloss = spriteCtx.createLinearGradient(-r * 0.5, -r * 0.8, r * 0.3, r * 0.2);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    gloss.addColorStop(0.55, 'rgba(255, 255, 255, 0.08)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    spriteCtx.fillStyle = gloss;
    spriteCtx.fillRect(-r, -r, r * 2, r * 2);
    spriteCtx.restore();

    pathMascot(spriteCtx, r);
    spriteCtx.lineWidth = 2.2;
    spriteCtx.strokeStyle = 'rgba(35, 28, 18, 0.55)';
    spriteCtx.lineJoin = 'round';
    spriteCtx.lineCap = 'round';
    spriteCtx.stroke();

    pathMascot(spriteCtx, r);
    spriteCtx.lineWidth = 1;
    spriteCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    spriteCtx.stroke();

    const fy = -r * 0.22;
    const eyeW = r * 0.09;
    const eyeH = r * 0.14;
    const eyeGap = r * 0.16;

    drawEye(spriteCtx, -eyeGap, fy, eyeW, eyeH);
    drawEye(spriteCtx, eyeGap, fy, eyeW, eyeH);
    drawEyebrow(spriteCtx, -eyeGap, fy - eyeH * 1.2, true);
    drawEyebrow(spriteCtx, eyeGap, fy - eyeH * 1.2, false);

    spriteCtx.beginPath();
    spriteCtx.arc(0, fy + r * 0.06, r * 0.048, 0.15, Math.PI - 0.15);
    spriteCtx.lineWidth = 2;
    spriteCtx.strokeStyle = 'rgba(30, 24, 16, 0.7)';
    spriteCtx.stroke();

    spriteCtx.restore();
}

function createMascotVertices(scale) {
    const r = scale * 0.42;
    return [
        { x: -r * 0.22, y: -r * 0.58 },
        { x: r * 0.22, y: -r * 0.58 },
        { x: r * 0.44, y: -r * 0.39 },
        { x: r * 0.84, y: -r * 0.56 },
        { x: r * 0.86, y: -r * 0.34 },
        { x: r * 0.42, y: r * 0.14 },
        { x: r * 0.7, y: r * 0.68 },
        { x: r * 0.54, y: r * 0.81 },
        { x: 0, y: r * 0.44 },
        { x: -r * 0.54, y: r * 0.81 },
        { x: -r * 0.7, y: r * 0.68 },
        { x: -r * 0.42, y: r * 0.14 },
        { x: -r * 0.86, y: -r * 0.34 },
        { x: -r * 0.84, y: -r * 0.56 },
        { x: -r * 0.44, y: -r * 0.39 }
    ];
}

function mascotRadius() {
    return Math.max(15, Math.min(width * 0.05, 30));
}

function pickDuneSection() {
    const total = DUNE_PROFILE.reduce((sum, d) => sum + d.weight, 0);
    let roll = Math.random() * total;
    for (const section of DUNE_PROFILE) {
        roll -= section.weight;
        if (roll <= 0) return section;
    }
    return DUNE_PROFILE[0];
}

function spawnMascot(x, y, radius, angle = Math.random() * Math.PI * 2, syncCount = true) {
    const vertices = createMascotVertices(radius);
    const body = Bodies.fromVertices(x, y, [vertices], {
        restitution: 0.04,
        friction: 0.32,
        frictionAir: 0.012,
        density: 0.0018,
        chamfer: { radius: 2 }
    }, true);

    if (!body) return null;

    Body.setAngle(body, angle);
    body.customRadius = radius;
    World.add(engine.world, body);
    bodiesList.push(body);
    if (syncCount) updateBadge();
    return body;
}

function spawnDuneMascot() {
    const radius = mascotRadius();
    const section = pickDuneSection();
    const x = (section.center * width) + (Math.random() - 0.5) * width * section.spread * 2;
    const floorY = height - radius * 0.9;
    const moundHeight = height * section.peak;
    const y = floorY - Math.random() * moundHeight - Math.random() * height * 0.35;

    return spawnMascot(
        Math.max(radius, Math.min(width - radius, x)),
        y,
        radius,
        Math.random() * Math.PI * 2
    );
}

function spawnFromTop(syncCount = true) {
    const radius = mascotRadius();
    const x = radius + Math.random() * (width - radius * 2);
    return spawnMascot(x, -radius - Math.random() * 80, radius, Math.random() * Math.PI * 2, syncCount);
}

function removeMascot(syncCount = true) {
    if (!bodiesList.length) return;
    const body = bodiesList.pop();
    World.remove(engine.world, body);
    if (latchedBody === body) releaseLatchedBody();
    if (syncCount) updateBadge();
}

function setTabCount(target) {
    const clamped = Math.max(0, Math.min(MAX_TABS, Math.round(Number(target) || 0)));

    while (bodiesList.length < clamped) {
        spawnFromTop(false);
    }
    while (bodiesList.length > clamped) {
        removeMascot(false);
    }

    updateBadge();
    return clamped;
}

function updateBadge() {
    if (!isCountEditing) {
        countInput.value = String(bodiesList.length);
    }
}

function releaseLatchedBody() {
    if (!latchedBody) return;

    Body.setVelocity(latchedBody, {
        x: latchedBody.velocity.x + pointer.vx * 0.35,
        y: latchedBody.velocity.y + pointer.vy * 0.35
    });
    latchedBody = null;
}

function resetQuoteToDefault() {
    bgText.textContent = DEFAULT_QUOTE;
}

function finalizeQuoteEdit() {
    const text = bgText.textContent.trim();
    bgText.textContent = text || DEFAULT_QUOTE;
}

function startTextEdit() {
    isTextEditing = true;
    interior.classList.add('is-editing-text');
    bgText.classList.add('is-editing');
    bgText.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(bgText);
    selection.removeAllRanges();
    selection.addRange(range);
}

function stopTextEdit() {
    isTextEditing = false;
    interior.classList.remove('is-editing-text');
    bgText.classList.remove('is-editing');
    bgText.classList.remove('is-primed');
    resetQuoteTap();
    finalizeQuoteEdit();
    bgText.blur();
}

function resetQuoteTap() {
    quoteTapCount = 0;
    clearTimeout(quoteTapTimer);
    quoteTapTimer = null;
    bgText.classList.remove('is-primed');
}

function handleQuoteTap() {
    quoteTapCount += 1;
    clearTimeout(quoteTapTimer);

    if (quoteTapCount >= 2) {
        resetQuoteTap();
        startTextEdit();
        return;
    }

    bgText.classList.add('is-primed');
    quoteTapTimer = setTimeout(resetQuoteTap, QUOTE_TAP_WINDOW_MS);
}

function isPointOnQuoteText(x, y) {
    const textRect = bgText.getBoundingClientRect();
    const interiorRect = interior.getBoundingClientRect();
    const pad = 10;

    const left = textRect.left - interiorRect.left - pad;
    const top = textRect.top - interiorRect.top - pad;
    const right = left + textRect.width + pad * 2;
    const bottom = top + textRect.height + pad * 2;

    return x >= left && x <= right && y >= top && y <= bottom;
}

function setupMouse() {
    // Interaction uses explicit tap-to-latch only; no MouseConstraint needed.
}

function findBodyAtPoint(point) {
    const hits = Query.point(bodiesList, point);
    return hits.length ? hits[0] : null;
}

function findHoverBody() {
    const directHit = findBodyAtPoint(pointer);
    if (directHit) return directHit;

    const reach = mascotRadius() * 1.2;
    const region = {
        min: { x: pointer.x - reach, y: pointer.y - reach },
        max: { x: pointer.x + reach, y: pointer.y + reach }
    };
    const nearby = Query.region(bodiesList, region);
    if (!nearby.length) return null;

    let closest = null;
    let closestDist = reach * reach;

    for (let i = 0; i < nearby.length; i += 1) {
        const body = nearby[i];
        const dx = pointer.x - body.position.x;
        const dy = pointer.y - body.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < closestDist) {
            closestDist = distSq;
            closest = body;
        }
    }

    return closest;
}

function applyHoverForces() {
    if (!pointer.active || latchedBody) return;

    const hoverBody = findHoverBody();
    if (!hoverBody) return;

    Sleeping.set(hoverBody, false);

    const dx = pointer.x - hoverBody.position.x;
    const dy = pointer.y - hoverBody.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const falloff = Math.min(1, mascotRadius() * 1.1 / dist);

    Body.applyForce(hoverBody, hoverBody.position, {
        x: dx * HOVER_STIFFNESS * falloff,
        y: dy * HOVER_STIFFNESS * falloff
    });

    Body.setVelocity(hoverBody, {
        x: hoverBody.velocity.x * HOVER_DAMPING + pointer.vx * 0.06 * falloff,
        y: hoverBody.velocity.y * HOVER_DAMPING + pointer.vy * 0.06 * falloff
    });
    Body.setAngularVelocity(hoverBody, hoverBody.angularVelocity * 0.94);
}

function applyLatchForces() {
    if (!latchedBody) return;

    Sleeping.set(latchedBody, false);

    const dx = pointer.x - latchedBody.position.x;
    const dy = pointer.y - latchedBody.position.y;

    Body.applyForce(latchedBody, latchedBody.position, {
        x: dx * LATCH_STIFFNESS,
        y: dy * LATCH_STIFFNESS
    });

    Body.setVelocity(latchedBody, {
        x: latchedBody.velocity.x * 0.82 + pointer.vx * 0.22,
        y: latchedBody.velocity.y * 0.82 + pointer.vy * 0.22
    });
    Body.setAngularVelocity(latchedBody, latchedBody.angularVelocity * 0.9);
}

function setupLatchInteraction() {
    if (setupLatchInteraction.ready) return;
    setupLatchInteraction.ready = true;
    Events.on(engine, 'beforeUpdate', () => {
        applyTiltGravity();
        applyHoverForces();
        if (latchedBody) applyLatchForces();
    });
}
setupLatchInteraction.ready = false;

async function enableDeviceMotion() {
    if (motionAccess.granted) return true;
    if (motionAccess.requested) return motionAccess.granted;
    motionAccess.requested = true;

    let granted = false;

    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            granted = (await DeviceMotionEvent.requestPermission()) === 'granted';
        } catch {
            granted = false;
        }
    }

    if (!granted && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            granted = (await DeviceOrientationEvent.requestPermission()) === 'granted';
        } catch {
            granted = false;
        }
    }

    if (!granted && typeof DeviceOrientationEvent?.requestPermission !== 'function') {
        granted = true;
    }

    motionAccess.granted = granted;
    return motionAccess.granted;
}

function setTiltFromOrientation(beta, gamma) {
    const normX = Math.min(Math.max(gamma, -42), 42) / 42;
    const normY = Math.min(Math.max(beta - 45, -42), 42) / 42;
    tilt.targetX = normX;
    tilt.targetY = normY;

    if (isTouchDevice) {
        targetX = normX * 6;
        targetY = -normY * 5;
    } else {
        targetX = normX * 16;
        targetY = -normY * 12;
    }
}

function setTiltFromAcceleration(ax, ay) {
    if (ax == null || ay == null) return;
    const normX = Math.min(Math.max(ax / 9.2, -1), 1);
    const normY = Math.min(Math.max(ay / 9.2, -1), 1);
    tilt.targetX = normX;
    tilt.targetY = -normY;
}

function applyTiltGravity() {
    const lerp = isTouchDevice ? 0.16 : 0.1;
    tilt.x += (tilt.targetX - tilt.x) * lerp;
    tilt.y += (tilt.targetY - tilt.y) * lerp;

    const gxStrength = isTouchDevice ? 3.2 : 1.2;
    const gyBase = isTouchDevice ? 0.95 : 1.15;

    engine.gravity.x = tilt.x * gxStrength;
    engine.gravity.y = Math.max(0.2, gyBase - Math.abs(tilt.x) * 0.3 + tilt.y * 1.05);

    const tiltMag = Math.abs(tilt.x) + Math.abs(tilt.y);
    if (isTouchDevice && tiltMag > 0.1) {
        for (let i = 0; i < bodiesList.length; i += 1) {
            Sleeping.set(bodiesList[i], false);
        }
    }
    tilt.prevMag = tiltMag;
}

function bindMotionListeners() {
    window.addEventListener('deviceorientation', (e) => {
        if (!motionAccess.granted && typeof DeviceOrientationEvent?.requestPermission === 'function') return;
        if (e.beta == null || e.gamma == null) return;
        setTiltFromOrientation(e.beta, e.gamma);
    }, true);

    window.addEventListener('deviceorientationabsolute', (e) => {
        if (!motionAccess.granted && typeof DeviceOrientationEvent?.requestPermission === 'function') return;
        if (e.beta == null || e.gamma == null) return;
        setTiltFromOrientation(e.beta, e.gamma);
    }, true);

    window.addEventListener('devicemotion', (e) => {
        if (!motionAccess.granted && typeof DeviceMotionEvent?.requestPermission === 'function') return;
        const g = e.accelerationIncludingGravity;
        if (!g || g.x == null) return;
        setTiltFromAcceleration(g.x, g.y);
    }, true);
}

function initMotion() {
    if (!isTouchDevice || typeof DeviceOrientationEvent?.requestPermission !== 'function') {
        motionAccess.granted = true;
    }
    bindMotionListeners();
}

function updatePointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const nextX = e.clientX - rect.left;
    const nextY = e.clientY - rect.top;
    pointer.vx = nextX - pointer.x;
    pointer.vy = nextY - pointer.y;
    pointer.x = nextX;
    pointer.y = nextY;
    pointer.active = true;
}

function createWalls() {
    const wallThickness = 120;

    if (ground) {
        World.remove(engine.world, [ground, leftWall, rightWall]);
    }

    ground = Bodies.rectangle(width / 2, height + wallThickness / 2 - 4, width * 2, wallThickness, {
        isStatic: true,
        friction: 0.9
    });
    leftWall = Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true });
    rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true });

    World.add(engine.world, [ground, leftWall, rightWall]);
}

function clearAllMascots() {
    latchedBody = null;
    for (let i = bodiesList.length - 1; i >= 0; i -= 1) {
        World.remove(engine.world, bodiesList[i]);
    }
    bodiesList = [];
}

function settleWorld(steps = 40) {
    for (let i = 0; i < steps; i += 1) {
        Engine.update(engine, 1000 / 60);
    }
}

function seedMascots(count) {
    for (let i = 0; i < count; i += 1) {
        spawnDuneMascot(false);
    }
    settleWorld();
    updateBadge();
}

function getDefaultMascotCount() {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    return isMobile ? 120 : width < 900 ? 140 : 185;
}

function reflowMascotsPreservingCount() {
    const savedCount = bodiesList.length;
    clearAllMascots();
    createWalls();
    seedMascots(savedCount);
}

function handleViewportChange() {
    updateCanvasSize();

    const widthChanged = Math.abs(width - lastLayoutWidth) > 1;
    const heightChanged = Math.abs(height - lastLayoutHeight) > 1;

    if (!widthChanged && !heightChanged) return;

    if (lastLayoutWidth > 0 && lastLayoutHeight > 0 && bodiesList.length > 0) {
        reflowMascotsPreservingCount();
    } else if (ground) {
        createWalls();
    }

    lastLayoutWidth = width;
    lastLayoutHeight = height;
}

function initPhysics() {
    World.clear(engine.world);
    engine.world.gravity = { x: 0, y: 1.15 };
    bodiesList = [];
    ground = null;
    leftWall = null;
    rightWall = null;
    latchedBody = null;

    createWalls();
    seedMascots(getDefaultMascotCount());

    setupMouse();
    setupLatchInteraction();
}

function updateCanvasSize() {
    const rect = interior.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
}

const renderCtx = canvas.getContext('2d');

function draw() {
    renderCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderCtx.clearRect(0, 0, width, height);

    for (let i = 0; i < bodiesList.length; i += 1) {
        const body = bodiesList[i];
        const { x, y } = body.position;
        const r = body.customRadius;
        const angle = body.angle;

        renderCtx.save();
        renderCtx.translate(x, y + r * 0.08);
        renderCtx.rotate(angle);
        renderCtx.scale(1, 0.22);
        renderCtx.beginPath();
        renderCtx.ellipse(0, 0, r * 0.72, r * 0.28, 0, 0, Math.PI * 2);
        renderCtx.fillStyle = 'rgba(0, 0, 0, 0.09)';
        renderCtx.fill();
        renderCtx.restore();

        renderCtx.save();
        renderCtx.translate(x, y);
        renderCtx.rotate(angle);
        renderCtx.drawImage(characterSprite, -r, -r, r * 2, r * 2);
        renderCtx.restore();
    }

    requestAnimationFrame(draw);
}

let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateParallax() {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;

    if (!prefersReducedMotion && !isMobile) {
        currentX += (targetX - currentX) * 0.07;
        currentY += (targetY - currentY) * 0.07;
        galleryWall.style.transform = `rotateY(${currentX}deg) rotateX(${currentY}deg)`;
        bgText.style.transform = `translate(calc(-50% + ${-currentX * 1.1}px), calc(-50% + ${currentY * 1.1}px)) translateZ(8px)`;
    }
    requestAnimationFrame(animateParallax);
}

window.addEventListener('mousemove', (e) => {
    const normX = (e.clientX / window.innerWidth) - 0.5;
    const normY = (e.clientY / window.innerHeight) - 0.5;
    targetX = normX * 14;
    targetY = -normY * 10;
});

scene.addEventListener('pointerdown', () => {
    if (isTouchDevice) enableDeviceMotion();
}, { passive: true });

initMotion();

canvas.addEventListener('pointermove', (e) => {
    if (isTextEditing) return;
    updatePointerFromEvent(e);
    if (latchedBody) {
        canvas.style.cursor = 'grabbing';
        return;
    }
    if (isPointOnQuoteText(pointer.x, pointer.y)) {
        canvas.style.cursor = 'text';
        return;
    }
    canvas.style.cursor = findHoverBody() ? 'grab' : 'default';
});

canvas.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
    if (latchedBody) releaseLatchedBody();
    canvas.style.cursor = 'default';
});

canvas.addEventListener('pointerdown', (e) => {
    if (isTextEditing) return;

    const rect = canvas.getBoundingClientRect();
    pointerDown.x = e.clientX - rect.left;
    pointerDown.y = e.clientY - rect.top;
    pointerDown.body = findBodyAtPoint({ x: pointerDown.x, y: pointerDown.y });
    updatePointerFromEvent(e);
});

canvas.addEventListener('pointerup', (e) => {
    if (isTextEditing) return;
    if (e.target.closest('.controls-container')) return;

    const rect = canvas.getBoundingClientRect();
    const upX = e.clientX - rect.left;
    const upY = e.clientY - rect.top;
    updatePointerFromEvent(e);

    if (latchedBody) {
        releaseLatchedBody();
        canvas.style.cursor = findHoverBody() ? 'grab' : 'default';
        pointerDown.body = null;
        return;
    }

    if (pointerDown.body) {
        resetQuoteTap();
        latchedBody = pointerDown.body;
        canvas.style.cursor = 'grabbing';
        pointerDown.body = null;
        return;
    }

    if (isPointOnQuoteText(upX, upY)) {
        handleQuoteTap();
        pointerDown.body = null;
        return;
    }

    resetQuoteTap();
    spawnMascot(upX, upY, mascotRadius());
    pointerDown.body = null;
});

addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    spawnFromTop();
});

removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeMascot();
});

countInput.addEventListener('focus', () => {
    isCountEditing = true;
    countInput.select();
});

countInput.addEventListener('blur', () => {
    isCountEditing = false;
    setTabCount(countInput.value);
});

countInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
        e.preventDefault();
        countInput.blur();
    }
});

countInput.addEventListener('change', () => {
    setTabCount(countInput.value);
});

editTextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isTextEditing) {
        stopTextEdit();
    } else {
        startTextEdit();
    }
});

bgText.addEventListener('blur', () => {
    if (isTextEditing) stopTextEdit();
});

bgText.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        stopTextEdit();
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        bgText.textContent = DEFAULT_QUOTE;
        stopTextEdit();
    }
});

let resizeTimer;
window.addEventListener('resize', scheduleViewportReflow);
window.addEventListener('orientationchange', scheduleViewportReflow);

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleViewportReflow);
}

const layoutObserver = new ResizeObserver(scheduleViewportReflow);
layoutObserver.observe(interior);

function scheduleViewportReflow() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleViewportChange, 150);
}

preRenderMascot();
resetQuoteToDefault();
updateCanvasSize();
lastLayoutWidth = width;
lastLayoutHeight = height;
initPhysics();

const runner = Runner.create();
Runner.run(runner, engine);
requestAnimationFrame(draw);
requestAnimationFrame(animateParallax);
