
export type RecurrenceType = 'once' | 'daily' | 'weekdays' | 'weekends' | 'specific' | 'week' | 'month' | 'period' | 'weekly'; // weekly : même jour chaque semaine, à partir de specificDate

export type PriorityType = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string; // New field
  completedDates: string[]; 
  recurrence: RecurrenceType;
  specificDate?: string;
  startDate?: string; // For period recurrence
  endDate?: string;   // For period recurrence
  stopDate?: string;  // Dernier jour de la récurrence (arrêt volontaire), inclus
  subTasks?: Task[];
  startTime?: string; // Format "HH:mm"
  duration?: number;  // Durée en minutes
  priority?: PriorityType;
  executionNotes?: { [dateKey: string]: string }; // Journal de bord : Date -> Description détaillée
  stackAnchor?: string; // Empilement d'habitudes : "après [ancre]"
  deadline?: string;    // Échéance (date limite), distincte de la date prévue
  labels?: string[];    // Étiquettes (ex. « appel », « courses »)
  doneAt?: string;      // Boîte de tâches : idée réglée sans passer par la Routine
  isHabit?: boolean;    // Suivie comme habitude dans Analytics
}

export interface Block {
  id: string;
  title: string;
  description?: string; // New field
  tasks: Task[];
  recurrence: RecurrenceType;
  specificDate?: string;
  startDate?: string; // For period recurrence
  endDate?: string;   // For period recurrence
  stopDate?: string;  // Dernier jour de la récurrence (arrêt volontaire), inclus
  isCollapsed?: boolean; // New field for UI state
  isLocked?: boolean; // New field for locking state
}

export interface RecurringGoal {
  id: string;
  title: string;
  recurrence: RecurrenceType;
  specificDate?: string;
  startDate?: string;
  endDate?: string;
  stopDate?: string;
  reminderTime?: string; // Format "HH:mm"
}

export interface DayRoutine {
  dailyGoalOverride?: string;
  goalCompleted: boolean;
  note: string;
  reminderTime?: string; // Format "HH:mm"
  reflection?: string;   // Bilan du soir
  mood?: string;         // 'great' | 'good' | 'neutral' | 'bad'
  aiFeedback?: {
    feedback: string;
    focusTomorrow: string;
  };
  blocks?: Block[]; // Copie locale de la structure pour cette journée spécifique (détachement du planning)
}

export interface UserProfile {
  xp: number;
  level: number;
}

export interface AppData {
  days: { [dateKey: string]: DayRoutine };
  blocks: Block[];
  templates: { 
    id: string; 
    name: string; 
    blocks: Block[]; 
    recurringGoals: RecurringGoal[];
    templateGoal?: string;
  }[];
  recurringGoals: RecurringGoal[];
  inboxTasks: Task[];
  userProfile?: UserProfile;
  longTermGoals?: LongTermGoal[];
  weeklyReviews?: { [weekKey: string]: WeeklyReview };
  settings?: AppSettings;
  focusSessions?: FocusSession[];
  skips?: SkipRecord[];
}

// Objectif long terme relié aux habitudes quotidiennes
export interface LongTermGoal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string; // YYYY-MM-DD
  progress: number;    // 0-100 (saisi manuellement)
  createdAt: string;
  color?: string;
}

// Revue hebdomadaire
export interface WeeklyReview {
  weekKey: string;     // ex: "2026-W29"
  wins?: string;
  improve?: string;
  reflection?: string;
  aiFeedback?: { feedback: string; focusNextWeek: string };
  createdAt: string;
}

// Réglages de discipline
export interface AppSettings {
  graceDaysPerWeek?: number; // tolérance de jours manqués avant rupture de série
  navPosition?: 'bottom' | 'left'; // position de la barre d'onglets
  navCollapsed?: boolean;           // barre latérale repliée (icônes seules)
  soundEffects?: boolean;           // retour sonore à la complétion
  simpleMode?: boolean;             // mode journée simplifiée (anti-surcharge)
}

export type TabType = 'routine' | 'stats' | 'schedule' | 'templates' | 'ai' | 'inbox' | 'settings';
export type TimeframeType = 'day' | 'week' | 'month' | 'year' | 'custom';

// Session de concentration (mode Focus)
export interface FocusSession {
  id: string;
  taskId: string;
  taskTitle: string;
  blockTitle?: string;
  date: string;        // YYYY-MM-DD
  durationMin: number; // minutes prévues
  actualMin?: number;  // minutes réellement passées (estimé vs réel)
  completedInTime: boolean;
}

// Tâche sautée avec motif
export interface SkipRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string;
  reason: string;
}
