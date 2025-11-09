# Collaborative Canvas

Real-time collaborative drawing canvas built with Vanilla JS, Node.js, and WebSockets (Socket.IO).

Setup

1. Install dependencies:

```
npm install
```

2. Start server:

```
npm start
```

3. Open browser at http://localhost:3000/ (open multiple tabs or different browsers to test real-time collaboration). You can add `?room=yourroom` to join a specific room.

Quick test steps

- Open two browser tabs to `http://localhost:3000/` (or with same ?room=...) and draw on one — you should see strokes live on the other tab.
- Try brush, eraser, different widths and colors.
- Click Undo / Redo buttons to test global undo/redo (undo removes the last committed stroke globally).

Notes on implementation

- Uses Socket.IO for websocket transport.
- Client uses requestAnimationFrame batching for pointermove events (reduces network chatter) and immediate local rendering (client-side prediction) so drawing feels responsive.
- Two-layer canvas: overlay for in-progress strokes and main canvas for committed strokes — this improves redraw efficiency.


Features

- Brush and eraser tools
- Color picker and stroke width
- Live synchronization (begin/draw/end events)
- Cursors and user list
- Global undo/redo
- Touch support (basic)




