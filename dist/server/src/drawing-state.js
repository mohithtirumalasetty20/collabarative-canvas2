"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getState = getState;
exports.handleDraw = handleDraw;
exports.undo = undo;
exports.redo = redo;
const uuid_1 = require("uuid");
const rooms = new Map();
function ensure(room) {
    if (!rooms.has(room)) {
        rooms.set(room, { strokes: [], undoStack: [], redoStack: [] });
    }
    return rooms.get(room);
}
function getState(room) {
    const r = ensure(room);
    return { strokes: r.strokes, undoStack: r.undoStack.slice(), redoStackSize: r.redoStack.length };
}
function handleDraw(room, msg) {
    const r = ensure(room);
    const { action, strokeId, point, points, color, width, userId, username, tool } = msg;
    if (action === 'begin') {
        const id = strokeId || (0, uuid_1.v4)();
        const stroke = { id, userId, username, color, width, points: [point], tool, committed: false };
        r.strokes.push(stroke);
        r.redoStack = [];
        return stroke;
    }
    else if (action === 'draw') {
        const stroke = r.strokes.find((s) => s.id === strokeId);
        if (stroke) {
            if (Array.isArray(points)) {
                stroke.points.push(...points);
            }
            else if (point) {
                stroke.points.push(point);
            }
        }
        return stroke;
    }
    else if (action === 'end') {
        const stroke = r.strokes.find((s) => s.id === strokeId);
        if (stroke) {
            stroke.committed = true;
            r.undoStack.push(stroke.id);
        }
        return stroke;
    }
    return null;
}
function undo(room) {
    const r = ensure(room);
    if (r.undoStack.length === 0)
        return null;
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
    if (r.redoStack.length === 0)
        return null;
    const stroke = r.redoStack.pop();
    r.strokes.push(stroke);
    r.undoStack.push(stroke.id);
    return { stroke };
}
exports.default = { getState, handleDraw, undo, redo };
