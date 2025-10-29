// DOM 요소 캐싱 (성능 최적화)
const DOM = {
    // 로비 요소
    nicknameModal: document.getElementById('nicknameModal'),
    nicknameInput: document.getElementById('nicknameInput'),
    setNicknameBtn: document.getElementById('setNicknameBtn'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    roomIdInput: document.getElementById('roomIdInput'),
    lobbyPanel: document.getElementById('lobbyPanel'),
    roomInfo: document.getElementById('roomInfo'),
    currentRoomId: document.getElementById('currentRoomId'),
    myNickname: document.getElementById('myNickname'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),

    // 게임 요소
    gamePanel: document.getElementById('gamePanel'),
    timer: document.getElementById('timer'),
    turnInfo: document.getElementById('turnInfo'),
    wordDisplay: document.getElementById('wordDisplay'),
    wordChoices: document.getElementById('wordChoices'),
    currentRound: document.getElementById('currentRound'),
    totalRounds: document.getElementById('totalRounds'),
    playerList: document.getElementById('playerList'),

    // 캔버스 요소
    canvas: document.getElementById('drawingCanvas'),
    drawingTools: document.getElementById('drawingTools'),
    clearBtn: document.getElementById('clearBtn'),
    brushSizeInput: document.getElementById('brushSize'),
    brushSizeValue: document.getElementById('brushSizeValue'),
    colorBtns: document.querySelectorAll('.color-btn'),
    cursors: document.getElementById('cursors'),
    canvasOverlay: document.getElementById('canvasOverlay'),

    // 채팅 요소
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),

    // 상태 표시
    status: document.getElementById('status')
};

// 캔버스 컨텍스트
const ctx = DOM.canvas.getContext('2d', { alpha: false });

// 앱 상태
const state = {
    peerConnection: null,
    game: null,
    nickname: null,
    // 드로잉 상태
    isDrawing: false,
    currentColor: '#000000',
    currentSize: 5,
    // 원격 커서 맵
    remoteCursors: new Map()
};

// 유틸리티 함수
const utils = {
    // 상태 메시지 표시
    showStatus(message, type = 'info', duration = 3000) {
        DOM.status.textContent = message;
        DOM.status.className = `status ${type}`;
        setTimeout(() => DOM.status.textContent = '', duration);
    },

    // 캔버스 초기화
    initCanvas() {
        DOM.canvas.width = 800;
        DOM.canvas.height = 600;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
    },

    // 마우스 위치 계산 (스케일 고려)
    getCanvasPos(e) {
        const rect = DOM.canvas.getBoundingClientRect();
        const scaleX = DOM.canvas.width / rect.width;
        const scaleY = DOM.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    },

    // 채팅 메시지 추가
    addChatMessage(nickname, message, isSystem = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = isSystem ? 'chat-message system' : 'chat-message';
        msgDiv.innerHTML = isSystem
            ? `<span class="system-text">${message}</span>`
            : `<strong>${nickname}:</strong> ${message}`;
        DOM.chatMessages.appendChild(msgDiv);
        DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
    }
};

// 드로잉 핸들러
const drawing = {
    start(e) {
        if (!state.game?.isMyTurn()) {
            utils.showStatus('당신의 차례가 아닙니다!', 'error', 1500);
            return;
        }

        state.isDrawing = true;
        const pos = utils.getCanvasPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        state.peerConnection?.send({
            type: 'draw-start',
            x: pos.x,
            y: pos.y,
            color: state.currentColor,
            size: state.currentSize
        });
    },

    move(e) {
        if (!state.isDrawing) return;

        const pos = utils.getCanvasPos(e);
        ctx.strokeStyle = state.currentColor;
        ctx.lineWidth = state.currentSize;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        state.peerConnection?.send({
            type: 'draw',
            x: pos.x,
            y: pos.y
        });
    },

    end() {
        if (!state.isDrawing) return;
        state.isDrawing = false;
        state.peerConnection?.send({ type: 'draw-end' });
    },

    clear() {
        if (!confirm('정말 전체를 지우시겠습니까?')) return;
        ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
        state.peerConnection?.send({ type: 'clear' });
    },

    // 원격 드로잉 처리
    handleRemote(data) {
        switch (data.type) {
            case 'draw-start':
                ctx.beginPath();
                ctx.moveTo(data.x, data.y);
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.size;
                break;
            case 'draw':
                ctx.lineTo(data.x, data.y);
                ctx.stroke();
                break;
            case 'clear':
                ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
                break;
        }
    }
};

// 커서 관리
const cursor = {
    // 쓰로틀링을 위한 타이머
    _throttleTimer: null,

    track(e) {
        if (this._throttleTimer) return;
        this._throttleTimer = setTimeout(() => {
            const pos = utils.getCanvasPos(e);
            state.peerConnection?.send({
                type: 'cursor-move',
                x: pos.x,
                y: pos.y,
                color: state.currentColor
            });
            this._throttleTimer = null;
        }, 50);
    },

    updateRemote(peerId, x, y, color) {
        let cursorEl = state.remoteCursors.get(peerId);

        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.className = 'remote-cursor';
            cursorEl.style.backgroundColor = color || '#FF6B6B';
            DOM.cursors.appendChild(cursorEl);
            state.remoteCursors.set(peerId, cursorEl);
        }

        const rect = DOM.canvas.getBoundingClientRect();
        const scaleX = rect.width / DOM.canvas.width;
        const scaleY = rect.height / DOM.canvas.height;

        cursorEl.style.left = `${rect.left + x * scaleX}px`;
        cursorEl.style.top = `${rect.top + y * scaleY}px`;
    },

    remove(peerId) {
        const cursorEl = state.remoteCursors.get(peerId);
        if (cursorEl) {
            cursorEl.remove();
            state.remoteCursors.delete(peerId);
        }
    }
};

// 게임 UI 업데이트
const gameUI = {
    updateScoreboard() {
        if (!state.game) return;

        const ranking = state.game.getRanking();
        DOM.playerList.innerHTML = ranking.map((player, i) => `
            <div class="player-item ${player.peerId === state.game.myPeerId ? 'me' : ''}">
                <span class="rank">${i + 1}</span>
                <span class="nickname">${player.nickname}</span>
                <span class="score">${player.score}점</span>
            </div>
        `).join('');
    },

    updateTimer(time) {
        DOM.timer.textContent = time;
        DOM.timer.className = time <= 10 ? 'timer warning' : 'timer';
    },

    updateWordDisplay() {
        const hint = state.game?.getHint() || '';
        DOM.wordDisplay.textContent = hint;
    },

    showWordChoices(words) {
        DOM.wordChoices.style.display = 'flex';
        words.forEach((word, i) => {
            const btn = document.getElementById(`word${i + 1}`);
            btn.textContent = word;
            btn.onclick = () => {
                state.game.selectWord(word);
                DOM.wordChoices.style.display = 'none';
                state.peerConnection.send({ type: 'word-selected', word });
            };
        });
    },

    updateTurnInfo() {
        const isMyTurn = state.game?.isMyTurn();
        DOM.turnInfo.textContent = isMyTurn ? '당신이 그리는 차례!' : '다른 사람이 그리는 중...';
        DOM.drawingTools.style.display = isMyTurn ? 'flex' : 'none';
        DOM.canvasOverlay.style.display = isMyTurn ? 'none' : 'block';
    },

    updateRoundInfo() {
        DOM.currentRound.textContent = state.game?.currentRound || 1;
        DOM.totalRounds.textContent = state.game?.totalRounds || 3;
    }
};

// 데이터 수신 핸들러 (통합)
function handleDataReceived(data, peerId) {
    // 드로잉 관련
    if (data.type.startsWith('draw') || data.type === 'clear') {
        drawing.handleRemote(data);
    }
    // 커서 관련
    else if (data.type === 'cursor-move') {
        cursor.updateRemote(peerId, data.x, data.y, data.color);
    }
    // 게임 로직 관련
    else if (data.type === 'player-join') {
        state.game?.addPlayer(data.peerId, data.nickname);
        utils.addChatMessage('', `${data.nickname}님이 입장했습니다.`, true);
        gameUI.updateScoreboard();
    }
    else if (data.type === 'chat') {
        utils.addChatMessage(data.nickname, data.message);
        // 정답 확인
        const result = state.game?.checkAnswer(peerId, data.message);
        if (result?.correct) {
            utils.addChatMessage('', `${data.nickname}님이 정답을 맞췄습니다! (+${result.score}점)`, true);
            gameUI.updateScoreboard();
        }
    }
    else if (data.type === 'word-selected') {
        DOM.wordDisplay.textContent = state.game?.getHint() || '';
    }
}

// 닉네임 모달
DOM.setNicknameBtn.addEventListener('click', () => {
    const nickname = DOM.nicknameInput.value.trim();
    if (!nickname) {
        utils.showStatus('닉네임을 입력하세요', 'error');
        return;
    }
    state.nickname = nickname;
    DOM.myNickname.textContent = nickname;
    DOM.nicknameModal.style.display = 'none';
});

// 방 만들기
DOM.createRoomBtn.addEventListener('click', async () => {
    if (!state.nickname) {
        DOM.nicknameModal.style.display = 'flex';
        return;
    }

    try {
        utils.showStatus('방을 생성하는 중...', 'info');

        state.peerConnection = new PeerConnection();
        state.peerConnection.onDataReceived = handleDataReceived;
        state.peerConnection.onPeerConnected = (peerId) => {
            utils.showStatus('새로운 참가자가 들어왔습니다!', 'success');
            gameUI.updateScoreboard();
        };
        state.peerConnection.onPeerDisconnected = (peerId) => {
            state.game?.removePlayer(peerId);
            cursor.remove(peerId);
            utils.showStatus('참가자가 나갔습니다.', 'info');
            gameUI.updateScoreboard();
        };

        const roomId = await state.peerConnection.createRoom();

        // 게임 인스턴스 생성
        state.game = new SketchQuizGame();
        state.game.setMyInfo(state.peerConnection.peer.id, state.nickname);
        state.game.onTimerUpdate = gameUI.updateTimer;
        state.game.onScoreUpdate = gameUI.updateScoreboard;
        state.game.onGameStateChange = (stateType) => {
            if (stateType === 'turnStart' && state.game.isMyTurn()) {
                gameUI.showWordChoices(state.game.getRandomWords());
            }
            gameUI.updateTurnInfo();
        };

        DOM.currentRoomId.textContent = roomId;
        DOM.roomInfo.style.display = 'flex';
        DOM.lobbyPanel.style.display = 'none';
        DOM.gamePanel.style.display = 'block';

        utils.initCanvas();
        gameUI.updateScoreboard();
        gameUI.updateRoundInfo();
        utils.showStatus('방이 생성되었습니다! 링크를 공유하세요.', 'success');
    } catch (err) {
        utils.showStatus('방 생성 실패: ' + err.message, 'error');
    }
});

// 방 참가
DOM.joinRoomBtn.addEventListener('click', async () => {
    if (!state.nickname) {
        DOM.nicknameModal.style.display = 'flex';
        return;
    }

    const roomId = DOM.roomIdInput.value.trim();
    if (!roomId) {
        utils.showStatus('방 코드를 입력하세요', 'error');
        return;
    }

    try {
        utils.showStatus('방에 참가하는 중...', 'info');

        state.peerConnection = new PeerConnection();
        state.peerConnection.onDataReceived = handleDataReceived;
        state.peerConnection.onPeerConnected = () => {
            utils.showStatus('연결되었습니다!', 'success');
        };
        state.peerConnection.onPeerDisconnected = (peerId) => {
            state.game?.removePlayer(peerId);
            cursor.remove(peerId);
            gameUI.updateScoreboard();
        };

        await state.peerConnection.joinRoom(roomId);

        // 게임 인스턴스 생성 (참가자)
        state.game = new SketchQuizGame();
        state.game.setMyInfo(state.peerConnection.peer.id, state.nickname);
        state.game.onTimerUpdate = gameUI.updateTimer;
        state.game.onScoreUpdate = gameUI.updateScoreboard;
        state.game.onGameStateChange = gameUI.updateTurnInfo;

        // 호스트에게 참가 알림
        state.peerConnection.send({
            type: 'player-join',
            peerId: state.peerConnection.peer.id,
            nickname: state.nickname
        });

        DOM.currentRoomId.textContent = roomId;
        DOM.roomInfo.style.display = 'flex';
        DOM.lobbyPanel.style.display = 'none';
        DOM.gamePanel.style.display = 'block';

        utils.initCanvas();
        gameUI.updateScoreboard();
        gameUI.updateRoundInfo();
        utils.showStatus('방에 참가했습니다!', 'success');
    } catch (err) {
        utils.showStatus('방 참가 실패: ' + err.message, 'error');
    }
});

// 링크 복사
DOM.copyLinkBtn.addEventListener('click', () => {
    const url = state.peerConnection.getRoomUrl();
    navigator.clipboard.writeText(url)
        .then(() => utils.showStatus('링크가 복사되었습니다!', 'success'))
        .catch(() => utils.showStatus('링크 복사 실패', 'error'));
});

// 채팅 전송
const sendChat = () => {
    const message = DOM.chatInput.value.trim();
    if (!message) return;

    state.peerConnection?.send({
        type: 'chat',
        nickname: state.nickname,
        message
    });

    utils.addChatMessage(state.nickname, message);
    DOM.chatInput.value = '';
};

DOM.sendChatBtn.addEventListener('click', sendChat);
DOM.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

// 캔버스 이벤트 (통합)
const setupCanvasEvents = () => {
    // 마우스 이벤트
    DOM.canvas.addEventListener('mousedown', drawing.start);
    DOM.canvas.addEventListener('mousemove', (e) => {
        drawing.move(e);
        cursor.track(e);
    });
    DOM.canvas.addEventListener('mouseup', drawing.end);
    DOM.canvas.addEventListener('mouseleave', drawing.end);

    // 터치 이벤트 (모바일 지원)
    const touchToMouse = (e, type) => {
        e.preventDefault();
        const touch = e.touches?.[0];
        if (!touch && type !== 'mouseup') return;
        const mouseEvent = new MouseEvent(type, {
            clientX: touch?.clientX,
            clientY: touch?.clientY
        });
        DOM.canvas.dispatchEvent(mouseEvent);
    };

    DOM.canvas.addEventListener('touchstart', (e) => touchToMouse(e, 'mousedown'));
    DOM.canvas.addEventListener('touchmove', (e) => touchToMouse(e, 'mousemove'));
    DOM.canvas.addEventListener('touchend', (e) => touchToMouse(e, 'mouseup'));
};

// 툴 이벤트
DOM.colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        DOM.colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentColor = btn.dataset.color;
    });
});

DOM.brushSizeInput.addEventListener('input', (e) => {
    state.currentSize = e.target.value;
    DOM.brushSizeValue.textContent = state.currentSize;
});

DOM.clearBtn.addEventListener('click', drawing.clear);

// URL 자동 참가 & 초기화
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
        DOM.roomIdInput.value = roomId;
    }
    setupCanvasEvents();
});

// 정리
window.addEventListener('beforeunload', () => {
    state.peerConnection?.disconnect();
});
