# ARCHITECTURE

Data flow

1. User draws on canvas → client captures pointer events and generates draw messages (begin/draw/end) containing point data.
2. Client emits messages via WebSocket to server (Socket.IO).
3. Server updates in-memory drawing state and broadcasts the draw messages to all clients in the room.
4. Clients render live strokes on an overlay canvas. Once a stroke is finished it is committed to the main canvas.

Key implementation details

- Batching & throttling: Clients batch pointermove points and send them via requestAnimationFrame to reduce event frequency. Cursor updates are also throttled via rAF.
- Client-side prediction: The drawing client immediately renders local strokes on the overlay (so the user sees instant feedback). Server broadcasts are sent to other clients only (sender excluded) to avoid duplicate rendering.
- Layered canvas: overlay for in-progress strokes, main canvas holds committed strokes for efficient redraws and undo/redo operations.

WebSocket message protocol

- join: { room, username, color, userId }
- init-state: server -> { strokes: [...] }
- draw: { room, action: 'begin'|'draw'|'end', strokeId, point: {x,y}, color, width, userId, username, tool }
- cursor: { room, userId, x, y, color, username }
- undo: { room }
- redo: { room }
- undo (broadcast): { strokeId }
- redo (broadcast): { stroke }

Undo/Redo synchronization

- Server maintains undoStack (stroke ids) and redoStack (stroke objects) per room.
- When a user requests undo, the server pops the last stroke id, removes stroke from strokes array, pushes it onto redoStack and broadcasts an 'undo' message with strokeId.
- Redo pops from redoStack, pushes stroke back to strokes and broadcasts 'redo' with full stroke.

Notes and guarantees

- Global undo/redo is implemented as server-side operation on full strokes. An undo will always remove the latest committed stroke from the room's operation log (regardless of which user created it). This keeps a single authoritative timeline and avoids divergent state across clients.
- Eraser uses canvas composition (destination-out) to visually remove pixels; undo works at stroke granularity and will restore the stroke removed by undo.

Performance decisions

- Two-layer canvas: overlay for live strokes and main canvas for committed strokes. This reduces re-drawing during live events.
- Throttling and Batching: clients aggregate pointermove events using requestAnimationFrame and send batches of points in a single draw message (points[]). This reduces socket message frequency while maintaining smooth drawing.

In this implementation we use requestAnimationFrame batching to reduce network traffic while preserving smooth rendering.

Conflict resolution

- Draw order determines rendering; last-writer (time-ordered server operations) appears on top.
- Eraser implemented using composition (destination-out) so it visually removes underlying pixels, which may complicate full reversibility (undo works at stroke granularity).
