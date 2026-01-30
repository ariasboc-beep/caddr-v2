
export type RecurrenceType = 'once' | 'daily' | 'weekdays' | 'weekends' | 'specific' | 'week' | 'month' | 'period';

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
  subTasks?: Task[];
  startTime?: string; // Format "HH:mm"
  duration?: number;  // Durée en minutes
  priority?: PriorityType;
  executionNotes?: { [dateKey: string]: string }; // Journal de bord : Date -> Description détaillée
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
}

export type TabType = 'routine' | 'stats' | 'schedule' | 'templates' | 'ai' | 'inbox';
export type TimeframeType = 'day' | 'week' | 'month' | 'year' | 'custom';
