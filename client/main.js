// main app initialization: UI bindings, input capture, and socket events
(function () {
    const ROOM = new URLSearchParams(location.search).get('room') || 'default';

    // simple random identity
    const user = {
        id: 'u_' + Math.random().toString(36).slice(2, 9),
        username: 'User' + Math.floor(Math.random() * 900 + 100),
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    };

    const socket = WS.connect(ROOM, user);

    CanvasApp.init();

    // UI elements
    const colorInput = document.getElementById('color');
    const widthInput = document.getElementById('width');
    const toolSelect = document.getElementById('tool');
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    colorInput.value = user.color;

    // input capture with rAF batching
    const overlay = document.getElementById('overlay-canvas');
    let drawing = false;
    let currentStrokeId = null;
    let localBuffer = [];
    let scheduledSend = false;
    let scheduledCursor = false;

    function getPos(e) {
        const rect = overlay.getBoundingClientRect();
        if (e.touches && e.touches[0]) e = e.touches[0];
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function sendBufferedPoints() {
        if (localBuffer.length === 0) return;
        // send all buffered points in a single draw message
        socket.emit('draw', {
            room: ROOM,
            action: 'draw',
            strokeId: currentStrokeId,
            points: localBuffer.slice(), // send copy of points array
            color: colorInput.value,
            width: parseInt(widthInput.value, 10),
            userId: user.id,
            username: user.username,
            tool: toolSelect.value,
        });
        localBuffer.length = 0;
        scheduledSend = false;
    }

    function sendCursor(p) {
        socket.emit('cursor', { room: ROOM, userId: user.id, x: p.x, y: p.y, color: user.color, username: user.username });
        scheduledCursor = false;
    }

    overlay.addEventListener('pointerdown', (ev) => {
        overlay.setPointerCapture(ev.pointerId);
        drawing = true;
        currentStrokeId = 's_' + Math.random().toString(36).slice(2, 9);
        const p = getPos(ev);

        // local immediate render
        const localStroke = { id: currentStrokeId, points: [p], color: colorInput.value, width: parseInt(widthInput.value, 10), tool: toolSelect.value };
        CanvasApp.startLocalStroke(localStroke);

        // inform server of stroke begin
        socket.emit('draw', {
            room: ROOM,
            action: 'begin',
            strokeId: currentStrokeId,
            point: p,
            color: colorInput.value,
            width: parseInt(widthInput.value, 10),
            userId: user.id,
            username: user.username,
            tool: toolSelect.value,
        });
    });

    overlay.addEventListener('pointermove', (ev) => {
        const p = getPos(ev);
        // throttle cursor using rAF
        if (!scheduledCursor) {
            scheduledCursor = true;
            requestAnimationFrame(() => sendCursor(p));
        }

        if (!drawing) return;

        // add to local buffer and render locally immediately
        localBuffer.push(p);
        CanvasApp.addLocalPoint(currentStrokeId, p);

        if (!scheduledSend) {
            scheduledSend = true;
            requestAnimationFrame(sendBufferedPoints);
        }
    });

    overlay.addEventListener('pointerup', (ev) => {
        if (!drawing) return;
        drawing = false;
        const p = getPos(ev);

        // flush buffered points immediately
        localBuffer.push(p);
        sendBufferedPoints();

        // local commit
        CanvasApp.endLocalStroke(currentStrokeId);

        // inform server
        socket.emit('draw', {
            room: ROOM,
            action: 'end',
            strokeId: currentStrokeId,
            point: p,
            color: colorInput.value,
            width: parseInt(widthInput.value, 10),
            userId: user.id,
            username: user.username,
            tool: toolSelect.value,
        });

        currentStrokeId = null;
    });

    // touch fallback
    overlay.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    // socket events
    socket.on('init-state', (state) => CanvasApp.applyState(state));

    // remote draw events (from other users)
    socket.on('draw', (msg) => CanvasApp.handleDrawEvent(msg));
    socket.on('cursor', (msg) => CanvasApp.updateCursor(msg));
    socket.on('users', (users) => CanvasApp.updateUsers(users));
    socket.on('user-join', (u) => console.log('joined', u));
    socket.on('user-leave', (u) => console.log('left', u));
    socket.on('undo', (payload) => CanvasApp.handleUndo(payload));
    socket.on('redo', (payload) => CanvasApp.handleRedo(payload));

    undoBtn.addEventListener('click', () => socket.emit('undo', { room: ROOM }));
    redoBtn.addEventListener('click', () => socket.emit('redo', { room: ROOM }));

    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const app = document.getElementById('app');

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    app.className = savedTheme === 'dark' ? 'theme-dark' : '';

    themeToggle.addEventListener('click', () => {
        const isDark = app.classList.toggle('theme-dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Update width preview on range input
    const widthPreview = document.querySelector('.width-preview');

    const widthValue = document.getElementById('width-value');
    function updateWidthPreview() {
        const scale = widthInput.value / 40; // normalize to 0-1
        widthPreview.style.setProperty('--preview-scale', scale);
        // ensure preview color matches selected brush color
        if (colorInput && widthPreview) widthPreview.style.setProperty('--preview-color', colorInput.value);
        // update numeric label with animation
        if (widthValue) {
            widthValue.classList.add('animating');
            setTimeout(() => {
                widthValue.textContent = `${widthInput.value} px`;
                widthValue.classList.remove('animating');
            }, 180);
        }
    }

    widthInput.addEventListener('input', updateWidthPreview);
    updateWidthPreview();

    // update preview color when color picker changes
    colorInput.addEventListener('input', () => {
        if (widthPreview) widthPreview.style.setProperty('--preview-color', colorInput.value);
    });

    // Tool buttons
    const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tool').value = btn.dataset.tool;
        });
    });

    // Update online count
    function updateOnlineCount(users) {
        const count = document.querySelector('.online-count');
        if (count) count.textContent = users.length;
    }

    const originalUpdateUsers = CanvasApp.updateUsers;
    CanvasApp.updateUsers = (users) => {
        originalUpdateUsers(users);
        updateOnlineCount(users);
    };

})();
