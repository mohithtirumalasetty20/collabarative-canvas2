import { v4 as uuidv4 } from 'uuid';

type Point = { x: number; y: number };
type Stroke = { id: string; userId: string; username?: string; color?: string; width?: number; points: Point[]; tool?: string; committed?: boolean };

const rooms = new Map<string, { strokes: Stroke[]; undoStack: string[]; redoStack: Stroke[] }>();

function ensure(room: string) {
    if (!rooms.has(room)) {
        rooms.set(room, { strokes: [], undoStack: [], redoStack: [] });
    }
    return rooms.get(room)!;
}

export function getState(room: string) {
    const r = ensure(room);
    return { strokes: r.strokes, undoStack: r.undoStack.slice(), redoStackSize: r.redoStack.length };
}

export function handleDraw(room: string, msg: any) {
    const r = ensure(room);
    const { action, strokeId, point, points, color, width, userId, username, tool } = msg;
    if (action === 'begin') {
        const id = strokeId || uuidv4();
        const stroke: Stroke = { id, userId, username, color, width, points: [point], tool, committed: false };
        r.strokes.push(stroke);
        r.redoStack = [];
        return stroke;
    } else if (action === 'draw') {
        const stroke = r.strokes.find((s) => s.id === strokeId);
        if (stroke) {
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
            r.undoStack.push(stroke.id);
        }
        return stroke;
    }
    return null;
}

export function undo(room: string) {
    const r = ensure(room);
    if (r.undoStack.length === 0) return null;
    const lastId = r.undoStack.pop()!;
    const idx = r.strokes.findIndex((s) => s.id === lastId);
    if (idx >= 0) {
        const [stroke] = r.strokes.splice(idx, 1);
        r.redoStack.push(stroke);
        return { strokeId: lastId };
    }
    return null;
}

export function redo(room: string) {
    const r = ensure(room);
    if (r.redoStack.length === 0) return null;
    const stroke = r.redoStack.pop()!;
    r.strokes.push(stroke);
    r.undoStack.push(stroke.id);
    return { stroke };
}

export default { getState, handleDraw, undo, redo };
