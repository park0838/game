// DOM 요소
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfo = document.getElementById('roomInfo');
const currentRoomId = document.getElementById('currentRoomId');
const playerCount = document.getElementById('playerCount');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const drawingTools = document.getElementById('drawingTools');
const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const colorBtns = document.querySelectorAll('.color-btn');
const status = document.getElementById('status');
const cursorsContainer = document.getElementById('cursors');

// 상태
let peerConnection = null;
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 3;
let isEraser = false;
let remoteCursors = new Map(); // peerId -> cursor element

// Canvas 설정
function initCanvas() {
    canvas.width = 1200;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

// Drawing 함수
function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    // P2P로 전송
    if (peerConnection) {
        peerConnection.send({
            type: 'draw-start',
            x: pos.x,
            y: pos.y,
            color: currentColor,
            size: currentSize,
            eraser: isEraser
        });
    }
}

function draw(e) {
    if (!isDrawing) return;

    const pos = getMousePos(e);

    ctx.strokeStyle = isEraser ? '#FFFFFF' : currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // P2P로 전송
    if (peerConnection) {
        peerConnection.send({
            type: 'draw',
            x: pos.x,
            y: pos.y
        });
    }
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;

    // P2P로 전송
    if (peerConnection) {
        peerConnection.send({
            type: 'draw-end'
        });
    }
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// 원격 드로잉 처리
function handleRemoteDrawing(data, peerId) {
    console.log('🎨 원격 데이터:', data.type, 'from:', peerId);

    if (data.type === 'draw-start') {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
        ctx.strokeStyle = data.eraser ? '#FFFFFF' : data.color;
        ctx.lineWidth = data.size;
        console.log('✏️ 원격 드로잉 시작:', data.color);
    } else if (data.type === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
    } else if (data.type === 'draw-end') {
        console.log('✅ 원격 드로잉 종료');
    } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('🗑️ 원격에서 캔버스 지움');
    } else if (data.type === 'cursor-move') {
        updateRemoteCursor(peerId, data.x, data.y, data.color);
    } else if (data.type === 'peer-list') {
        console.log('📋 현재 참가자:', data.peers);
        // 참가자 입장에서 총 인원 = 호스트(1) + 다른 참가자들(data.peers.length) + 자신(1)
        // 하지만 data.peers에 자신이 포함되어 있으므로: 호스트(1) + data.peers.length
        const totalCount = 1 + data.peers.length;
        playerCount.textContent = totalCount;
    } else if (data.type === 'peer-joined') {
        console.log('👋 새 참가자:', data.peerId);
        // 참가자도 인원 수 증가
        const currentCount = parseInt(playerCount.textContent);
        playerCount.textContent = currentCount + 1;
    } else if (data.type === 'peer-left') {
        console.log('👋 참가자 퇴장:', data.peerId);
        removeRemoteCursor(data.peerId);
        // 참가자도 인원 수 감소
        const currentCount = parseInt(playerCount.textContent);
        playerCount.textContent = Math.max(1, currentCount - 1);
    }
}

// 원격 커서 업데이트
function updateRemoteCursor(peerId, x, y, color) {
    let cursor = remoteCursors.get(peerId);

    if (!cursor) {
        cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.style.backgroundColor = color || '#FF6B6B';
        cursorsContainer.appendChild(cursor);
        remoteCursors.set(peerId, cursor);
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    cursor.style.left = (rect.left + x * scaleX) + 'px';
    cursor.style.top = (rect.top + y * scaleY) + 'px';
}

function removeRemoteCursor(peerId) {
    const cursor = remoteCursors.get(peerId);
    if (cursor) {
        cursor.remove();
        remoteCursors.delete(peerId);
    }
}

// 마우스 움직임 전송 (커서 표시용)
function trackMouseMove(e) {
    if (peerConnection) {
        const pos = getMousePos(e);
        peerConnection.send({
            type: 'cursor-move',
            x: pos.x,
            y: pos.y,
            color: currentColor
        });
    }
}

let mouseMoveThrottle = null;
canvas.addEventListener('mousemove', (e) => {
    if (mouseMoveThrottle) return;
    mouseMoveThrottle = setTimeout(() => {
        trackMouseMove(e);
        mouseMoveThrottle = null;
    }, 50); // 50ms throttle
});

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (peerConnection) {
        peerConnection.send({
            type: 'clear'
        });
    }
}

// UI 업데이트
function updatePlayerCount() {
    if (peerConnection) {
        playerCount.textContent = peerConnection.getPeerCount();
    }
}

function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

// 방 만들기
createRoomBtn.addEventListener('click', async () => {
    try {
        showStatus('방을 생성하는 중...', 'info');
        console.log('🚀 방 만들기 시작');

        peerConnection = new PeerConnection();

        // 데이터 수신 핸들러 설정
        peerConnection.onDataReceived = handleRemoteDrawing;
        peerConnection.onPeerConnected = (peerId) => {
            console.log('✅ 새 참가자 연결됨:', peerId);
            updatePlayerCount();
            showStatus('새로운 참가자가 들어왔습니다!', 'success');
        };
        peerConnection.onPeerDisconnected = (peerId) => {
            console.log('❌ 참가자 퇴장:', peerId);
            updatePlayerCount();
            showStatus('참가자가 나갔습니다.', 'info');
        };

        const roomId = await peerConnection.createRoom();
        console.log('✅ 방 생성 완료! ID:', roomId);

        currentRoomId.textContent = roomId;
        roomInfo.style.display = 'flex';
        drawingTools.style.display = 'flex';
        canvasContainer.style.display = 'flex';

        updatePlayerCount();
        showStatus('방이 생성되었습니다! 링크를 공유하세요.', 'success');

        initCanvas();
    } catch (err) {
        console.error('❌ 방 생성 실패:', err);
        showStatus('방 생성 실패: ' + err.message, 'error');
    }
});

// 방 참가
joinRoomBtn.addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim();

    if (!roomId) {
        showStatus('방 코드를 입력하세요', 'error');
        return;
    }

    try {
        showStatus('방에 참가하는 중...', 'info');
        console.log('🚪 방 참가 시도:', roomId);

        peerConnection = new PeerConnection();

        peerConnection.onDataReceived = (data, peerId) => {
            console.log('📦 데이터 수신:', data.type, 'from:', peerId);
            handleRemoteDrawing(data, peerId);
        };
        peerConnection.onPeerConnected = (peerId) => {
            console.log('✅ 연결 성공:', peerId);
            updatePlayerCount();
            showStatus('연결되었습니다!', 'success');
        };
        peerConnection.onPeerDisconnected = (peerId) => {
            console.log('❌ 연결 종료:', peerId);
            updatePlayerCount();
        };

        await peerConnection.joinRoom(roomId);
        console.log('✅ 방 참가 성공!');

        currentRoomId.textContent = roomId;
        roomInfo.style.display = 'flex';
        drawingTools.style.display = 'flex';
        canvasContainer.style.display = 'flex';

        updatePlayerCount();
        showStatus('방에 참가했습니다!', 'success');

        initCanvas();
    } catch (err) {
        console.error('❌ 방 참가 실패:', err);
        showStatus('방 참가 실패: ' + err.message, 'error');
    }
});

// URL에서 자동 참가
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        roomIdInput.value = roomId;
        joinRoomBtn.click();
    }
});

// 링크 복사
copyLinkBtn.addEventListener('click', () => {
    const url = peerConnection.getRoomUrl();
    navigator.clipboard.writeText(url).then(() => {
        showStatus('링크가 복사되었습니다!', 'success');
    }).catch(() => {
        showStatus('링크 복사 실패', 'error');
    });
});

// Drawing tools event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
});

// Color selection
colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
        isEraser = false;
        eraserBtn.classList.remove('active');
    });
});

// Brush size
brushSizeInput.addEventListener('input', (e) => {
    currentSize = e.target.value;
    brushSizeValue.textContent = currentSize;
});

// Eraser
eraserBtn.addEventListener('click', () => {
    isEraser = !isEraser;
    eraserBtn.classList.toggle('active');
    if (isEraser) {
        colorBtns.forEach(b => b.classList.remove('active'));
    }
});

// Clear button
clearBtn.addEventListener('click', () => {
    if (confirm('정말 전체를 지우시겠습니까?')) {
        clearCanvas();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (peerConnection) {
        peerConnection.disconnect();
    }
});
