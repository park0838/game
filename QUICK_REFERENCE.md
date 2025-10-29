# Quick Reference Guide - Multiplayer Drawing Game

## File Structure

```
/multiplayer-drawing/
├── index.html              # Main HTML structure
├── app.js                  # Main application logic (refactored)
├── game-logic.js           # SketchQuizGame class
├── peer-connection.js      # P2P networking (optimized)
├── style.css               # Comprehensive styles
├── OPTIMIZATION_SUMMARY.md # Detailed optimization report
└── QUICK_REFERENCE.md      # This file
```

---

## Module Overview

### 1. **DOM** (app.js)
Centralized DOM element cache
```javascript
DOM.canvas          // Drawing canvas
DOM.gamePanel       // Main game panel
DOM.chatMessages    // Chat message container
DOM.playerList      // Scoreboard
// ... 20+ cached elements
```

### 2. **state** (app.js)
Application state
```javascript
state.peerConnection  // PeerConnection instance
state.game           // SketchQuizGame instance
state.nickname       // Current user nickname
state.isDrawing      // Drawing state
state.currentColor   // Selected color
state.currentSize    // Brush size
state.remoteCursors  // Map of remote cursors
```

### 3. **utils** (app.js)
Utility functions
```javascript
utils.showStatus(message, type, duration)
utils.initCanvas()
utils.getCanvasPos(event)
utils.addChatMessage(nickname, message, isSystem)
```

### 4. **drawing** (app.js)
Canvas drawing operations
```javascript
drawing.start(event)      // Start drawing
drawing.move(event)       // Continue drawing
drawing.end()             // End drawing
drawing.clear()           // Clear canvas
drawing.handleRemote(data) // Handle remote drawing
```

### 5. **cursor** (app.js)
Remote cursor management
```javascript
cursor.track(event)              // Track local cursor
cursor.updateRemote(id, x, y, color)  // Update remote cursor
cursor.remove(id)                // Remove cursor
```

### 6. **gameUI** (app.js)
Game interface updates
```javascript
gameUI.updateScoreboard()
gameUI.updateTimer(time)
gameUI.updateWordDisplay()
gameUI.showWordChoices(words)
gameUI.updateTurnInfo()
gameUI.updateRoundInfo()
```

---

## Key Functions

### Starting a Game

**Host creates room:**
```javascript
1. User enters nickname
2. Click "새 방 만들기"
3. PeerConnection.createRoom()
4. SketchQuizGame instance created
5. Share room code/link
```

**Player joins:**
```javascript
1. User enters nickname
2. Enter room code
3. Click "방 참가"
4. PeerConnection.joinRoom(roomId)
5. Send player-join message
```

### Game Flow

```
Lobby → Turn Start → Word Selection → Drawing/Guessing → Turn End → Next Turn
                                                            ↓
                                                       Round End → Game End
```

**Turn cycle:**
1. `game.startNewTurn()` - Initialize turn
2. `gameUI.showWordChoices()` - Drawer picks word
3. `game.selectWord()` - Start timer
4. Drawing + Guessing phase
5. `game.endTurn()` - Clean up, next turn

### Drawing Synchronization

**Local drawing:**
```javascript
1. User draws on canvas
2. drawing.start/move/end called
3. Data sent via peerConnection.send()
4. Batched and transmitted
```

**Remote drawing:**
```javascript
1. Receive draw data
2. handleDataReceived() routes to drawing.handleRemote()
3. Canvas updated with remote strokes
```

### Answer Checking

```javascript
1. User types in chat
2. Message sent to all peers
3. game.checkAnswer(peerId, message)
4. If correct: score updated, chat notification
5. If all guessed: turn ends early
```

---

## Performance Tips

### Canvas Optimization
- Canvas context created with `alpha: false`
- Use `beginPath()` before each stroke
- `imageSmoothingEnabled` for better quality

### Network Optimization
- Drawing messages batched at 60fps
- Chat/critical messages sent immediately
- Cursor updates throttled to 50ms

### Memory Management
- Clean up cursors on disconnect
- Clear message queue on disconnect
- Timer cleanup in stopTimer()

---

## Common Tasks

### Adding New Game Feature

1. **Add to game-logic.js** if it's game state
2. **Add to app.js module** if it's UI/interaction
3. **Add styles to style.css**
4. **Update HTML** if needed

Example - Add new drawing tool:
```javascript
// 1. Add to state
state.currentTool = 'pen'; // 'pen' | 'eraser' | 'line' | 'circle'

// 2. Add to drawing module
drawing.drawLine(startPos, endPos) {
    // implementation
}

// 3. Add UI in HTML
<button id="lineToolBtn">Line</button>

// 4. Add event handler
DOM.lineToolBtn.addEventListener('click', () => {
    state.currentTool = 'line';
});
```

### Debugging Network Issues

```javascript
// Enable PeerJS debug mode
this.peer = new Peer({
    ...this._getPeerConfig(),
    debug: 3  // Change from 0 to 3
});

// Log all received messages
peerConnection.onDataReceived = (data, peerId) => {
    console.log('Received:', data.type, data, 'from:', peerId);
    handleDataReceived(data, peerId);
};
```

### Testing Locally

1. Open two browser windows
2. First window: Create room
3. Copy room code
4. Second window: Join with code
5. Test drawing/chat/game flow

**Tips:**
- Use Chrome DevTools throttling for network simulation
- Use responsive mode for mobile testing
- Check console for errors

---

## Message Types

### Drawing Messages
```javascript
{ type: 'draw-start', x, y, color, size }
{ type: 'draw', x, y }
{ type: 'draw-end' }
{ type: 'clear' }
{ type: 'cursor-move', x, y, color }
```

### Game Messages
```javascript
{ type: 'player-join', peerId, nickname }
{ type: 'peer-list', peers: [] }
{ type: 'peer-joined', peerId }
{ type: 'peer-left', peerId }
{ type: 'word-selected', word }
{ type: 'chat', nickname, message }
```

---

## CSS Classes

### State Classes
```css
.active          /* Active tool/color */
.me              /* Current player in scoreboard */
.system          /* System chat message */
.warning         /* Timer warning state */
```

### Component Classes
```css
.modal           /* Modal overlay */
.game-info       /* Game status bar */
.game-area       /* Main game grid */
.scoreboard      /* Player list */
.canvas-section  /* Drawing area */
.chat-section    /* Chat panel */
.player-item     /* Scoreboard entry */
.chat-message    /* Chat message */
```

---

## CSS Variables

```css
--primary: #667eea        /* Main brand color */
--secondary: #4ECDC4      /* Accent color */
--warning: #ff6b6b        /* Warning/error */
--text-dark: #333         /* Text color */
--bg-light: #f8f9fa       /* Light background */
--border: #e0e0e0         /* Border color */
--shadow: 0 10px 30px... /* Box shadow */
--radius: 8px             /* Border radius */
--radius-lg: 15px         /* Large radius */
```

To customize theme:
```css
:root {
    --primary: #your-color;
}
```

---

## Troubleshooting

### Canvas not drawing
1. Check `state.game.isMyTurn()` returns true
2. Verify canvas event listeners attached
3. Check `state.isDrawing` state
4. Verify `state.peerConnection` exists

### Messages not syncing
1. Check `peerConnection.connections.size`
2. Verify connection state (open)
3. Check browser console for errors
4. Test with PeerJS debug enabled

### Game not starting
1. Verify 2+ players connected
2. Check `game.players.size >= 2`
3. Verify host calls `game.startGame()`
4. Check timer is running

### Styles not applied
1. Verify CSS file loaded
2. Check element IDs match
3. Inspect with DevTools
4. Check responsive breakpoints

---

## Browser Compatibility

**Supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- WebRTC
- Canvas 2D
- ES6+ (optional chaining, spread operator)
- CSS Grid/Flexbox
- CSS Variables

**Mobile:**
- Touch events supported
- Responsive design for tablets/phones
- Requires landscape mode for best experience

---

## Performance Benchmarks

**Target Metrics:**
- Canvas FPS: 60fps
- Message latency: <50ms
- Cursor update rate: 20/sec
- Memory usage: <100MB

**Monitoring:**
```javascript
// FPS counter
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
    frames++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        console.log('FPS:', frames);
        frames = 0;
        lastTime = now;
    }
    requestAnimationFrame(measureFPS);
}
measureFPS();
```

---

## Quick Fixes

### Reset game state
```javascript
state.game = new SketchQuizGame();
state.game.setMyInfo(state.peerConnection.peer.id, state.nickname);
```

### Clear canvas
```javascript
ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
```

### Reconnect peer
```javascript
state.peerConnection.disconnect();
state.peerConnection = new PeerConnection();
// Re-setup callbacks and reconnect
```

### Force timer update
```javascript
gameUI.updateTimer(state.game.timeLeft);
```

---

## Development Workflow

1. **Read code**: Start with index.html, then app.js
2. **Test locally**: Two browser windows
3. **Make changes**: Edit relevant module
4. **Refresh**: Hard reload (Cmd+Shift+R)
5. **Test**: Verify in both windows
6. **Commit**: When feature works

**Best practices:**
- Comment complex logic
- Use meaningful variable names
- Keep functions small (<50 lines)
- Test edge cases
- Update this guide when adding features
