
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
  completedAt?: { [dateKey: string]: string }; // heure de validation « HH:mm » (analyse des heures productives)
  assignmentId?: string;  // tâche reçue d'un autre utilisateur Caddr (document Firestore « assignments »)
  assignedBy?: string;    // nom ou e-mail de la personne qui l'a confiée
  minVersion?: string;    // version minimale pour les jours difficiles (ex. « 2 min de sport »)
  why?: string;           // raison profonde, rappelée au moment d'hésiter
  identityId?: string;    // identité renforcée par cette tâche (« Je suis une personne sportive »)
  projectId?: string;     // projet dont cette tâche est une étape posée dans la journée
  projectTaskId?: string; // tâche du projet correspondante (cocher ici, c'est cocher là-bas)
}

// ---------- Projets : ce que l'utilisateur construit ----------
export type ProjectStatus = 'active' | 'paused' | 'done' | 'dropped';

/** Étape (phase) d'un projet : « Préparer », « Rédiger », « Déposer le dossier »… */
export interface ProjectStep { id: string; title: string; order: number }

/** Tâche de projet : l'action concrète, qui pourra être posée dans une journée. */
export interface ProjectTask {
  id: string;
  title: string;
  stepId?: string;        // étape à laquelle elle appartient
  note?: string;
  due?: string;           // échéance (AAAA-MM-JJ)
  estimateMin?: number;   // durée estimée, en minutes
  priority?: PriorityType;
  done?: boolean;
  doneAt?: string;        // « AAAA-MM-JJTHH:mm »
  plannedFor?: string;    // jour où elle a été posée dans la routine
  routineTaskId?: string; // tâche de routine créée pour la faire
  createdAt: string;
  order: number;
}

export interface Project {
  id: string;
  title: string;
  why?: string;           // pourquoi ce projet compte
  color?: string;
  status: ProjectStatus;
  createdAt: string;
  startDate?: string;
  dueDate?: string;       // échéance du projet
  goalId?: string;        // objectif de vie servi par ce projet
  identityId?: string;    // identité renforcée (« Je suis quelqu'un qui finit ce qu'il commence »)
  steps: ProjectStep[];
  tasks: ProjectTask[];
  completedAt?: string;
  updatedAt?: string;     // pour la fusion entre appareils
  deleted?: boolean;      // pierre tombale
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
  bonuses?: { [key: string]: { xp: number; label: string; at: string } }; // bonus de discipline déjà attribués
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
  monthlyReviews?: { [monthKey: string]: WeeklyReview }; // même forme ; weekKey contient la clé du mois « AAAA-MM »
  habits?: StandaloneHabit[]; // habitudes indépendantes des blocs (ex. « Ne plus fumer »)
  projects?: Project[];       // projets : étapes et tâches, de A à Z
  settings?: AppSettings;
  focusSessions?: FocusSession[];
  skips?: SkipRecord[];
  taskLog?: TaskEvent[];                     // mouvements de tâches (reports, annulations, imprévus, affectations)
  daySnapshots?: { [dateKey: string]: string[] };
  hardDays?: string[];                       // jours passés en mode « Jour difficile » (AAAA-MM-JJ)
  streakJokers?: string[];                   // jours protégés par un joker de série
  identities?: Identity[];                   // « Qui je deviens » : phrases d'identité
  rewards?: RewardCard[];                    // cartes surprises gagnées lors des journées parfaites // tâches prévues au premier affichage du jour (détection des imprévus)
  journal?: { [dateKey: string]: JournalEntry }; // journal de gratitude et de fierté
  assistantMemory?: AssistantMemoryItem[];      // ce que l'assistant Claude retient (préférences durables)
  lifeReviews?: { [quarterKey: string]: LifeReview }; // revues trimestrielles (roue de la vie), clé « AAAA-Tn »
}

// Objectif long terme relié aux habitudes quotidiennes
export interface LongTermGoal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string; // YYYY-MM-DD
  progress: number;    // 0-100 (saisi manuellement)
  autoProgress?: boolean;   // progression calculée à partir des tâches reliées
  linkedBlocks?: string[];  // titres des blocs reliés
  linkedTasks?: string[];   // identifiants des tâches reliées
  milestones?: Milestone[]; // étapes intermédiaires du plan d'action
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
  coach?: { summary: string; wins: string[]; watch: string[]; actions: string[]; focusNextWeek: string; at: string }; // résumé du coach IA
  createdAt: string;
}

// Réglages de discipline
export interface AppSettings {
  graceDaysPerWeek?: number; // tolérance de jours manqués avant rupture de série
  navPosition?: 'bottom' | 'left'; // position de la barre d'onglets
  navCollapsed?: boolean;           // barre latérale repliée (icônes seules)
  soundEffects?: boolean;           // retour sonore à la complétion
  simpleMode?: boolean;             // mode journée simplifiée (anti-surcharge)
  headerBar?: 'discipline' | 'xp';  // barre d'en-tête : discipline du mois (défaut) ou niveau XP
  carryHiddenOn?: string;           // carte « Pas terminé » masquée ce jour-là (AAAA-MM-JJ)
  weekPlanDone?: string;            // dernière semaine planifiée avec le rituel (clé AAAA-Www)
  weekPlanDismissed?: string;       // rappel du rituel masqué pour cette semaine
  calendars?: ExternalCalendar[];
  smartReminders?: 'off' | 'important' | 'all'; // rappels des tâches à heure fixe non faites
  perfectCelebratedOn?: string;     // écran « journée parfaite » déjà montré ce jour-là
  jokerOfferDismissed?: string;     // proposition de joker masquée (jour concerné)
  features?: { [id: string]: boolean }; // fonctionnalités désactivées (false) dans les Réglages
  motivation?: boolean;             // message de motivation du jour (activé par défaut)
  motivationHiddenOn?: string;      // message du jour masqué ce jour-là
  briefingHiddenOn?: string;        // briefing du matin masqué ce jour-là
  eveningDoneOn?: string;           // bilan du soir fait ce jour-là
  analyticsHidden?: string[];       // sections d'Analytics désactivées
  appMode?: 'essentiel' | 'complet' | 'custom'; // allure de l'app : Essentiel (défaut), Complet, ou personnalisée
  unlocksSeen?: number[];           // paliers de découverte progressive déjà proposés (nombre de jours)
  weeklyTarget?: number;            // objectif de discipline hebdomadaire (%) pour les bonus XP   // agendas externes affichés dans le Planning (lecture seule)
}

export type TabType = 'routine' | 'stats' | 'schedule' | 'templates' | 'ai' | 'inbox' | 'settings' | 'habits' | 'journal' | 'goals' | 'projects';
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
  kind?: 'skip' | 'cancel' | 'postpone' | 'assign'; // absent = sautée (ancien format)
}

export interface Identity { id: string; text: string; createdAt: string; deleted?: boolean }
export interface RewardCard { id: string; cardId: string; date: string }

// Journal des mouvements de tâches (rapports PDF) : reports, annulations, imprévus, affectations
export type TaskEventKind = 'postponed' | 'cancelled' | 'unplanned' | 'assigned';
export interface TaskEvent {
  id: string;
  kind: TaskEventKind;
  taskId: string;
  taskTitle: string;
  date: string;          // jour concerné (AAAA-MM-JJ)
  to?: string;           // report : nouveau jour
  newTaskId?: string;    // report d'une tâche récurrente : id de la copie ponctuelle
  reason?: string;       // annulation : motif ; affectation : message
  email?: string;        // affectation : destinataire
  assignmentId?: string; // affectation : document Firestore
  status?: 'pending' | 'accepted' | 'declined' | 'done'; // affectation : suivi
  at: string;            // horodatage ISO
}

// Habitude indépendante des blocs et des tâches (inspirée d'HabitNow)
export type HabitDayStatus = 'done' | 'fail' | 'skip';
export interface HabitEntry { s?: HabitDayStatus; note?: string }
export interface StandaloneHabit {
  id: string;
  name: string;
  kind: 'build' | 'quit';     // build = prendre une habitude ; quit = arrêter (ex. fumer)
  days?: number[];            // jours prévus (0 = dimanche … 6 = samedi) ; vide = tous les jours
  startDate: string;          // AAAA-MM-JJ
  endDate?: string;           // AAAA-MM-JJ ; dernier jour prévu (habitude à durée limitée) ; vide = pas de fin
  description?: string;
  color?: string;             // couleur d'accent de l'habitude (hex)
  createdAt: string;
  archived?: boolean;
  showInRoutine?: boolean;    // afficher dans la carte « Habitudes du jour » de Routine (par défaut : oui)
  deleted?: boolean;          // suppression conservée pour la synchro (sinon le cloud la ferait revenir)
  entries: { [dateKey: string]: HabitEntry };
}

// Agenda externe (Google, Outlook, iCloud…) importé au format iCalendar (.ics)
export interface ExternalCalendar {
  id: string;
  name: string;
  color: string;
  url?: string;          // adresse ICS (actualisée automatiquement)
  hidden?: boolean;
  events?: ExtEventRaw[]; // événements d'un fichier importé (synchronisés)
  updatedAt?: string;
}
export interface ExtEventRaw {
  uid: string;
  title: string;
  start: string;          // ISO local « AAAA-MM-JJTHH:mm » ou « AAAA-MM-JJ » (journée entière)
  end?: string;
  allDay?: boolean;
  location?: string;
  rrule?: string;
  exdates?: string[];     // occurrences exclues (même format que start)
}

// Journal de gratitude et de fierté (3 + 3 par jour)
export interface JournalEntry {
  gratitude: string[];   // 3 choses pour lesquelles je ressens de la gratitude
  pride: string[];       // 3 choses dont je suis fier·e
  note?: string;         // phrase libre pour retenir la journée
  updatedAt: string;     // ISO, sert à la fusion entre appareils
}

// Étape d'un objectif long terme
export interface Milestone { id: string; title: string; date?: string; done?: boolean }

// Préférence durable retenue par l'assistant (« pas de travail après 21 h »…)
export interface AssistantMemoryItem { id: string; text: string; createdAt: string; deleted?: boolean }

// Revue trimestrielle : note de 1 à 10 par domaine de vie
export interface LifeReview {
  quarter: string;                       // « 2026-T4 »
  scores: { [domain: string]: number };
  notes?: { [domain: string]: string };
  focus?: string[];                      // domaines choisis comme priorités du trimestre
  createdAt: string;
  updatedAt: string;
}
