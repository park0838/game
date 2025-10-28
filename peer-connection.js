class PeerConnection {
    constructor() {
        this.peer = null;
        this.connections = new Map(); // peerId -> connection
        this.isHost = false;
        this.roomId = null;
        this.onDataReceived = null;
        this.onPeerConnected = null;
        this.onPeerDisconnected = null;
    }

    // 새 방 만들기 (호스트)
    createRoom() {
        return new Promise((resolve, reject) => {
            // PeerJS 연결 생성 (공개 서버 사용)
            this.peer = new Peer({
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.roomId = id;
                this.isHost = true;
                console.log('방 생성됨:', id);

                // 다른 피어의 연결 수신 대기
                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

                resolve(id);
            });

            this.peer.on('error', (err) => {
                console.error('Peer 에러:', err);
                reject(err);
            });
        });
    }

    // 기존 방 참가
    joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            this.peer = new Peer({
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Peer ID:', id);

                // 호스트에 연결
                const conn = this.peer.connect(roomId, {
                    reliable: true
                });

                conn.on('open', () => {
                    console.log('호스트에 연결됨');
                    this.roomId = roomId;
                    this.handleIncomingConnection(conn);

                    // 호스트도 새 연결을 대기
                    this.peer.on('connection', (newConn) => {
                        this.handleIncomingConnection(newConn);
                    });

                    resolve(roomId);
                });

                conn.on('error', (err) => {
                    console.error('연결 에러:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer 에러:', err);
                reject(err);
            });
        });
    }

    // 들어오는 연결 처리
    handleIncomingConnection(conn) {
        const peerId = conn.peer;

        conn.on('open', () => {
            console.log('새 피어 연결됨:', peerId);
            this.connections.set(peerId, conn);

            if (this.onPeerConnected) {
                this.onPeerConnected(peerId);
            }

            // 현재 연결된 모든 피어 정보를 새 피어에게 전송
            if (this.isHost) {
                const peerList = Array.from(this.connections.keys());
                conn.send({
                    type: 'peer-list',
                    peers: peerList
                });

                // 다른 모든 피어에게 새 피어 알림
                this.broadcast({
                    type: 'peer-joined',
                    peerId: peerId
                }, peerId);
            }
        });

        conn.on('data', (data) => {
            // 데이터 중계 (호스트인 경우)
            if (this.isHost && data.type !== 'peer-list') {
                this.broadcast(data, peerId);
            }

            if (this.onDataReceived) {
                this.onDataReceived(data, peerId);
            }
        });

        conn.on('close', () => {
            console.log('피어 연결 종료:', peerId);
            this.connections.delete(peerId);

            if (this.onPeerDisconnected) {
                this.onPeerDisconnected(peerId);
            }

            // 다른 피어들에게 알림
            if (this.isHost) {
                this.broadcast({
                    type: 'peer-left',
                    peerId: peerId
                });
            }
        });

        conn.on('error', (err) => {
            console.error('연결 에러:', peerId, err);
        });
    }

    // 데이터 전송
    send(data) {
        this.connections.forEach((conn) => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    // 특정 피어 제외하고 브로드캐스트
    broadcast(data, excludePeerId = null) {
        this.connections.forEach((conn, peerId) => {
            if (conn.open && peerId !== excludePeerId) {
                conn.send(data);
            }
        });
    }

    // 연결된 피어 수
    getPeerCount() {
        return this.connections.size + 1; // 자신 포함
    }

    // 방 URL 생성
    getRoomUrl() {
        const baseUrl = window.location.href.split('?')[0];
        return `${baseUrl}?room=${this.roomId}`;
    }

    // 연결 종료
    disconnect() {
        this.connections.forEach((conn) => {
            conn.close();
        });
        this.connections.clear();

        if (this.peer) {
            this.peer.disconnect();
            this.peer.destroy();
        }
    }
}
