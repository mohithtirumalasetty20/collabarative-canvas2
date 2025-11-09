// websocket client wrapper using socket.io
const WS = (function () {
    let socket = null;
    function connect(room, user) {
        socket = io();
        socket.on('connect', () => {
            socket.emit('join', { room, username: user.username, color: user.color, userId: user.id });
        });

        return socket;
    }

    return { connect };
})();
