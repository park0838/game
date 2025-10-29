class PeerConnection {
    constructor() {
        this.peer = null;
        this.connections = new Map(); // peerId -> connection
        this.isHost = false;
        this.roomId = null;
        // 콜백
        this.onDataReceived = null;
        this.onPeerConnected = null;
        this.onPeerDisconnected = null;
        // 성능 최적화
        this._messageQueue = [];
        this._sendTimer = null;
        this._batchDelay = 16; // ~60fps
    }

    // STUN/TURN 서버 설정 (최적화)
    _getPeerConfig() {
        return {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            },
            // 연결 최적화
            serialization: 'json',
            debug: 0
        };
    }

    // 새 방 만들기 (호스트)
    createRoom() {
        return new Promise((resolve, reject) => {
            this.peer = new Peer(this._getPeerConfig());

            this.peer.on('open', (id) => {
                this.roomId = id;
                this.isHost = true;

                // 다른 피어의 연결 수신 대기
                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

                resolve(id);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });
        });
    }

    // 기존 방 참가
    joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            this.peer = new Peer(this._getPeerConfig());

            this.peer.on('open', (id) => {
                // 호스트에 연결 (reliable 모드)
                const conn = this.peer.connect(roomId, { reliable: true });

                conn.on('open', () => {
                    this.roomId = roomId;
                    this.handleIncomingConnection(conn);

                    // 다른 피어 연결 대기
                    this.peer.on('connection', (newConn) => {
                        this.handleIncomingConnection(newConn);
                    });

                    resolve(roomId);
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });
        });
    }

    // 들어오는 연결 처리
    handleIncomingConnection(conn) {
        const peerId = conn.peer;

        // 연결 초기화
        const initConnection = () => {
            this.connections.set(peerId, conn);
            this.onPeerConnected?.(peerId);

            // 호스트: 피어 리스트 전송
            if (this.isHost) {
                const peerList = Array.from(this.connections.keys());
                conn.send({ type: 'peer-list', peers: peerList });
                this.broadcast({ type: 'peer-joined', peerId }, peerId);
            }
        };

        // open 이벤트 처리
        conn.open ? initConnection() : conn.on('open', initConnection);

        // 데이터 수신
        conn.on('data', (data) => {
            // 호스트가 모든 메시지 중계
            if (this.isHost && data.type !== 'peer-list') {
                this.broadcast(data, peerId);
            }
            this.onDataReceived?.(data, peerId);
        });

        // 연결 종료
        conn.on('close', () => {
            this.connections.delete(peerId);
            this.onPeerDisconnected?.(peerId);

            if (this.isHost) {
                this.broadcast({ type: 'peer-left', peerId });
            }
        });

        // 에러 핸들링
        conn.on('error', (err) => {
            console.error('Connection error:', peerId, err);
        });
    }

    // 데이터 전송 (최적화된 배치 전송)
    send(data, immediate = false) {
        // 긴급 메시지는 즉시 전송
        if (immediate || data.type === 'chat' || data.type === 'word-selected') {
            this._sendImmediate(data);
            return;
        }

        // 드로잉 메시지는 배치 처리
        this._messageQueue.push(data);

        if (!this._sendTimer) {
            this._sendTimer = setTimeout(() => {
                this._flushMessages();
            }, this._batchDelay);
        }
    }

    // 즉시 전송
    _sendImmediate(data) {
        this.connections.forEach((conn) => {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (err) {
                    console.error('Send error:', err);
                }
            }
        });
    }

    // 배치 메시지 전송
    _flushMessages() {
        if (this._messageQueue.length === 0) return;

        const batch = this._messageQueue.splice(0);
        this.connections.forEach((conn) => {
            if (conn.open) {
                try {
                    // 배치로 묶어서 전송
                    batch.forEach(msg => conn.send(msg));
                } catch (err) {
                    console.error('Batch send error:', err);
                }
            }
        });

        this._sendTimer = null;
    }

    // 브로드캐스트 (특정 피어 제외)
    broadcast(data, excludePeerId = null) {
        this.connections.forEach((conn, peerId) => {
            if (conn.open && peerId !== excludePeerId) {
                try {
                    conn.send(data);
                } catch (err) {
                    console.error('Broadcast error:', err);
                }
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
        // 타이머 정리
        if (this._sendTimer) {
            clearTimeout(this._sendTimer);
            this._flushMessages(); // 남은 메시지 전송
        }

        // 모든 연결 종료
        this.connections.forEach((conn) => {
            try {
                conn.close();
            } catch (err) {
                console.error('Disconnect error:', err);
            }
        });
        this.connections.clear();

        // Peer 종료
        if (this.peer) {
            this.peer.disconnect();
            this.peer.destroy();
            this.peer = null;
        }
    }
}
