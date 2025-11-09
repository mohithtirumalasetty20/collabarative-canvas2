/* Canvas drawing code: two-layer approach
   - mainCanvas: committed strokes
   - overlayCanvas: live strokes and cursors
*/
(function () {
    const main = document.getElementById('main-canvas');
    const overlay = document.getElementById('overlay-canvas');
    const usersList = document.getElementById('users');

    let mainCtx = main.getContext('2d');
    let overlayCtx = overlay.getContext('2d');

    function resize() {
        const w = window.innerWidth - (window.innerWidth > 700 ? 220 : 0);
        const h = window.innerHeight;
        [main, overlay].forEach((c) => {
            c.width = w * devicePixelRatio;
            c.height = h * devicePixelRatio;
            c.style.width = w + 'px';
            c.style.height = h + 'px';
        });
        mainCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        overlayCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        redrawMain();
    }

    window.addEventListener('resize', resize);

    // state
    const strokes = []; // committed strokes
    const liveStrokes = new Map(); // strokeId -> stroke (in-progress from remote)

    function redrawMain() {
        mainCtx.clearRect(0, 0, main.width, main.height);
        for (const s of strokes) drawStroke(mainCtx, s);
    }

    function drawStroke(ctx, stroke) {
        if (!stroke.points || stroke.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color || '#000';
        ctx.lineWidth = stroke.width || 2;
        if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        ctx.beginPath();
        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        // smooth with quadratic
        for (let i = 1; i < pts.length - 1; i++) {
            const cpx = (pts[i].x + pts[i + 1].x) / 2;
            const cpy = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpx, cpy);
        }
        // last point
        if (pts.length > 1) {
            const last = pts[pts.length - 1];
            ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function renderOverlay() {
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        // draw live remote strokes
        for (const s of liveStrokes.values()) {
            drawStroke(overlayCtx, s);
        }
    }

    // Local stroke rendering APIs (client-side prediction)
    const localStrokes = new Map();
    function startLocalStroke(stroke) {
        // stroke: { id, points:[p], color, width, tool }
        localStrokes.set(stroke.id, stroke);
        // draw immediately on overlay
        renderLocalOverlay();
    }
    function addLocalPoint(strokeId, point) {
        const s = localStrokes.get(strokeId);
        if (!s) return;
        s.points.push(point);
        renderLocalOverlay();
    }
    function endLocalStroke(strokeId) {
        const s = localStrokes.get(strokeId);
        if (!s) return;
        // commit local to main strokes
        strokes.push(s);
        localStrokes.delete(strokeId);
        redrawMain();
        renderLocalOverlay();
    }

    function renderLocalOverlay() {
        // overlay shows both live remote strokes and local-in-progress strokes
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        for (const s of liveStrokes.values()) drawStroke(overlayCtx, s);
        for (const s of localStrokes.values()) drawStroke(overlayCtx, s);
    }

    // APIs exposed to other modules
    window.CanvasApp = {
        init() {
            resize();
        },
        applyState(state) {
            // replace strokes
            strokes.length = 0;
            for (const s of state.strokes || []) strokes.push(s);
            redrawMain();
        },
        handleDrawEvent(msg) {
            const { action, strokeId } = msg;
            if (action === 'begin') {
                const s = { id: strokeId, points: [msg.point], color: msg.color, width: msg.width, tool: msg.tool };
                liveStrokes.set(strokeId, s);
            } else if (action === 'draw') {
                const s = liveStrokes.get(strokeId);
                if (s) {
                    if (Array.isArray(msg.points)) {
                        s.points.push(...msg.points);
                    } else if (msg.point) {
                        s.points.push(msg.point);
                    }
                }
            } else if (action === 'end') {
                const s = liveStrokes.get(strokeId);
                if (s) {
                    // commit to main strokes
                    strokes.push(s);
                    liveStrokes.delete(strokeId);
                    redrawMain();
                }
            }
            renderOverlay();
        },
        handleUndo(payload) {
            // remove stroke by id and redraw main
            const idx = strokes.findIndex((s) => s.id === payload.strokeId);
            if (idx >= 0) strokes.splice(idx, 1);
            redrawMain();
        },
        handleRedo(payload) {
            if (payload.stroke) {
                strokes.push(payload.stroke);
                redrawMain();
            }
        },
        updateUsers(users) {
            usersList.innerHTML = '';
            for (const u of users) {
                const li = document.createElement('li');
                // nicer avatar + name + role placeholder + status dot
                const initials = (u.username || 'U').slice(0, 2).toUpperCase();
                li.innerHTML = `
                    <div class="user-item">
                        <div class="user-left">
                            <div class="avatar" style="background:${u.color}">${initials}</div>
                            <div class="user-meta">
                                <div class="user-name">${u.username}</div>
                                <div class="user-role">Collaborator</div>
                            </div>
                        </div>
                        <div class="status-dot" style="background: #38d39f"></div>
                    </div>`;
                usersList.appendChild(li);
            }
        },
        updateCursor(remote) {
            // remote: {userId, x, y, color, username}
            // create/update DOM element
            let el = document.querySelector(`[data-cursor="${remote.userId}"]`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'cursor';
                el.dataset.cursor = remote.userId;
                document.body.appendChild(el);
            }
            el.style.left = (remote.x + (window.innerWidth > 700 ? 220 : 0)) + 'px';
            el.style.top = remote.y + 'px';
            el.style.color = remote.color;
            el.innerText = remote.username || '';
        }
        ,
        // local stroke APIs for client-side prediction
        startLocalStroke(stroke) {
            startLocalStroke(stroke);
        },
        addLocalPoint(strokeId, point) {
            addLocalPoint(strokeId, point);
        },
        endLocalStroke(strokeId) {
            endLocalStroke(strokeId);
        }
    };
})();
