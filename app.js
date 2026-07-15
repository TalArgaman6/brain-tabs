/* global Matter, decomp */

if (typeof window !== 'undefined' && !window.decomp) {
    window.decomp = decomp;
}

const { Engine, World, Bodies, Body, Common, Mouse, MouseConstraint, Runner, Events, Query, Sleeping } = Matter;
Common.setDecomp(window.decomp);

const galleryWall = document.getElementById('galleryWall');
const container = document.getElementById('windowContainer');
const interior = document.querySelector('.window-interior');
const canvas = document.getElementById('worldCanvas');
const bgText = document.getElementById('bgText');
const addBtn = document.getElementById('addBtn');
const removeBtn = document.getElementById('removeBtn');
const countInput = document.getElementById('countInput');

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
let mouseConstraint;
let touchStartTime = 0;
let touchMoved = false;
let isCountEditing = false;
const pointer = { x: 0, y: 0, active: false, pressed: false, vx: 0, vy: 0 };
let hoverBody = null;

const MAX_TABS = 500;
const HOVER_STIFFNESS = 0.0018;
const HOVER_DAMPING = 0.88;

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
    ctx.fillStyle = '#1a1a1a';
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
    const cy = SPRITE_SIZE / 2;
    const r = SPRITE_SIZE * 0.42;

    spriteCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    spriteCtx.save();
    spriteCtx.translate(cx, cy);

    pathMascot(spriteCtx, r);
    spriteCtx.fillStyle = '#f5c842';
    spriteCtx.fill();

    spriteCtx.save();
    pathMascot(spriteCtx, r);
    spriteCtx.clip();
    spriteCtx.fillStyle = '#ffffff';
    spriteCtx.beginPath();
    spriteCtx.moveTo(-r * 1.6, r * 1.6);
    spriteCtx.lineTo(-r * 0.55, r * 0.38);
    spriteCtx.bezierCurveTo(-r * 0.28, r * 0.08, r * 0.28, -r * 0.08, r * 0.82, -r * 0.34);
    spriteCtx.lineTo(r * 1.6, -r * 1.6);
    spriteCtx.lineTo(r * 1.6, r * 1.6);
    spriteCtx.closePath();
    spriteCtx.fill();
    spriteCtx.restore();

    pathMascot(spriteCtx, r);
    spriteCtx.lineWidth = 4;
    spriteCtx.strokeStyle = '#1a1a1a';
    spriteCtx.lineJoin = 'round';
    spriteCtx.lineCap = 'round';
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
    spriteCtx.lineWidth = 2.4;
    spriteCtx.strokeStyle = '#1a1a1a';
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
    return Math.max(18, Math.min(width * 0.058, 34));
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
    if (hoverBody === body) hoverBody = null;
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

function setupMouse() {
    if (mouseConstraint) {
        World.remove(engine.world, mouseConstraint);
        mouseConstraint = null;
    }

    const mouse = Mouse.create(canvas, { element: canvas });
    mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
            stiffness: 0.14,
            damping: 0.08,
            render: { visible: false }
        }
    });

    mouseConstraint.mouse.element.removeEventListener('mousewheel', mouseConstraint.mouse.mousewheel);
    mouseConstraint.mouse.element.removeEventListener('DOMMouseScroll', mouseConstraint.mouse.mousewheel);

    World.add(engine.world, mouseConstraint);

    Events.on(mouseConstraint, 'startdrag', () => { touchMoved = true; });
    Events.on(mouseConstraint, 'enddrag', () => {
        setTimeout(() => { touchMoved = false; }, 80);
    });
}

function findHoverBody() {
    const directHits = Query.point(bodiesList, pointer);
    if (directHits.length) return directHits[0];

    const reach = mascotRadius() * 1.35;
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
    if (!pointer.active || pointer.pressed || mouseConstraint?.body) {
        hoverBody = null;
        return;
    }

    hoverBody = findHoverBody();
    if (!hoverBody) return;

    Sleeping.set(hoverBody, false);

    const dx = pointer.x - hoverBody.position.x;
    const dy = pointer.y - hoverBody.position.y;

    Body.applyForce(hoverBody, hoverBody.position, {
        x: dx * HOVER_STIFFNESS,
        y: dy * HOVER_STIFFNESS
    });

    Body.setVelocity(hoverBody, {
        x: hoverBody.velocity.x * HOVER_DAMPING + pointer.vx * 0.08,
        y: hoverBody.velocity.y * HOVER_DAMPING + pointer.vy * 0.08
    });
    Body.setAngularVelocity(hoverBody, hoverBody.angularVelocity * 0.92);
}

function setupHoverInteraction() {
    if (setupHoverInteraction.ready) return;
    setupHoverInteraction.ready = true;
    Events.on(engine, 'beforeUpdate', applyHoverForces);
}
setupHoverInteraction.ready = false;

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

function initPhysics() {
    World.clear(engine.world);
    engine.world.gravity = { x: 0, y: 1.15 };
    bodiesList = [];

    const wallThickness = 120;
    ground = Bodies.rectangle(width / 2, height + wallThickness / 2 - 4, width * 2, wallThickness, {
        isStatic: true,
        friction: 0.9
    });
    leftWall = Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true });
    rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true });

    World.add(engine.world, [ground, leftWall, rightWall]);

    const initialCount = width < 600 ? 95 : width < 900 ? 140 : 185;
    for (let i = 0; i < initialCount; i += 1) {
        spawnDuneMascot();
    }

    for (let i = 0; i < 40; i += 1) {
        Engine.update(engine, 1000 / 60);
    }

    setupMouse();
    setupHoverInteraction();
    updateBadge();
}

function updateCanvasSize() {
    const rect = interior.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (ground) {
        const wallThickness = 120;
        Body.setPosition(ground, { x: width / 2, y: height + wallThickness / 2 - 4 });
        Body.setPosition(leftWall, { x: -wallThickness / 2, y: height / 2 });
        Body.setPosition(rightWall, { x: width + wallThickness / 2, y: height / 2 });
    }

    if (mouseConstraint) {
        setupMouse();
    }
}

const renderCtx = canvas.getContext('2d');

function draw() {
    renderCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderCtx.clearRect(0, 0, width, height);

    for (let i = 0; i < bodiesList.length; i += 1) {
        const body = bodiesList[i];
        const { x, y } = body.position;
        const r = body.customRadius;

        renderCtx.save();
        renderCtx.translate(x, y);
        renderCtx.rotate(body.angle);
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
    if (!prefersReducedMotion) {
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

window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    const normX = Math.min(Math.max(e.gamma, -28), 28) / 28;
    const normY = Math.min(Math.max(e.beta - 48, -28), 28) / 28;
    targetX = normX * 16;
    targetY = -normY * 12;
    engine.gravity.x = normX * 1.2;
    engine.gravity.y = Math.max(0.55, 1.15 - Math.abs(normX) * 0.25 + normY * 0.25);
}, true);

canvas.addEventListener('pointermove', (e) => {
    updatePointerFromEvent(e);
    canvas.style.cursor = (!pointer.pressed && findHoverBody()) ? 'grab' : 'default';
});

canvas.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
    hoverBody = null;
    canvas.style.cursor = 'default';
});

canvas.addEventListener('pointerdown', (e) => {
    pointer.pressed = true;
    touchStartTime = performance.now();
    touchMoved = false;
    updatePointerFromEvent(e);
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('pointerup', (e) => {
    pointer.pressed = false;
    canvas.style.cursor = findHoverBody() ? 'grab' : 'default';

    if (e.target.closest('.controls-container')) return;
    const elapsed = performance.now() - touchStartTime;
    if (touchMoved || elapsed > 280) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnMascot(x, y, mascotRadius());
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

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        updateCanvasSize();
    }, 120);
});

preRenderMascot();
updateCanvasSize();
initPhysics();

const runner = Runner.create();
Runner.run(runner, engine);
requestAnimationFrame(draw);
requestAnimationFrame(animateParallax);
