"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const rooms_1 = __importDefault(require("./rooms"));
const drawing_state_1 = __importDefault(require("./drawing-state"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
const PUBLIC = path_1.default.join(__dirname, '..', '..', 'client');
app.use(express_1.default.static(PUBLIC));
app.get('/_health', (_req, res) => res.send('ok'));
io.on('connection', (socket) => {
    socket.on('join', (payload) => {
        try {
            const { room, username, color, userId } = payload || {};
            if (!room)
                return socket.emit('error', { message: 'missing room' });
            socket.join(room);
            rooms_1.default.addUser(room, socket.id, { userId, username, color });
            const state = drawing_state_1.default.getState(room);
            socket.emit('init-state', state);
            socket.to(room).emit('user-join', { userId, username, color });
            io.in(room).emit('users', rooms_1.default.getUsers(room));
        }
        catch (err) {
            console.error('join error', err);
            socket.emit('error', { message: 'join failed' });
        }
    });
    socket.on('draw', (msg) => {
        try {
            const { room } = msg || {};
            if (!room || !msg.action || !msg.strokeId) {
                return socket.emit('error', { message: 'invalid draw message' });
            }
            if (['begin', 'draw', 'end'].indexOf(msg.action) === -1) {
                return socket.emit('error', { message: 'invalid draw action' });
            }
            drawing_state_1.default.handleDraw(room, msg);
            socket.to(room).emit('draw', msg);
        }
        catch (err) {
            console.error('draw error', err);
            socket.emit('error', { message: 'draw failed' });
        }
    });
    socket.on('cursor', (msg) => {
        try {
            const { room } = msg;
            if (!room)
                return;
            socket.to(room).emit('cursor', msg);
        }
        catch (err) {
            console.error('cursor error', err);
        }
    });
    socket.on('undo', (msg) => {
        try {
            const { room } = msg;
            if (!room)
                return;
            const res = drawing_state_1.default.undo(room);
            if (res)
                io.in(room).emit('undo', res);
        }
        catch (err) {
            console.error('undo error', err);
        }
    });
    socket.on('redo', (msg) => {
        try {
            const { room } = msg;
            if (!room)
                return;
            const res = drawing_state_1.default.redo(room);
            if (res)
                io.in(room).emit('redo', res);
        }
        catch (err) {
            console.error('redo error', err);
        }
    });
    socket.on('disconnecting', () => {
        const joined = Array.from(socket.rooms).filter((r) => r !== socket.id);
        joined.forEach((room) => {
            const user = rooms_1.default.removeUserBySocket(room, socket.id);
            if (user) {
                io.in(room).emit('user-leave', { userId: user.userId });
                io.in(room).emit('users', rooms_1.default.getUsers(room));
            }
        });
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
