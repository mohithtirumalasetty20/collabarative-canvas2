const { v4: uuidv4 } = require('uuid');

// simple in-memory per-room drawing state
const rooms = new Map();

function ensure(room) {
    if (!rooms.has(room)) {
        rooms.set(room, { strokes: [], undoStack: [], redoStack: [] });
    }
    return rooms.get(room);
}

function getState(room) {
    const r = ensure(room);
    // return strokes and undo/redo metadata so new clients can sync
    return { strokes: r.strokes, undoStack: r.undoStack.slice(), redoStackSize: r.redoStack.length };
}

function handleDraw(room, msg) {
    // msg: { action: 'begin'|'draw'|'end', strokeId, point|points[], color, width, userId, username }
    const r = ensure(room);
    const { action, strokeId, point, points, color, width, userId, username } = msg;
    if (action === 'begin') {
        const id = strokeId || uuidv4();
        const stroke = { id, userId, username, color, width, points: [point], committed: false };
        r.strokes.push(stroke);
        // clear redo on new action
        r.redoStack = [];
        return stroke;
    } else if (action === 'draw') {
        const stroke = r.strokes.find((s) => s.id === strokeId);
        if (stroke) {
            // handle both single point and batch points array
            if (Array.isArray(points)) {
                stroke.points.push(...points);
            } else if (point) {
                stroke.points.push(point);
            }
        }
        return stroke;
    } else if (action === 'end') {
        const stroke = r.strokes.find((s) => s.id === strokeId);
        if (stroke) {
            stroke.committed = true;
            // push to undoStack (global operation log)
            r.undoStack.push(stroke.id);
        }
        return stroke;
    }
    return null;
}

function undo(room) {
    const r = ensure(room);
    if (r.undoStack.length === 0) return null;
    const lastId = r.undoStack.pop();
    const idx = r.strokes.findIndex((s) => s.id === lastId);
    if (idx >= 0) {
        const [stroke] = r.strokes.splice(idx, 1);
        r.redoStack.push(stroke);
        return { strokeId: lastId };
    }
    return null;
}

function redo(room) {
    const r = ensure(room);
    if (r.redoStack.length === 0) return null;
    const stroke = r.redoStack.pop();
    r.strokes.push(stroke);
    r.undoStack.push(stroke.id);
    return { stroke };
}

module.exports = { getState, handleDraw, undo, redo };
