// 게임 상태 관리 클래스
class SketchQuizGame {
    constructor() {
        // 게임 설정
        this.roundTime = 60;
        this.totalRounds = 3;
        this.hintInterval = 15;

        // 게임 상태
        this.gameState = 'lobby'; // lobby, playing, roundEnd, gameEnd
        this.currentRound = 0;
        this.currentDrawer = null;
        this.currentWord = null;
        this.timeLeft = this.roundTime;
        this.timer = null;
        this.hintLevel = 0;

        // 플레이어 관리
        this.players = new Map(); // peerId -> {nickname, score, hasGuessed}
        this.myPeerId = null;
        this.myNickname = null;
        this.turnOrder = [];
        this.currentTurnIndex = 0;

        // 콜백 함수
        this.onGameStateChange = null;
        this.onTimerUpdate = null;
        this.onScoreUpdate = null;
    }

    // 단어 은행
    wordBank = [
        '사과', '바나나', '자동차', '비행기', '컴퓨터',
        '책', '연필', '의자', '테이블', '집',
        '나무', '꽃', '태양', '달', '별',
        '강아지', '고양이', '물고기', '새', '토끼',
        '피자', '햄버거', '치킨', '아이스크림', '케이크',
        '축구공', '농구공', '야구', '테니스', '수영',
        '산', '바다', '강', '호수', '섬',
        '우산', '모자', '신발', '가방', '시계',
        '카메라', '전화기', '텔레비전', '냉장고', '세탁기',
        '학교', '병원', '은행', '도서관', '공원'
    ];

    // 플레이어 추가
    addPlayer(peerId, nickname) {
        if (!this.players.has(peerId)) {
            this.players.set(peerId, {
                nickname,
                score: 0,
                hasGuessed: false
            });
            this.updateTurnOrder();
            this.onScoreUpdate?.();
        }
    }

    // 플레이어 제거
    removePlayer(peerId) {
        if (this.players.delete(peerId)) {
            this.updateTurnOrder();
            this.onScoreUpdate?.();

            // 현재 그리는 사람이 나간 경우
            if (this.currentDrawer === peerId && this.gameState === 'playing') {
                this.endTurn();
            }
        }
    }

    // 턴 순서 업데이트
    updateTurnOrder() {
        this.turnOrder = Array.from(this.players.keys());
    }

    // 내 정보 설정
    setMyInfo(peerId, nickname) {
        this.myPeerId = peerId;
        this.myNickname = nickname;
        this.addPlayer(peerId, nickname);
    }

    // 게임 시작
    startGame() {
        if (this.players.size < 2) {
            return false;
        }

        this.gameState = 'playing';
        this.currentRound = 1;
        this.currentTurnIndex = 0;

        // 모든 플레이어 점수 초기화
        this.players.forEach(player => {
            player.score = 0;
            player.hasGuessed = false;
        });

        this.startNewTurn();
        return true;
    }

    // 새 턴 시작
    startNewTurn() {
        if (this.currentTurnIndex >= this.turnOrder.length) {
            // 라운드 종료
            this.currentRound++;
            this.currentTurnIndex = 0;

            if (this.currentRound > this.totalRounds) {
                this.endGame();
                return;
            }
        }

        this.currentDrawer = this.turnOrder[this.currentTurnIndex];
        this.currentWord = null;
        this.timeLeft = this.roundTime;
        this.hintLevel = 0;

        // 모든 플레이어 추측 상태 초기화
        this.players.forEach(player => {
            player.hasGuessed = false;
        });

        if (this.onGameStateChange) {
            this.onGameStateChange('turnStart');
        }
    }

    // 단어 선택
    selectWord(word) {
        this.currentWord = word;
        this.startTimer();

        if (this.onGameStateChange) {
            this.onGameStateChange('drawing');
        }
    }

    // 랜덤 단어 3개 선택
    getRandomWords() {
        const shuffled = [...this.wordBank].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
    }

    // 타이머 시작
    startTimer() {
        this.stopTimer();

        this.timer = setInterval(() => {
            this.timeLeft--;

            // 힌트 레벨 업데이트
            const elapsed = this.roundTime - this.timeLeft;
            if (elapsed === this.hintInterval) {
                this.hintLevel = 1;
                this.onGameStateChange?.('hint');
            } else if (elapsed === this.hintInterval * 2) {
                this.hintLevel = 2;
                this.onGameStateChange?.('hint');
            }

            this.onTimerUpdate?.(this.timeLeft);

            if (this.timeLeft <= 0) {
                this.endTurn();
            }
        }, 1000);
    }

    // 타이머 중지
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    // 턴 종료
    endTurn() {
        this.stopTimer();
        this.currentTurnIndex++;

        if (this.onGameStateChange) {
            this.onGameStateChange('turnEnd');
        }

        // 1초 후 다음 턴
        setTimeout(() => {
            this.startNewTurn();
        }, 2000);
    }

    // 정답 확인
    checkAnswer(peerId, guess) {
        const player = this.players.get(peerId);
        if (!player) return { correct: false };

        // 그리는 사람은 정답 불가
        if (peerId === this.currentDrawer) {
            return { correct: false };
        }

        // 이미 맞춘 경우
        if (player.hasGuessed) {
            return { correct: false, alreadyGuessed: true };
        }

        // 정답 확인 (대소문자, 공백 무시)
        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedWord = this.currentWord?.toLowerCase();

        if (normalizedWord && normalizedGuess === normalizedWord) {
            // 점수 계산 (빨리 맞출수록 높은 점수)
            const baseScore = 100;
            const timeBonus = Math.floor((this.timeLeft / this.roundTime) * 50);
            const score = baseScore + timeBonus;

            player.score += score;
            player.hasGuessed = true;

            this.onScoreUpdate?.();

            // 모두 맞췄는지 확인 (그리는 사람 제외)
            const allGuessed = Array.from(this.players.values())
                .filter((_, id) => id !== this.currentDrawer)
                .every(p => p.hasGuessed);

            if (allGuessed) {
                this.endTurn();
            }

            return { correct: true, score };
        }

        return { correct: false };
    }

    // 힌트 생성
    getHint() {
        if (!this.currentWord) return '';

        const word = this.currentWord;
        const chars = [...word]; // 유니코드 문자열 올바르게 처리
        const length = chars.length;

        if (this.hintLevel === 0) {
            // 전체 숨김
            return '_ '.repeat(length).trim();
        } else if (this.hintLevel === 1) {
            // 첫 글자 공개
            return chars[0] + ' ' + '_ '.repeat(length - 1).trim();
        } else {
            // 첫 글자와 중간 글자 공개
            const mid = Math.floor(length / 2);
            return chars.map((char, i) =>
                (i === 0 || i === mid) ? char : '_'
            ).join(' ');
        }
    }

    // 게임 종료
    endGame() {
        this.gameState = 'gameEnd';
        this.stopTimer();

        if (this.onGameStateChange) {
            this.onGameStateChange('gameEnd');
        }
    }

    // 내가 그리는 차례인지
    isMyTurn() {
        return this.currentDrawer === this.myPeerId;
    }

    // 순위 가져오기
    getRanking() {
        return Array.from(this.players.entries())
            .map(([peerId, player]) => ({
                peerId,
                nickname: player.nickname,
                score: player.score
            }))
            .sort((a, b) => b.score - a.score);
    }
}
