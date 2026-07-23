# 🗄️ Backend & Database Schema

## 1. In-Memory Data Models (`server/index.js`)

### 1.1 Room Object Schema
```javascript
{
  "roomCode": "A4X9",
  "gameState": "LOBBY | WAITING_ROOM | IN_MATCH | GAME_OVER",
  "lobbyTimer": 30,
  "matchTimer": 180,
  "hunterId": "socket_id_xyz or null",
  "players": {
    "socket_id_1": {
      "id": "socket_id_1",
      "username": "PorkLord101",
      "isBot": false,
      "role": "Runner | Hunter",
      "score": 150,
      "position": { "x": 0.0, "y": 1.0, "z": 0.0 },
      "rotation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 },
      "color": "#ff0055",
      "pose": "quadruped",
      "isStuckToWall": false
    }
  }
}

Event Name,Source,Direction,Payload Structure
joinRoom,Client,→ Server,"{ username, roomCode, isHost, botCount }"
stepOccupantChange,Server,→ Room,"{ currentHunterCandidateId, remainingTime }"
paintUpdate,Client,→ Server,"{ colorHex, bodyPartId }"
poseChange,Client,→ Server,{ poseName }
wallStick,Client,→ Server,"{ isStuck, surfaceNormal }"