export const INITIAL_BALANCE = 5;
export const MEAL_COST = 6;
export const WORK_GAIN = 3;
export const TRAINING_COST = 2;
export const TRAINING_BONUS = 5;
export const ROUND_1_DURATION_MS = 120_000;

export type RoomStatus = "lobby" | "in_progress" | "finished";
export type RoundNumber = 0 | 1 | 2 | 3;

export type Phase =
  | "lobby"
  | "round1_open"
  | "round1_paused"
  | "round1_results"
  | "round2_results"
  | "round3_open"
  | "round3_closed"
  | "round3_revealed"
  | "finished";

export type Round1Choice = "work" | "leisure" | "training";
export type VoteChoice = "taxes_all" | "robot_tax" | "wealth_tax";

export type GameErrorCode =
  | "ROOM_NOT_FOUND"
  | "NICKNAME_INVALID"
  | "NICKNAME_TAKEN"
  | "JOIN_CLOSED"
  | "ROUND_NOT_OPEN"
  | "DEADLINE_PASSED"
  | "ALREADY_CHOSEN"
  | "ALREADY_VOTED"
  | "INVALID_PHASE"
  | "INVALID_HOST"
  | "DUPLICATE_TRANSACTION"
  | "CANNOT_SKIP_ROUND"
  | "NEGATIVE_BALANCE"
  | "PARTICIPANT_NOT_FOUND";

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  currentRound: RoundNumber;
  phase: Phase;
  roundStartedAt: number | null;
  roundEndsAt: number | null;
  pausedRemainingMs: number | null;
  votesRevealed: boolean;
  hostTokenHash: string;
  resetGeneration: number;
  createdAt: number;
}

export interface Participant {
  id: string;
  roomId: string;
  nickname: string;
  initialBalance: number;
  currentBalance: number;
  ateMeal: boolean | null;
  isBot: boolean;
  connectedAt: number;
  createdAt: number;
}

export interface Decision {
  id: string;
  roomId: string;
  participantId: string;
  roundNumber: 1;
  choice: Round1Choice;
  createdAt: number;
}

export interface Transaction {
  id: string;
  roomId: string;
  participantId: string;
  roundNumber: RoundNumber;
  amount: number;
  reason: string;
  idempotencyKey: string;
  createdAt: number;
}

export interface Vote {
  id: string;
  roomId: string;
  participantId: string;
  choice: VoteChoice;
  createdAt: number;
}

export interface GameState {
  room: Room;
  participants: Participant[];
  decisions: Decision[];
  transactions: Transaction[];
  votes: Vote[];
}

export interface GameResult<T = GameState> {
  ok: true;
  state: T;
}

export interface GameFailure {
  ok: false;
  error: GameError;
  state: GameState;
}

export type EngineResult = GameResult | GameFailure;
