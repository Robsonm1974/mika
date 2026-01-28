export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface AudioVisualizerData {
  volume: number; // 0 to 1
}

export enum RobotEmotion {
  NEUTRAL = 'NEUTRAL',
  HAPPY = 'HAPPY',
  THINKING = 'THINKING',
  TALKING = 'TALKING',
  LISTENING = 'LISTENING',
  ERROR = 'ERROR'
}