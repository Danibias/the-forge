export type Ceiling = 3 | 4 | 5 | 'exposure';

export interface ConceptEntry {
  concept: string;
  level: number;
  ceiling: Ceiling;
  last_seen: number | null;
}

export interface ExitCriterion {
  text: string;
  met: boolean;
}

export interface Capstone {
  phase: number;
  choice: string;
  status: 'not started' | 'in progress' | 'passed' | 'failed';
  design_pack: string | null;
  plan_vs_built: string | null;
}

export interface TrainingRoom {
  targeting: string;
  progress: number;
  consecutive_fails: number;
}

export interface Ledger {
  learner: string | null;
  goal: string | null;
  constraint: string | null;
  project: string | null;
  metaphor_domain: string | null;
  started: string | null;
  sessions: number;
  hours_logged: number;
  track: string | null;
  week: string | null;
  next_consolidation: string | null;
  phase: string | null;
  exit_criteria: ExitCriterion[];
  on_schedule: string | null;
  mastered: number;
  active: ConceptEntry[];
  retired_metaphors: string[];
  open_loops: string[];
  misconceptions: string[];
  stalls: { concept: string; resolved_by: number; session: number }[];
  demotions: { concept: string; from: number; to: number; reason: string }[];
  capstones: Capstone[];
  gate: string;
  training_room: TrainingRoom | null;
  shipped: string[];
  pathways: { name: string; opened_session: number | null; brought_home: string | null }[];
  wins: string[];
  last_session_mode: string | null;
  labs: { problem: string; verdict: string; posed_by?: string; spike_deleted?: boolean }[];
  last_active: string | null;
  next_session: { target: string | null; first_action: string | null; warmup: string | null };
}

export interface Focus {
  minutes: number;
  pomodoros: number;
}

export interface TranscriptMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface AppState {
  ready: boolean;
  model: string;
  busy: boolean;
  started: boolean;
  onboarded: boolean;
  ledger: Ledger;
  phase_progress: string | null;
  focus: Focus;
  messages: TranscriptMessage[];
}

export type ForgeEvent =
  | { type: 'thinking'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'ledger'; ledger: Ledger }
  | { type: 'usage'; input: number; output: number; cache_read: number }
  | { type: 'done' }
  | { type: 'error'; message: string };
