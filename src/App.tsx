
import { HiddenSectionsContext, ANALYTICS_SECTIONS } from './components/Section';
import { brandColor } from './palette';
import { perfColor, perfStyle } from './perfScale';
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { lazyRetry, prefetchTabs } from './lazyRetry';
import { snapshot } from './backups';
import BackupsPanel from './components/BackupsPanel';
const Assistant = lazyRetry(() => import('./components/Assistant'));
import { occurrencesBetween } from './icsImport';
import { devAssistant } from './services/assistantService';
import MorningBriefing from './components/MorningBriefing';
import { computeBriefing } from './briefing';
const EveningReview = lazyRetry(() => import('./components/EveningReview'));
const LifeWheel = lazyRetry(() => import('./components/LifeWheel'));
import { PROMPTS } from './assistant/prompts';
import { lateTasks, alreadyReminded, markReminded, notifyLate } from './reminders';
import { executeTool } from './assistant/tools';
import { 
  Check, ChevronLeft, ChevronRight, Target, 
  Plus, Trash2, Layout, BarChart3, 
  Circle, Calendar, Repeat, X, 
  TrendingUp, Save, Copy, Cloud, 
  Loader2, Sparkles, BrainCircuit, 
  ArrowRight, Camera, Wand2, Zap,
  ChevronUp, ChevronDown, CalendarDays, GripVertical, Link2, CalendarRange,
  History, MoveVertical, Minimize2, Clock, ListPlus,
  ChevronRightSquare, Bell, BellRing, BellOff, Timer, AlarmClock,
  ClipboardCheck, Smile, Meh, Frown, Laugh, Star, Flame, Trophy,
  ListChecks, Search, AlertCircle, Quote, Archive, Inbox, Send,
  Lock, LockOpen, User, LogOut, ShieldCheck, Mail, Key, Settings2, Info,
  Download, Upload, Power, Pencil, Edit3, PieChart, FileText,
  CalendarClock, ArrowUpCircle, BookOpen, PenTool, Crown, Swords,
  Medal, Sun, Moon, RotateCcw, CloudOff, SkipForward, Hourglass, Lightbulb, MoreHorizontal, BookHeart
} from 'lucide-react';
import { AppData, Block, TabType, RecurrenceType, TimeframeType, RecurringGoal, Task, PriorityType, DayRoutine, UserProfile } from './types';
import { getKeyFromDate, generateId, isDateInRange } from './utils';
import { getRoutineAdvice, generateRoutineFromGoal, extractRoutineFromImage, getDailyReviewFeedback, getLightenPlan, getWeeklyCoach } from './services/geminiService';
import { 
  signInWithGoogle, 
  completeRedirectSignIn,
  authErrorMessage,
  isIOS,
  signOut as firebaseSignOut, 
  onAuthChange, 
  saveDataToCloud, 
  loadDataFromCloud,
  mergeAppData
} from './services/syncService';
const MoodPerfChart = lazyRetry(() => import('./components/MoodPerfChart'));
const Badges = lazyRetry(() => import('./components/Badges'));
import FocusMode from './components/FocusMode';
import InboxView from './components/InboxView';
const Analytics = lazyRetry(() => import('./components/Analytics'));
import { Section } from './components/Section';
const Reviews = lazyRetry(() => import('./components/Reviews'));
import AuthPanel from './components/AuthPanel';
const HabitsView = lazyRetry(() => import('./components/HabitsView'));
import { DayDot } from './components/DayDot';
import { activeHabits, isScheduled as habitScheduled, stateOn as habitStateOn, habitStats as computeHabitStats, labelsFor as habitLabels } from './habits';
import LongTermGoals from './components/LongTermGoals';
const FocusStats = lazyRetry(() => import('./components/FocusStats'));
const Insights = lazyRetry(() => import('./components/Insights'));
import Agenda from './components/Agenda';
import { computePeriod, getPeriod, trackingStart, computeDay } from './analytics';
const JournalView = lazyRetry(() => import('./components/JournalView'));
import { isWritten as journalWritten } from './journal';
import CarryOver from './components/CarryOver';
const WeekPlanner = lazyRetry(() => import('./components/WeekPlanner'));
import { plannerWeeks } from './plannerWeeks';
const CalendarsPanel = lazyRetry(() => import('./components/CalendarsPanel'));
import { useCalendars } from './useCalendars';
import CoachCard from './components/CoachCard';
import { weekCoachPayload } from './coach';
import { dueBonuses, XP_RULES, WEEK_TARGET } from './xpBonus';
import { relocateTask, addOneOff, sendToInbox, pendingOneOffs } from './reschedule';
const AnnualReview = lazyRetry(() => import('./components/AnnualReview'));
import LandingPage from './components/LandingPage';
import RichText, { RichTextView, sanitizeHtml, stripHtml } from './components/RichText';
import NowNext from './components/NowNext';
import { playCompletionFeedback } from './feedback';
import { STARTER_TEMPLATES } from './starterTemplates';
import { downloadICS } from './ics';
import { computePerfectStreakWithGrace, getWeekKey } from './streaks';
import { enablePush } from './push';
import { parseCapture } from './nlParse';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Sortable } from './components/Sortable';
import { useResizableWidth, useResizableHeight, SideResizeHandles, BottomResizeHandle } from './components/ResizeHandles';
import type { User as FirebaseUser } from 'firebase/auth';

const STORAGE_KEY = 'caddr_routine_v6_timing';
const APP_VERSION = '2026.07.18 — éditeur enrichi (listes, checklist, liens, images)';
const THEME_KEY = 'caddr_theme_preference';
const ACCENT_KEY = 'caddr_accent_preference';

// Thèmes d'accent — { rgb pour Tailwind/CSS, hex pour recharts/PDF }
export type AccentTheme = 'teal';
// Charte Caddr : teal comme seule couleur principale
const THEMES: Record<AccentTheme, { label: string; rgb: string; hex: string }> = {
  teal:   { label: 'Teal',   rgb: '47 176 166',  hex: '#2FB0A6' },
};

// XP Constants
// Coche / décoche une tâche pour un jour ; l'heure de validation est notée (jour même
// uniquement) pour l'analyse « heures productives ».
function flipCompletion(t: Task, k: string): Task {
  const completed = t.completedDates || [];
  const was = completed.includes(k);
  const at = { ...(t.completedAt || {}) };
  if (was) delete at[k];
  else if (k === getKeyFromDate(new Date())) { const n = new Date(); at[k] = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; }
  return { ...t, completedDates: was ? completed.filter(d => d !== k) : [...completed, k], completedAt: Object.keys(at).length ? at : undefined };
}

const XP_TASK = 15;
const XP_SUBTASK = 5;
const XP_GOAL = 50;
const LEVEL_CONSTANT = 50; // Formula: Level = sqrt(XP / CONSTANT) + 1

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<TabType>('routine');
  const [appData, setAppData] = useState<AppData>({ days: {}, blocks: [], templates: [], recurringGoals: [], inboxTasks: [], userProfile: { xp: 0, level: 1 } });
  const [history, setHistory] = useState<AppData[]>([]); // Undo Stack
  const [isLoading, setIsLoading] = useState(true);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    try { return localStorage.getItem('caddr_guest') === '1'; } catch { return false; }
  });
  const enterGuest = () => { try { localStorage.setItem('caddr_guest', '1'); } catch {} setGuestMode(true); };
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showMoreNav, setShowMoreNav] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>('teal');

  // Firebase/Sync States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Inbox Local State
  const [newInboxTitle, setNewInboxTitle] = useState("");
  const [transferTask, setTransferTask] = useState<Task | null>(null);
  // Fenêtre « Déployer la tâche » : quand, dans quel bloc, ou nouveau bloc
  type DeployWhen = 'today' | 'tomorrow' | 'date' | 'daily' | 'weekdays' | 'weekends' | 'week' | 'month' | 'period' | 'weekly';
  const [deployWhen, setDeployWhen] = useState<DeployWhen>('today');
  const [deployDate, setDeployDate] = useState('');
  const [deployStart, setDeployStart] = useState('');
  const [deployEnd, setDeployEnd] = useState('');
  const [deployBlockId, setDeployBlockId] = useState<string | null>(null);
  const [deployNewBlock, setDeployNewBlock] = useState<string | null>(null); // null = pas de création en cours

  // Reschedule State
  const [rescheduleModal, setRescheduleModal] = useState<{ task: Task, blockId: string, parentTaskId?: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Logbook State (Journal de bord)
  const [logModal, setLogModal] = useState<{ task: Task, blockId: string, parentTaskId?: string } | null>(null);
  const [currentLogText, setCurrentLogText] = useState("");

  // Notification States
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');
  const [planningView, setPlanningView] = useState<'day' | 'week'>('day');
  const [showWeekPlanner, setShowWeekPlanner] = useState(false);
  const [showCalendars, setShowCalendars] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [showEvening, setShowEvening] = useState(false);
  const [tplApply, setTplApply] = useState<{ key: string; mode: 'always' | 'period'; days: number } | null>(null);
  const [routineIdea, setRoutineIdea] = useState('');
  const askClaude = (prompt: string) => { setAssistantPrompt(prompt); setShowAssistant(true); };
  const [daysAway, setDaysAway] = useState<number | null>(null);
  const [showFullResetModal, setShowFullResetModal] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [keepTemplates, setKeepTemplates] = useState(true);
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  const toggleTaskCollapse = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  const lastNotifiedRef = useRef<string | null>(null);

  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isReviewAiLoading, setIsReviewAiLoading] = useState(false);

  // Analytics State
  const [statsTimeframe, setStatsTimeframe] = useState<TimeframeType>('week');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: getKeyFromDate(new Date(Date.now() - 30 * 86400000)),
    end: getKeyFromDate(new Date())
  });
  
  // AI States
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [showAiGen, setShowAiGen] = useState(false);
  
  // Modals & Editing
  const [configModal, setConfigModal] = useState<{ type: 'block' | 'task' | 'goal', id: string, blockId?: string, parentTaskId?: string } | null>(null);
  // Fenêtres redimensionnables (taille mémorisée sur l'appareil)
  const configSize = useResizableWidth('caddr_config_width', 384);
  const logSize = useResizableWidth('caddr_log_width', 384);
  const logEditor = useResizableHeight('caddr_log_editor_height', 200);
  const deploySize = useResizableWidth('caddr_deploy_width', 448);
  // Fenêtre « Sauter aujourd'hui » (remplace le prompt natif du navigateur)
  const [skipModal, setSkipModal] = useState<{ taskId: string, taskTitle: string } | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTplName, setNewTplName] = useState("");
  const [newTplGoal, setNewTplGoal] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetArchiveName, setResetArchiveName] = useState("");

  // RPG State
  const [showLevelUpModal, setShowLevelUpModal] = useState<number | null>(null);
  
  // Template Editing Full Mode
  const [templateEditState, setTemplateEditState] = useState<{
    originalBlocks: Block[];
    originalGoals: RecurringGoal[];
    templateId: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Vrai seulement après une lecture réussie du cloud : tant que c'est faux, on n'envoie
  // rien au cloud (sinon les données de l'appareil écraseraient celles du compte).
  const cloudReady = useRef(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const dateKey = getKeyFromDate(currentDate);

  // Sauvegarde automatique locale : au plus toutes les 5 minutes, 20 s après une modification
  const lastSnap = useRef(0);
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      if (Date.now() - lastSnap.current < 5 * 60 * 1000) return;
      lastSnap.current = Date.now();
      snapshot(appData).catch(() => { /* stockage indisponible */ });
    }, 20000);
    return () => clearTimeout(t);
  }, [appData, isLoading]);

  // Assistante Cady : état le plus récent + raccourci Ctrl/Cmd + K
  const appDataRef = useRef(appData);
  appDataRef.current = appData;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowAssistant(v => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Onglets chargés à la demande : préchargés en arrière-plan après le démarrage
  useEffect(() => {
    prefetchTabs([() => import('./components/Analytics'), () => import('./components/HabitsView'), () => import('./components/JournalView'),
      () => import('./components/WeekPlanner'), () => import('./components/Reviews'), () => import('./components/CalendarsPanel')]);
  }, []);

  // Erreurs de l'IA (non connecté, quota atteint, réseau…) → notification lisible
  useEffect(() => {
    const onAiError = (e: Event) => { setActiveNotification((e as CustomEvent).detail || "L'IA est indisponible."); setTimeout(() => setActiveNotification(null), 5000); };
    window.addEventListener('caddr-ai-error', onAiError);
    return () => window.removeEventListener('caddr-ai-error', onAiError);
  }, []);

  // Initialize Firebase Auth & Load Data
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const cloudData = await loadDataFromCloud(firebaseUser.uid);
          
          if (cloudData) {
            // Fusion intelligente : ne perd ni les données locales ni celles du cloud
            const localRaw = localStorage.getItem(STORAGE_KEY);
            if (localRaw) {
              try {
                const parsedLocal = JSON.parse(localRaw);
                if (!parsedLocal.inboxTasks) parsedLocal.inboxTasks = [];
                if (!parsedLocal.userProfile) parsedLocal.userProfile = { xp: 0, level: 1 };
                const merged = mergeAppData(parsedLocal, cloudData);
                setAppData(merged);
                await saveDataToCloud(firebaseUser.uid, merged);
                console.log('Loaded data from cloud (merged with local)');
              } catch {
                setAppData(cloudData);
              }
            } else {
              setAppData(cloudData);
              console.log('Loaded data from cloud');
            }
          } else {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              const parsedLocal = JSON.parse(localData);
              if (!parsedLocal.inboxTasks) parsedLocal.inboxTasks = [];
              if (!parsedLocal.userProfile) parsedLocal.userProfile = { xp: 0, level: 1 };
              setAppData(parsedLocal);
              await saveDataToCloud(firebaseUser.uid, parsedLocal);
              console.log('Migrated local data to cloud');
            } else {
              const initialData = {
                days: {},
                blocks: [],
                templates: [],
                recurringGoals: [],
                inboxTasks: [],
                userProfile: { xp: 0, level: 1 }
              };
              setAppData(initialData);
            }
          }
          setLastSyncTime(new Date());
          cloudReady.current = true;
        } catch (error) {
          console.error('Error loading cloud data:', error);
          cloudReady.current = false;
          setSyncError('Sync en attente');
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) {
            const parsedLocal = JSON.parse(localData);
            if (!parsedLocal.inboxTasks) parsedLocal.inboxTasks = [];
            if (!parsedLocal.userProfile) parsedLocal.userProfile = { xp: 0, level: 1 };
            setAppData(parsedLocal);
          }
        }
      } else {
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
          const parsedLocal = JSON.parse(localData);
          if (!parsedLocal.inboxTasks) parsedLocal.inboxTasks = [];
          if (!parsedLocal.userProfile) parsedLocal.userProfile = { xp: 0, level: 1 };
          setAppData(parsedLocal);
        } else {
          setAppData({
            days: {},
            blocks: [],
            templates: [],
            recurringGoals: [],
            inboxTasks: [],
            userProfile: { xp: 0, level: 1 }
          });
        }
      }
      
      setIsLoading(false);
    });

    const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }

    const savedAccent = localStorage.getItem(ACCENT_KEY) as AccentTheme;
    if (savedAccent && THEMES[savedAccent]) setAccentTheme(savedAccent);

    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    return () => unsubscribe();
  }, []);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Apply Accent Theme (couleur d'accent pilotée par variables CSS)
  useEffect(() => {
    const root = window.document.documentElement;
    const t = THEMES[accentTheme] || THEMES.teal;
    root.style.setProperty('--accent-rgb', t.rgb);
    root.style.setProperty('--accent', t.hex);
    localStorage.setItem(ACCENT_KEY, accentTheme);
  }, [accentTheme]);

  // Raccourcis d'écran d'accueil (PWA) : ouvre l'onglet demandé via ?tab=
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    const valid: TabType[] = ['routine', 'stats', 'schedule', 'templates', 'ai', 'inbox', 'settings', 'habits', 'journal'];
    if (tab && valid.includes(tab as TabType)) setActiveTab(tab as TabType);
  }, []);

  // Retour en douceur : détecte une absence de plusieurs jours
  useEffect(() => {
    try {
      const todayKey = getKeyFromDate(new Date());
      const last = localStorage.getItem('caddr_last_active');
      if (last && last !== todayKey) {
        const gap = Math.round((new Date(todayKey + 'T00:00:00').getTime() - new Date(last + 'T00:00:00').getTime()) / 86400000);
        if (gap >= 3) setDaysAway(gap);
      }
      localStorage.setItem('caddr_last_active', todayKey);
    } catch {}
  }, []);

  const accentHex = (THEMES[accentTheme] || THEMES.teal).hex;
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const graceDays = appData.settings?.graceDaysPerWeek ?? 1;
  const navPosition = appData.settings?.navPosition || 'bottom';
  const navCollapsed = appData.settings?.navCollapsed || false;
  const navTabs = [
    { id: 'routine', icon: Layout, label: 'Routine' },
    { id: 'habits', icon: Repeat, label: 'Habitudes' },
    { id: 'schedule', icon: CalendarDays, label: 'Planning' },
    { id: 'inbox', icon: Archive, label: 'Boîte' },
    { id: 'journal', icon: BookHeart, label: 'Journal' },
    { id: 'ai', icon: BrainCircuit, label: 'Caddr. IA' },
    { id: 'templates', icon: Copy, label: 'Modèles' },
    { id: 'stats', icon: BarChart3, label: 'Analytics' },
    { id: 'settings', icon: Settings2, label: 'Réglages' },
  ] as const;

  // Lecture du cloud ratée (réseau) : nouvel essai automatique (retour du réseau, toutes les 30 s)
  useEffect(() => {
    if (!user || isLoading || cloudReady.current) return;
    let stop = false;
    const retry = async () => {
      if (stop || cloudReady.current) return;
      try {
        const cloud = await loadDataFromCloud(user.uid);
        if (stop) return;
        if (cloud) setAppData(prev => mergeAppData(prev, cloud));
        cloudReady.current = true;
        setSyncError(null);
        setLastSyncTime(new Date());
      } catch { /* on réessaiera */ }
    };
    const id = setInterval(retry, 30000);
    window.addEventListener('online', retry);
    return () => { stop = true; clearInterval(id); window.removeEventListener('online', retry); };
  }, [user, isLoading, syncError]);

  // Auto-save to cloud when user is signed in
  useEffect(() => {
    if (!user || isLoading || !cloudReady.current) return;

    if (!isOnline) return; // hors ligne : les données restent sur l'appareil, envoi au retour du réseau
    setIsSaving(true);
    const saveTimer = setTimeout(async () => {
      try {
        await saveDataToCloud(user.uid, appData);
        setLastSyncTime(new Date());
        setSyncError(null);
      } catch (error) {
        console.error('Error auto-saving to cloud:', error);
        setSyncError('Erreur de sync');
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => { clearTimeout(saveTimer); setIsSaving(false); };
  }, [appData, user, isLoading, isOnline]);

  // Sync current time
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Save on update
  useEffect(() => {
    if (!isLoading) {
      setIsSyncing(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      const timer = setTimeout(() => setIsSyncing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [appData, isLoading]);

  // Reminder Engine
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTimeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (lastNotifiedRef.current === currentTimeString) return;
      const today = new Date();
      const dKey = getKeyFromDate(today);
      const dayData = appData.days[dKey];
      const recurring = (appData.recurringGoals || []).filter(g => isDateInRange(today, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate));
      const matchingGoal = recurring.find(g => g.reminderTime === currentTimeString);
      const matchingOverride = dayData?.reminderTime === currentTimeString ? { title: dayData.dailyGoalOverride || "Objectif Prioritaire" } : null;
      const target = matchingGoal || matchingOverride;
      if (target) {
        lastNotifiedRef.current = currentTimeString;
        setActiveNotification(target.title || "Rappel Caddr.");
        if (notificationsEnabled && Notification.permission === 'granted') {
          new Notification("Objectif Caddr.", { body: `C'est l'heure de : ${target.title}` });
        }
        setTimeout(() => setActiveNotification(null), 10000);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [appData, notificationsEnabled]);

  const updateAppData = (updater: (prev: AppData) => AppData) => setAppData(prev => updater(prev));

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- LOGIC: UNDO SYSTEM ---
  const saveToHistory = () => {
    setHistory(prev => {
        const newHistory = [...prev, JSON.parse(JSON.stringify(appData))];
        // Limit history to 20 steps to save memory
        return newHistory.slice(-20);
    });
  };

  const handleUndo = () => {
    setHistory(prev => {
        if (prev.length === 0) return prev;
        const newHistory = [...prev];
        const previousState = newHistory.pop();
        if (previousState) {
            setAppData(previousState);
            setActiveNotification("Action annulée");
            setTimeout(() => setActiveNotification(null), 2000);
        }
        return newHistory;
    });
  };

  // --- LOGIC: RPG & GAMIFICATION ---
  const calculateLevel = (xp: number) => Math.floor(Math.sqrt(xp / LEVEL_CONSTANT)) + 1;
  
  const getNextLevelXp = (level: number) => {
    return Math.pow(level, 2) * LEVEL_CONSTANT;
  };

  const getRankTitle = (level: number) => {
      if (level < 5) return "Novice";
      if (level < 10) return "Initié";
      if (level < 15) return "Disciple";
      if (level < 20) return "Adepte";
      if (level < 30) return "Expert";
      if (level < 40) return "Maître";
      if (level < 50) return "Grand Maître";
      if (level < 75) return "Sage";
      if (level < 100) return "Légende";
      return "Divinité";
  };

  const handleXpGain = (prevProfile: UserProfile | undefined, amount: number): { profile: UserProfile, leveledUp: boolean } => {
      const currentXp = prevProfile?.xp || 0;
      const currentLevel = prevProfile?.level || 1;
      
      const newXp = Math.max(0, currentXp + amount);
      const newLevel = calculateLevel(newXp);
      
      return {
          profile: { ...(prevProfile || {}), xp: newXp, level: newLevel },
          leveledUp: newLevel > currentLevel
      };
  };

  // --- LOGIC: UTILS ---
  const handleManualSave = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        setActiveNotification("Données enregistrées avec succès !");
    } catch (e) {
        setActiveNotification("Erreur lors de la sauvegarde.");
    }
    setTimeout(() => setActiveNotification(null), 3000);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caddr_backup_${getKeyFromDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.blocks && json.days) {
          saveToHistory(); // Save before import
          updateAppData(() => json);
          alert("Données importées avec succès !");
        } else {
          throw new Error("Format JSON invalide");
        }
      } catch (err) {
        alert("Erreur lors de l'importation : Veuillez sélectionner un fichier de sauvegarde Caddr. valide.");
      }
      if (backupInputRef.current) backupInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleDownloadPDF = async () => {
    // jsPDF n'est chargé qu'au moment de l'export (allège le démarrage de l'app)
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const now = new Date();
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const stats = getPerfForRange(startOfMonth, endOfMonth);
    doc.setFontSize(22);
    const [ar,ag,ab] = accentHex.match(/\w\w/g)!.map(x=>parseInt(x,16)); doc.setTextColor(ar, ag, ab);
    doc.text("Caddr.", 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(200, 200, 200);
    doc.text(`Rapport Mensuel - ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`, 14, 30);
    doc.setDrawColor(230, 230, 230);
    doc.line(14, 35, 196, 35);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Résumé Global", 14, 45);
    const statsData = [
        ['Moyenne de complétion', `${stats.avg}%`],
        ['Tâches terminées', `${stats.totalDoneCount}`],
        ['Meilleure série (Streak)', `${stats.streakCount} jours`],
        ['Meilleur jour', `${new Date(stats.bestDay.date || now).toLocaleDateString('fr-FR', {day: 'numeric'})} (${stats.bestDay.val}%)`]
    ];
    autoTable(doc, {
        startY: 50,
        head: [['Métrique', 'Valeur']],
        body: statsData,
        theme: 'grid',
        headStyles: { fillColor: accentHex.match(/\w\w/g)!.map(x=>parseInt(x,16)) as [number,number,number] },
        styles: { font: "helvetica" }
    });
    const finalYAfterStats = (doc as any).lastAutoTable.finalY || 50;
    doc.text("Performance par Bloc", 14, finalYAfterStats + 15);
    const blockRows = stats.sortedBlockStats.map(b => [b.title, `${b.rate}%`, `${b.fullyValidated}/${b.totalAppearances}`]);
    if (blockRows.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Aucune donnée de bloc pour ce mois.", 14, finalYAfterStats + 25);
    } else {
        autoTable(doc, {
            startY: finalYAfterStats + 20,
            head: [['Bloc', 'Taux de réussite (100%)', 'Validés / Total']],
            body: blockRows,
            theme: 'striped',
            headStyles: { fillColor: [8, 7, 8] },
        });
    }
    const finalYAfterBlocks = (doc as any).lastAutoTable.finalY || (finalYAfterStats + 30);
    let dailyStartY: number;
    if (finalYAfterBlocks > 220) {
        doc.addPage();
        doc.text("Journal Quotidien", 14, 20);
        dailyStartY = 25;
    } else {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Journal Quotidien", 14, finalYAfterBlocks + 15);
        dailyStartY = finalYAfterBlocks + 20;
    }
    const dailyRows: (string | number)[][] = [];
    const loopDate = new Date(startOfMonth);
    const limitDate = new Date() < endOfMonth ? new Date() : endOfMonth; // Don't show future days if current month
    while (loopDate <= limitDate) {
        const dKey = getKeyFromDate(loopDate);
        const dayData = appData.days[dKey];
        const dayStats = stats.history.find(h => h.date === dKey);
        if (dayStats) {
            dailyRows.push([
                loopDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                `${dayStats.val}%`,
                dayData?.dailyGoalOverride || (dayData?.goalCompleted ? "Objectif validé" : "-"),
                dayData?.mood || '-'
            ]);
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }
    autoTable(doc, {
        startY: dailyStartY,
        head: [['Date', 'Score', 'Focus / Note', 'Humeur']],
        body: dailyRows,
        theme: 'plain',
        headStyles: { fillColor: [200, 200, 200], textColor: 50 },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 20 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 30 }
        }
    });
    doc.save(`caddr_rapport_${monthKey}.pdf`);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  // --- LOGIC: TASKS TIMING ---
  const isTaskActive = (task: Task) => {
    if (!task.startTime) return false;
    const [h, m] = task.startTime.split(':').map(Number);
    const start = new Date(currentTime);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + (task.duration || 0));
    return currentTime >= start && currentTime <= end;
  };

  const formatTaskTime = (startTime: string, duration?: number) => {
    if (!startTime) return "";
    if (!duration) return startTime;
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    const end = new Date(date);
    end.setMinutes(date.getMinutes() + duration);
    return `${startTime} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  const getPriorityInfo = (priority?: PriorityType) => {
    switch (priority) {
      case 'high': return { color: 'text-[#DF2935]', bg: 'bg-[#DF2935]/10', label: 'Haute' };
      case 'medium': return { color: 'text-[#FDCA40]', bg: 'bg-[#FDCA40]/10', label: 'Moyenne' };
      case 'low': return { color: 'text-[#18181B]/50 dark:text-[#E6E8E6]/50', bg: 'bg-[#18181B]/10 dark:bg-[#E6E8E6]/10', label: 'Basse' };
      default: return { color: 'text-[#18181B]/60 dark:text-[#E6E8E6]/60', bg: 'bg-[#18181B]/5 dark:bg-[#080708]/50', label: 'Moyenne' };
    }
  };

  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'great': return <Laugh className="text-accent" size={20} />; 
      case 'good': return <Smile className="text-[#18181B] dark:text-[#E6E8E6]" size={20} />; 
      case 'neutral': return <Meh className="text-[#FDCA40]" size={20} />; 
      case 'bad': return <Frown className="text-[#DF2935]" size={20} />; 
      default: return null;
    }
  };

  // --- LOGIC: GOALS ---
  const currentGoal = useMemo(() => {
    const dayData = appData.days[dateKey];
    if (dayData?.dailyGoalOverride) return dayData.dailyGoalOverride;
    const recurring = (appData.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate));
    return recurring?.title || "";
  }, [appData.days, appData.recurringGoals, dateKey, currentDate]);

  const currentDayData = useMemo(() => {
    return appData.days[dateKey] || { goalCompleted: false, note: "" } as DayRoutine;
  }, [appData.days, dateKey]);

  const currentGoalReminder = useMemo(() => {
    const dayData = appData.days[dateKey];
    if (dayData?.reminderTime) return dayData.reminderTime;
    const recurring = (appData.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate));
    return recurring?.reminderTime || "";
  }, [appData.days, appData.recurringGoals, dateKey, currentDate]);

  // --- LOGIC: VISIBLE ITEMS ---
  const routineBlocks = useMemo(() => {
    if (appData.days[dateKey]?.blocks) {
      // La récurrence d'un bloc s'applique aussi aux jours « figés »
      return appData.days[dateKey].blocks!.filter(b => isDateInRange(currentDate, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
    }
    return appData.blocks.filter(b => isDateInRange(currentDate, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
  }, [appData.blocks, appData.days, dateKey, currentDate]);

  const getVisibleTasks = useCallback((tasks: Task[]) => {
    return (tasks || []).filter(t => isDateInRange(currentDate, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate));
  }, [currentDate]);

  // Tâches ponctuelles des 7 derniers jours restées non faites (carte « Pas terminé »)
  const todayKeyNow = getKeyFromDate(currentTime);
  const pendingItems = useMemo(() => {
    if (appData.settings?.carryHiddenOn === todayKeyNow) return [];
    const from = new Date(todayKeyNow + 'T12:00:00'); from.setDate(from.getDate() - 7);
    const y = new Date(todayKeyNow + 'T12:00:00'); y.setDate(y.getDate() - 1);
    const start = getKeyFromDate(from) > trackingStart(appData) ? getKeyFromDate(from) : trackingStart(appData);
    if (start > getKeyFromDate(y)) return [];
    return pendingOneOffs(appData, start, getKeyFromDate(y));
  }, [appData, todayKeyNow]);

  // Agendas externes (Google, Outlook, iCloud) affichés dans le Planning
  const externalCalendars = useMemo(() => appData.settings?.calendars || [], [appData.settings?.calendars]);
  const cal = useCalendars(externalCalendars);
  const setCalendars = (cals: typeof externalCalendars) => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), calendars: cals } }));

  // Rituel du dimanche / lundi : « Planifier ma semaine »
  const weekPlan = useMemo(() => plannerWeeks(currentTime), [todayKeyNow]); // eslint-disable-line react-hooks/exhaustive-deps
  const showWeekPlanPrompt = (currentTime.getDay() === 0 || currentTime.getDay() === 1)
    && appData.settings?.weekPlanDone !== weekPlan.planKey && appData.settings?.weekPlanDismissed !== weekPlan.planKey;

  // Journal : ce qui a été accompli un jour donné (suggestions de fiertés)
  const journalDoneOn = useCallback((k: string) => {
    const titles = computeDay(appData, k, getKeyFromDate(new Date())).tasks.filter(t => t.done && !t.isSub).map(t => t.title);
    (appData.habits || []).filter(h => !h.deleted && h.entries?.[k]?.s === 'done').forEach(h => titles.push(h.name));
    return [...new Set(titles)];
  }, [appData]);
  const eveningDue = currentTime.getHours() >= 18 && appData.settings?.eveningDoneOn !== todayKeyNow;
  const showJournalPrompt = currentTime.getHours() >= 18 && !eveningDue && !journalWritten(appData.journal?.[todayKeyNow]);
  const showBriefing = currentTime.getHours() >= 4 && currentTime.getHours() < 13 && appData.settings?.briefingHiddenOn !== todayKeyNow;
  const briefing = useMemo(() => {
    if (!showBriefing) return null;
    const from = new Date(currentTime); from.setHours(0, 0, 0, 0); const to = new Date(from); to.setDate(from.getDate() + 1);
    return computeBriefing(appData, currentTime, occurrencesBetween(externalCalendars, cal.eventsOf, from, to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData, showBriefing, todayKeyNow, externalCalendars, cal.version]);

  // Bonus de discipline (XP) : attribués une seule fois chacun, dès qu'ils sont mérités
  useEffect(() => {
    if (isLoading || (user && !cloudReady.current)) return;
    const t = setTimeout(() => {
      const due = dueBonuses(appData, todayKeyNow);
      if (!due.length) return;
      const total = due.reduce((n, b) => n + b.xp, 0);
      updateAppData(prev => {
        const bonuses = { ...(prev.userProfile?.bonuses || {}) };
        const fresh = due.filter(b => !bonuses[b.key]);
        if (!fresh.length) return prev;
        const at = new Date().toISOString();
        fresh.forEach(b => { bonuses[b.key] = { xp: b.xp, label: b.label, at }; });
        const { profile, leveledUp } = handleXpGain({ ...(prev.userProfile || { xp: 0, level: 1 }), bonuses }, fresh.reduce((n, b) => n + b.xp, 0));
        if (leveledUp) setShowLevelUpModal(profile.level);
        return { ...prev, userProfile: profile };
      });
      setActiveNotification(due.length === 1 ? `Bonus discipline : ${due[0].label} · +${total} XP` : `${due.length} bonus de discipline · +${total} XP`);
      setTimeout(() => setActiveNotification(null), 4500);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.days, appData.blocks, appData.journal, appData.settings?.weekPlanDone, todayKeyNow, isLoading, user]);

  // Rappels intelligents : tâches à heure fixe non faites après leur créneau
  const reminderMode = appData.settings?.smartReminders ?? 'important';
  const [lateDismissed, setLateDismissed] = useState<string[]>([]);
  const late = useMemo(() => lateTasks(appData, currentTime, reminderMode).filter(t => !lateDismissed.includes(t.id)), [appData, currentTime, reminderMode, lateDismissed]);
  useEffect(() => {
    if (!late.length) return;
    const done = alreadyReminded(todayKeyNow);
    const fresh = late.filter(t => !done.has(t.id));
    if (!fresh.length) return;
    markReminded(todayKeyNow, fresh.map(t => t.id));
    fresh.slice(0, 3).forEach(t => notifyLate(t, todayKeyNow));
  }, [late, todayKeyNow]);
  const handleReminderAction = useCallback((action: string, taskId: string, date: string) => {
    if (action !== 'done' && action !== 'later') { setActiveTab('routine'); return; }
    let label = '';
    updateAppData(prev => {
      const f = prev.blocks.concat(prev.days[date]?.blocks || []).flatMap(b => b.tasks).find(t => t.id === taskId);
      if (!f) return prev;
      const oneOff = f.recurrence === 'specific' || f.recurrence === 'once' || !prev.blocks.some(b => b.tasks.some(t => t.id === taskId));
      const tomorrow = new Date(date + 'T12:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
      const r = action === 'done' ? executeTool(prev, 'set_task_done', { task_id: taskId, date, done: true }, { now: new Date() })
        : oneOff ? executeTool(prev, 'reschedule_task', { task_id: taskId, date: getKeyFromDate(tomorrow) }, { now: new Date() })
        : executeTool(prev, 'skip_task', { task_id: taskId, date, reason: 'Rappel : sautée' }, { now: new Date() });
      label = r.summary || '';
      return r.data;
    });
    setLateDismissed(d => [...d, taskId]);
    setTimeout(() => { if (label) { setActiveNotification(label); setTimeout(() => setActiveNotification(null), 3000); } }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'caddr-reminder') handleReminderAction(e.data.action, e.data.taskId, e.data.date); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const q = new URLSearchParams(window.location.search);
    if (q.get('reminder') && q.get('task') && q.get('date')) {
      handleReminderAction(q.get('reminder')!, q.get('task')!, q.get('date')!);
      window.history.replaceState({}, '', window.location.pathname);
    }
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [handleReminderAction]);

  // Discipline du mois en cours (jours écoulés) + écart avec le mois précédent
  const headerBar = appData.settings?.headerBar || 'discipline';
  const hiddenSections = useMemo(() => new Set(appData.settings?.analyticsHidden || []), [appData.settings?.analyticsHidden]);
  const toggleAnalyticsSection = (id: string) => updateAppData(prev => {
    const cur = new Set(prev.settings?.analyticsHidden || []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    return { ...prev, settings: { ...(prev.settings || {}), analyticsHidden: [...cur] } };
  });
  const monthDiscipline = useMemo(() => {
    const now = new Date(); const tk = getKeyFromDate(now);
    const cur = getPeriod('month', now);
    const c = computePeriod(appData, cur.start, cur.end, tk);
    const prevAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const pp = getPeriod('month', prevAnchor);
    const p = computePeriod(appData, pp.start, pp.end, tk);
    const name = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long' });
    return { rate: c.rate, done: c.done, total: c.total, label: name(now), prevLabel: name(prevAnchor), delta: p.total && c.total ? c.rate - p.rate : null };
  }, [appData, currentTime.getDate()]);

  const perfToday = useMemo(() => {
    let total = 0; let done = 0;
    routineBlocks.forEach(block => {
      const tasks = getVisibleTasks(block.tasks);
      tasks.forEach(task => {
        total++; if (task.completedDates?.includes(dateKey)) done++;
        (task.subTasks || []).forEach(st => {
           if (isDateInRange(currentDate, st.recurrence, st.specificDate, st.startDate, st.endDate, st.stopDate)) {
             total++; if (st.completedDates?.includes(dateKey)) done++;
           }
        });
      });
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [routineBlocks, getVisibleTasks, dateKey, currentDate]);

  // --- LOGIC: DATA MUTATION ---
  const handleRoutineStructureChange = (updater: (blocks: Block[]) => Block[]) => {
    updateAppData(prev => {
      const day = prev.days[dateKey] || { goalCompleted: false, note: "" };
      const hasLocalBlocks = !!day.blocks;
      const sourceBlocks = hasLocalBlocks 
        ? day.blocks! 
        : prev.blocks.filter(b => isDateInRange(currentDate, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
      const detachedBlocks = JSON.parse(JSON.stringify(sourceBlocks));
      const updatedBlocks = updater(detachedBlocks);
      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...day,
            blocks: updatedBlocks
          }
        }
      };
    });
  };

  const toggleBlockCollapse = (blockId: string) => {
    if (activeTab === 'routine') {
      handleRoutineStructureChange(blocks =>
        blocks.map(b => b.id === blockId ? { ...b, isCollapsed: !b.isCollapsed } : b)
      );
    } else {
      updateAppData(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => b.id === blockId ? { ...b, isCollapsed: !b.isCollapsed } : b)
      }));
    }
  };

  const toggleTask = (blockId: string, taskId: string, parentTaskId?: string) => {
    if (isReorderMode) return;
    const hasLocalBlocks = !!appData.days[dateKey]?.blocks;
    const targetIsRoutine = activeTab === 'routine';

    // Calculate XP Update first
    let xpDelta = 0;
    
    // Helper to determine check/uncheck status for XP
    const determineXpDelta = (tasks: Task[]) => {
        const findTask = (list: Task[]): Task | undefined => {
            for (const t of list) {
                if (t.id === taskId) return t;
                if (t.subTasks) {
                    const st = t.subTasks.find(s => s.id === taskId);
                    if (st) return st;
                }
            }
            return undefined;
        };

        const t = findTask(tasks);
        if (t) {
            const isCompleting = !t.completedDates?.includes(dateKey);
            const points = parentTaskId ? XP_SUBTASK : XP_TASK;
            xpDelta = isCompleting ? points : -points;
        }
    };
    
    const sourceBlocks = hasLocalBlocks 
        ? appData.days[dateKey].blocks!
        : appData.blocks;
    
    // Find the task in source blocks to determine XP
    const targetBlock = sourceBlocks.find(b => b.id === blockId);
    if (targetBlock) determineXpDelta(targetBlock.tasks);

    // Récompense sensorielle discrète à la complétion (pas au décochage)
    if (xpDelta > 0) playCompletionFeedback(appData.settings?.soundEffects ?? true);


    if (targetIsRoutine && hasLocalBlocks) {
      updateAppData(prev => {
          const { profile, leveledUp } = handleXpGain(prev.userProfile, xpDelta);
          if (leveledUp) setShowLevelUpModal(profile.level);

          const newBlocks = prev.days[dateKey].blocks!.map(b => {
              if (b.id !== blockId) return b;
              const updateTask = (t: Task) => t.id !== taskId ? t : flipCompletion(t, dateKey);
              if (parentTaskId) { return { ...b, tasks: b.tasks.map(t => t.id === parentTaskId ? { ...t, subTasks: (t.subTasks || []).map(updateTask) } : t) }; }
              return { ...b, tasks: b.tasks.map(updateTask) };
            });

          return {
              ...prev,
              userProfile: profile,
              days: {
                  ...prev.days,
                  [dateKey]: {
                      ...prev.days[dateKey],
                      blocks: newBlocks
                  }
              }
          }
      });
    } else {
       updateAppData(prev => {
        const { profile, leveledUp } = handleXpGain(prev.userProfile, xpDelta);
        if (leveledUp) setShowLevelUpModal(profile.level);

        return {
          ...prev,
          userProfile: profile,
          blocks: prev.blocks.map(b => {
            if (b.id !== blockId) return b;
            const updateTask = (t: Task) => t.id !== taskId ? t : flipCompletion(t, dateKey);
            if (parentTaskId) { return { ...b, tasks: b.tasks.map(t => t.id === parentTaskId ? { ...t, subTasks: (t.subTasks || []).map(updateTask) } : t) }; }
            return { ...b, tasks: b.tasks.map(updateTask) };
          })
        };
      });
    }
  };

  const toggleDailyGoal = () => {
      updateAppData(prev => {
          const isCompleting = !currentDayData.goalCompleted;
          const { profile, leveledUp } = handleXpGain(prev.userProfile, isCompleting ? XP_GOAL : -XP_GOAL);
          if (leveledUp) setShowLevelUpModal(profile.level);

          return { 
              ...prev, 
              userProfile: profile,
              days: { 
                  ...prev.days, 
                  [dateKey]: { 
                      ...currentDayData, 
                      goalCompleted: isCompleting 
                  } 
              } 
          };
      });
  };

  const moveBlockSmart = (blockId: string, direction: 'up' | 'down') => {
    if (activeTab === 'routine') {
      handleRoutineStructureChange(blocks => {
         const idx = blocks.findIndex(b => b.id === blockId);
         if (idx === -1) return blocks;
         const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
         if (targetIdx < 0 || targetIdx >= blocks.length) return blocks;
         const newArr = [...blocks];
         [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
         return newArr;
      });
    }
  };

  const moveTaskSmart = (blockId: string, taskId: string, direction: 'up' | 'down', parentTaskId?: string) => {
    if (activeTab === 'routine') {
      handleRoutineStructureChange(blocks => {
         return blocks.map(b => {
            if (b.id !== blockId) return b;
            const reorder = (list: Task[]) => {
               const idx = list.findIndex(t => t.id === taskId);
               if (idx === -1) return list;
               const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
               if (targetIdx < 0 || targetIdx >= list.length) return list;
               const next = [...list];
               [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
               return next;
            };
            if (parentTaskId) {
               return { ...b, tasks: b.tasks.map(t => t.id === parentTaskId ? { ...t, subTasks: reorder(t.subTasks || []) } : t) };
            }
            return { ...b, tasks: reorder(b.tasks) };
         });
      });
    }
  };

  const handleBlockDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    handleRoutineStructureChange(blocks => {
      const oldI = blocks.findIndex(b => b.id === active.id);
      const newI = blocks.findIndex(b => b.id === over.id);
      if (oldI === -1 || newI === -1) return blocks;
      return arrayMove(blocks, oldI, newI);
    });
  };

  const handleTaskDragEnd = (blockId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    handleRoutineStructureChange(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      const oldI = b.tasks.findIndex(t => t.id === active.id);
      const newI = b.tasks.findIndex(t => t.id === over.id);
      if (oldI === -1 || newI === -1) return b;
      return { ...b, tasks: arrayMove(b.tasks, oldI, newI) };
    }));
  };

  const handleEngineBlockDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    updateAppData(prev => {
      const oldI = prev.blocks.findIndex(b => b.id === active.id);
      const newI = prev.blocks.findIndex(b => b.id === over.id);
      if (oldI === -1 || newI === -1) return prev;
      return { ...prev, blocks: arrayMove(prev.blocks, oldI, newI) };
    });
  };

  const handleEngineTaskDragEnd = (blockId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    updateAppData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        const oldI = b.tasks.findIndex(t => t.id === active.id);
        const newI = b.tasks.findIndex(t => t.id === over.id);
        if (oldI === -1 || newI === -1) return b;
        return { ...b, tasks: arrayMove(b.tasks, oldI, newI) };
      }),
    }));
  };

  const moveTaskInEngine = (blockId: string, taskId: string, direction: 'up' | 'down', parentTaskId?: string) => {
    updateAppData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        const reorderArray = (arr: Task[]) => {
          const idx = arr.findIndex(t => t.id === taskId);
          if (idx === -1) return arr;
          const target = direction === 'up' ? idx - 1 : idx + 1;
          if (target < 0 || target >= arr.length) return arr;
          const next = [...arr];
          [next[idx], next[target]] = [next[target], next[idx]];
          return next;
        };
        if (parentTaskId) {
          return {
            ...b,
            tasks: b.tasks.map(t => t.id === parentTaskId ? { ...t, subTasks: reorderArray(t.subTasks || []) } : t)
          };
        }
        return { ...b, tasks: reorderArray(b.tasks) };
      })
    }));
  };

  const addTaskToBlock = (blockId: string) => {
    if (activeTab === 'routine') {
        handleRoutineStructureChange(blocks => 
            blocks.map(b => b.id === blockId ? { ...b, tasks: [...b.tasks, { id: generateId(), title: "Nouvelle tâche", completedDates: [], recurrence: 'daily', subTasks: [] }] } : b)
        );
        return;
    }
    updateAppData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, tasks: [...b.tasks, { id: generateId(), title: "Nouvelle tâche", completedDates: [], recurrence: 'daily', subTasks: [] }] } : b)
    }));
  };

  // Add a LOCAL block to the current day (detached)
  const addLocalBlock = () => {
    handleRoutineStructureChange(blocks => [
      ...blocks,
      {
        id: generateId(),
        title: "Bloc Exceptionnel",
        description: "Ajouté pour ce jour uniquement",
        tasks: [],
        recurrence: 'specific',
        specificDate: dateKey,
        isCollapsed: false
      }
    ]);
  };

  const handleDuplicate = (type: 'block' | 'task' | 'subtask', id: string, parentId?: string, grandParentId?: string) => {
    const deepCloneWithNewIds = (item: any) => {
        const newItem = JSON.parse(JSON.stringify(item));
        const traverse = (node: any) => {
            node.id = generateId();
            // Clear completion for duplicate
            if (node.completedDates) node.completedDates = [];
            if (node.tasks) node.tasks.forEach(traverse);
            if (node.subTasks) node.subTasks.forEach(traverse);
        };
        traverse(newItem);
        return newItem;
    };

    const updater = (blocks: Block[]) => {
        if (type === 'block') {
            const idx = blocks.findIndex(b => b.id === id);
            if (idx === -1) return blocks;
            const newBlock = deepCloneWithNewIds(blocks[idx]);
            newBlock.title += " (Copie)";
            const newBlocks = [...blocks];
            newBlocks.splice(idx + 1, 0, newBlock);
            return newBlocks;
        } else if (type === 'task') {
            return blocks.map(b => {
                if (b.id !== parentId) return b;
                const idx = b.tasks.findIndex(t => t.id === id);
                if (idx === -1) return b;
                const newTask = deepCloneWithNewIds(b.tasks[idx]);
                newTask.title += " (Copie)";
                const newTasks = [...b.tasks];
                newTasks.splice(idx + 1, 0, newTask);
                return { ...b, tasks: newTasks };
            });
        } else if (type === 'subtask') {
             return blocks.map(b => {
                if (b.id !== grandParentId) return b;
                return {
                    ...b,
                    tasks: b.tasks.map(t => {
                        if (t.id !== parentId) return t;
                        const idx = (t.subTasks || []).findIndex(s => s.id === id);
                        if (idx === -1) return t;
                        const newSub = deepCloneWithNewIds(t.subTasks![idx]);
                        newSub.title += " (Copie)";
                        const newSubs = [...(t.subTasks || [])];
                        newSubs.splice(idx + 1, 0, newSub);
                        return { ...t, subTasks: newSubs };
                    })
                }
             })
        }
        return blocks;
    };

    if (activeTab === 'routine') {
        handleRoutineStructureChange(updater);
    } else {
        updateAppData(prev => ({ ...prev, blocks: updater(prev.blocks) }));
    }
  };

  // --- LOGBOOK HANDLERS ---
  const openLogModal = (task: Task, blockId: string, parentTaskId?: string) => {
      setLogModal({ task, blockId, parentTaskId });
      setCurrentLogText(task.executionNotes?.[dateKey] || "");
  };

  const saveLogText = () => {
      if (!logModal) return;
      const { task, blockId, parentTaskId } = logModal;
      
      const updater = (blocks: Block[]) => {
          return blocks.map(b => {
              if (b.id !== blockId) return b;
              return {
                  ...b,
                  tasks: b.tasks.map(t => {
                      if (parentTaskId) {
                          if (t.id !== parentTaskId) return t;
                          return {
                              ...t,
                              subTasks: (t.subTasks || []).map(s => {
                                  if (s.id !== task.id) return s;
                                  return { 
                                      ...s, 
                                      executionNotes: { ...(s.executionNotes || {}), [dateKey]: currentLogText } 
                                  };
                              })
                          };
                      }
                      if (t.id !== task.id) return t;
                      return { 
                          ...t, 
                          executionNotes: { ...(t.executionNotes || {}), [dateKey]: currentLogText } 
                      };
                  })
              };
          });
      };

      if (activeTab === 'routine') {
          handleRoutineStructureChange(updater);
      } else {
          updateAppData(prev => ({ ...prev, blocks: updater(prev.blocks) }));
      }
      setLogModal(null);
      setCurrentLogText("");
  };

  // --- RESCHEDULE & PROMOTE HANDLERS ---
  const handleRescheduleConfirm = () => {
    if (!rescheduleModal || !rescheduleDate) return;
    const { task, blockId, parentTaskId } = rescheduleModal;

    // 1. Remove from current day (detach + remove)
    const removeUpdater = (blocks: Block[]) => {
        return blocks.map(b => {
            if (b.id !== blockId) return b;
            return {
                ...b,
                tasks: b.tasks.map(t => {
                    if (parentTaskId) {
                        if (t.id !== parentTaskId) return t;
                        return { ...t, subTasks: t.subTasks?.filter(s => s.id !== task.id) };
                    }
                    return t.id === task.id ? null : t;
                }).filter(Boolean) as Task[]
            };
        });
    };
    handleRoutineStructureChange(removeUpdater);

    // 2. Add to global blocks as a specific block for the target date
    updateAppData(prev => {
        const newTask = JSON.parse(JSON.stringify(task));
        newTask.id = generateId(); // New ID for the moved task
        newTask.recurrence = 'specific';
        newTask.specificDate = rescheduleDate;
        newTask.completedDates = [];

        const newBlock: Block = {
            id: generateId(),
            title: `Report: ${prev.blocks.find(b => b.id === blockId)?.title || "Tâche"}`,
            tasks: [newTask],
            recurrence: 'specific',
            specificDate: rescheduleDate,
            isCollapsed: false
        };

        return {
            ...prev,
            blocks: [...prev.blocks, newBlock]
        };
    });

    setRescheduleModal(null);
    setRescheduleDate("");
  };

  const handlePromoteToGlobal = (task: Task, blockId: string) => {
      updateAppData(prev => {
          // 1. Prepare the Global Task
          const globalTask = JSON.parse(JSON.stringify(task));
          globalTask.id = generateId(); // New ID for global tracking
          globalTask.recurrence = 'daily';
          globalTask.completedDates = []; // Fresh start for global

          // 2. Add to Global Blocks
          let newGlobalBlocks = [...prev.blocks];
          let targetBlockIndex = newGlobalBlocks.findIndex(b => b.recurrence === 'daily');
          
          if (targetBlockIndex !== -1) {
              newGlobalBlocks[targetBlockIndex] = {
                  ...newGlobalBlocks[targetBlockIndex],
                  tasks: [...newGlobalBlocks[targetBlockIndex].tasks, globalTask]
              };
          } else {
              newGlobalBlocks.push({
                  id: generateId(),
                  title: "Habitudes Quotidiennes",
                  recurrence: 'daily',
                  tasks: [globalTask],
                  isCollapsed: false
              });
          }

          // 3. If Detached Mode (Local Override exists for today), update the local task too
          // This gives immediate visual feedback that the task is now "Daily"
          const dayData = prev.days[dateKey];
          let newDays = { ...prev.days };
          
          if (dayData && dayData.blocks) {
             const newLocalBlocks = dayData.blocks.map(b => {
                 if (b.id !== blockId) return b;
                 return {
                     ...b,
                     tasks: b.tasks.map(t => {
                         if (t.id === task.id) {
                             return { ...t, recurrence: 'daily' as RecurrenceType }; // Visual update only
                         }
                         return t;
                     })
                 };
             });
             newDays[dateKey] = { ...dayData, blocks: newLocalBlocks };
          }

          return { ...prev, blocks: newGlobalBlocks, days: newDays };
      });
      
      setActiveNotification("Tâche rendue récurrente (Quotidien)");
      setTimeout(() => setActiveNotification(null), 3000);
  };

  const promoteBlockToGlobal = (block: Block) => {
      updateAppData(prev => {
          const newBlock = JSON.parse(JSON.stringify(block));
          newBlock.id = generateId();
          newBlock.recurrence = 'daily';
          newBlock.title = `${newBlock.title} (Quotidien)`;
          // Clear completion history for the new global block tasks
          newBlock.tasks.forEach((t: Task) => {
              t.id = generateId();
              t.completedDates = [];
              t.recurrence = 'daily';
          });

          return { ...prev, blocks: [...prev.blocks, newBlock] };
      });
      setActiveNotification("Bloc rendu récurrent (Quotidien)");
      setTimeout(() => setActiveNotification(null), 3000);
  };

  // --- CONFIG MODAL HANDLERS ---
  const handleConfigUpdate = (updater: (blocks: Block[]) => Block[]) => {
    if (activeTab === 'routine' && configModal?.type !== 'goal') {
      handleRoutineStructureChange(updater);
    } else {
      updateAppData(prev => {
        // If updating a goal
        if (configModal?.type === 'goal') {
           // We can't use the block updater for goals, handle separately inside specific handlers
           return prev; 
        }
        return { ...prev, blocks: updater(prev.blocks) };
      });
    }
  };

  const updateConfiguredItem = (field: keyof Task | keyof Block | keyof RecurringGoal, value: any) => {
    if (!configModal) return;
    const { type, id, blockId, parentTaskId } = configModal;

    if (type === 'goal') {
        if (activeTab === 'routine') {
           // Handle overrides locally to avoid touching the global model
           if (field === 'title') {
             updateAppData(prev => ({
               ...prev,
               days: { ...prev.days, [dateKey]: { ...(prev.days[dateKey] || { goalCompleted: false, note: "" }), dailyGoalOverride: value } }
             }));
           }
           if (field === 'reminderTime') {
             updateAppData(prev => ({
               ...prev,
               days: { ...prev.days, [dateKey]: { ...(prev.days[dateKey] || { goalCompleted: false, note: "" }), reminderTime: value } }
             }));
           }
           // Other fields like recurrence should not be editable in 'routine' tab to ensure isolation
           return;
        }

        updateAppData(prev => ({
            ...prev,
            recurringGoals: prev.recurringGoals.map(g => g.id === id ? { ...g, [field as string]: value } : g)
        }));
        return;
    }

    const updater = (blocks: Block[]): Block[] => {
        if (type === 'block') {
            return blocks.map(b => b.id === id ? { ...b, [field as keyof Block]: value } : b);
        }
        // Task or Subtask
        return blocks.map(b => {
            if (b.id !== blockId) return b;
            return {
                ...b,
                tasks: b.tasks.map(t => {
                    if (parentTaskId) {
                        if (t.id !== parentTaskId) return t;
                        return { ...t, subTasks: (t.subTasks || []).map(s => s.id === id ? { ...s, [field as keyof Task]: value } : s) };
                    }
                    return t.id === id ? { ...t, [field as keyof Task]: value } : t;
                })
            };
        });
    };

    if (activeTab === 'routine') {
        handleRoutineStructureChange(updater);
    } else {
        updateAppData(prev => ({ ...prev, blocks: updater(prev.blocks) }));
    }
  };

  const handleDeleteConfigItem = () => {
    if (!configModal) return;
    saveToHistory(); // Auto-save before delete
    const { type, id, blockId, parentTaskId } = configModal;

    if (type === 'goal') {
        // Prevent deletion of global goals from routine tab
        if (activeTab === 'routine') return;

        updateAppData(prev => ({ ...prev, recurringGoals: prev.recurringGoals.filter(g => g.id !== id) }));
        setConfigModal(null);
        return;
    }

    const updater = (blocks: Block[]): Block[] => {
        if (type === 'block') {
            return blocks.filter(b => b.id !== id);
        }
        return blocks.map(b => {
            if (b.id !== blockId) return b;
            return {
                ...b,
                tasks: b.tasks.map(t => {
                    if (parentTaskId) {
                        if (t.id !== parentTaskId) return t;
                        return { ...t, subTasks: t.subTasks?.filter(s => s.id !== id) };
                    }
                    return t.id === id ? null : t;
                }).filter(Boolean) as Task[]
            };
        });
    };

    if (activeTab === 'routine') {
        handleRoutineStructureChange(updater);
    } else {
        updateAppData(prev => ({ ...prev, blocks: updater(prev.blocks) }));
    }
    setConfigModal(null);
  };

  // --- AI HANDLERS ---
  const handleReviewAI = async () => {
    if (!currentDayData.reflection) return;
    setIsReviewAiLoading(true);
    const completedTasks: string[] = [];
    routineBlocks.forEach(b => {
        b.tasks.forEach(t => {
            if (t.completedDates?.includes(dateKey)) completedTasks.push(t.title);
            (t.subTasks || []).forEach(st => { if (st.completedDates?.includes(dateKey)) completedTasks.push(st.title); });
        });
    });
    const feedback = await getDailyReviewFeedback(completedTasks, perfToday, currentDayData.reflection);
    if (feedback) {
      updateAppData(prev => ({
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...currentDayData,
            aiFeedback: feedback
          }
        }
      }));
    }
    setIsReviewAiLoading(false);
  };

  const handleVisionImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsAiLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await extractRoutineFromImage(base64);
      if (result) {
        const newBlocks: Block[] = result.map((res: any) => ({
          id: generateId(), title: res.title, recurrence: 'daily', isCollapsed: true, tasks: (res.tasks || []).map((t: string) => ({ id: generateId(), title: t, completedDates: [], recurrence: 'daily', subTasks: [] }))
        }));
        saveToHistory(); // Save before import
        updateAppData(prev => ({ ...prev, blocks: [...prev.blocks, ...newBlocks] }));
      }
      setIsAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateRoutine = async () => {
    if (!aiGoal) return;
    setIsAiLoading(true);
    try {
      const result = await generateRoutineFromGoal(aiGoal);
      if (result && Array.isArray(result)) {
        const newBlocks: Block[] = result.map((res: any) => ({
          id: generateId(), title: res.title || "Bloc IA", recurrence: 'daily', isCollapsed: true, tasks: (res.tasks || []).map((t: string) => ({ id: generateId(), title: t, completedDates: [], recurrence: 'daily', subTasks: [] }))
        }));
        saveToHistory(); // Save before AI gen
        updateAppData(prev => ({ ...prev, blocks: [...prev.blocks, ...newBlocks] }));
        setShowAiGen(false); setAiGoal("");
      }
    } catch (error) { console.error(error); } finally { setIsAiLoading(false); }
  };

  // --- TEMPLATE & RESET HANDLERS ---
  const handleSaveTemplate = () => {
    if (!newTplName) return;
    if (editingTemplateId) {
       updateAppData(prev => ({
         ...prev,
         templates: prev.templates.map(t => t.id === editingTemplateId ? { ...t, name: newTplName, templateGoal: newTplGoal } : t)
       }));
       setEditingTemplateId(null);
    } else {
       updateAppData(prev => ({
        ...prev,
        templates: [...(prev.templates || []), { 
          id: generateId(), name: newTplName, blocks: JSON.parse(JSON.stringify(appData.blocks)), recurringGoals: JSON.parse(JSON.stringify(appData.recurringGoals || [])), templateGoal: newTplGoal
        }],
        blocks: [],
        recurringGoals: []
      }));
    }
    setNewTplName(""); setNewTplGoal(""); setTemplateModal(false);
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.blocks && json.name) {
             const newTpl = { ...json, id: generateId() };
             updateAppData(prev => ({...prev, templates: [...(prev.templates || []), newTpl]}));
          }
        } catch(e) { alert("Fichier invalide"); }
        if (templateInputRef.current) templateInputRef.current.value = "";
      };
      reader.readAsText(file);
  };

  const handleTemplateDownload = (tpl: any) => {
      const dataStr = JSON.stringify(tpl, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `caddr_template_${tpl.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // Ajoute les blocs d'un modèle à la routine actuelle (sans rien remplacer), éventuellement sur une période
  const addTemplateToRoutine = (tplBlocks: Block[], days?: number, name?: string) => {
    const today = getKeyFromDate(new Date());
    const end = days ? getKeyFromDate(new Date(Date.now() + (days - 1) * 86400000)) : undefined;
    const fresh: Block[] = JSON.parse(JSON.stringify(tplBlocks)).map((b: Block) => {
      const tasks = b.tasks.map(t => ({ ...t, id: generateId(), completedDates: [], recurrence: days && b.recurrence !== 'daily' ? b.recurrence : t.recurrence }));
      return days ? { ...b, id: generateId(), tasks, recurrence: 'period' as const, startDate: today, endDate: end } : { ...b, id: generateId(), tasks };
    });
    saveToHistory();
    updateAppData(prev => {
      const daysMap = { ...prev.days };
      Object.keys(daysMap).forEach(k => {
        const d = daysMap[k]; if (!d?.blocks || k < today) return;
        const dt = new Date(k + 'T12:00:00');
        const add = fresh.filter(b => isDateInRange(dt, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
        if (add.length) daysMap[k] = { ...d, blocks: [...d.blocks, ...JSON.parse(JSON.stringify(add))] };
      });
      return { ...prev, blocks: [...prev.blocks, ...fresh], days: daysMap };
    });
    setActiveNotification(`« ${name || 'Modèle'} » ajouté à ta routine${days ? ` pour ${days} jours` : ''} ✓`);
    setTimeout(() => setActiveNotification(null), 3500);
  };

  const applyTemplate = (tplId: string) => {
    const tpl = appData.templates?.find(t => t.id === tplId); if (!tpl) return;
    const newGoals = JSON.parse(JSON.stringify(tpl.recurringGoals || []));
    if (tpl.templateGoal) { newGoals.push({ id: generateId(), title: tpl.templateGoal, recurrence: 'specific', specificDate: dateKey }); }
    saveToHistory(); // Save before applying template
    updateAppData(prev => ({ ...prev, blocks: JSON.parse(JSON.stringify(tpl.blocks)), recurringGoals: newGoals }));
    setActiveTab('routine');
  };

  const performResetRoutine = (archive: boolean) => {
    saveToHistory(); // Save before reset
    updateAppData(prev => {
        let templates = prev.templates || [];
        if (archive && resetArchiveName) {
            templates = [...templates, { 
                id: generateId(), 
                name: resetArchiveName, 
                blocks: JSON.parse(JSON.stringify(prev.blocks)), 
                recurringGoals: JSON.parse(JSON.stringify(prev.recurringGoals || [])),
                templateGoal: "Routine Archivée"
            }];
        }
        return { ...prev, templates, blocks: [], recurringGoals: [] };
    });
    setShowResetModal(false);
    setResetArchiveName("");
  };

  // --- TEMPLATE EDITING FULL MODE ---
  const startTemplateEditing = (tplId: string) => {
    const tpl = appData.templates?.find(t => t.id === tplId);
    if (!tpl) return;
    
    // Backup current state and switch to edit mode
    setTemplateEditState({
      originalBlocks: JSON.parse(JSON.stringify(appData.blocks)),
      originalGoals: JSON.parse(JSON.stringify(appData.recurringGoals || [])),
      templateId: tplId
    });

    // Load template data into active workspace
    updateAppData(prev => ({
      ...prev,
      blocks: JSON.parse(JSON.stringify(tpl.blocks)),
      recurringGoals: JSON.parse(JSON.stringify(tpl.recurringGoals || []))
    }));

    setNewTplName(tpl.name);
    setNewTplGoal(tpl.templateGoal || "");
    setActiveTab('schedule');
    setIsReorderMode(false);
  };

  const saveTemplateEditing = () => {
    if (!templateEditState) return;
    
    updateAppData(prev => ({
      ...prev,
      templates: (prev.templates || []).map(t => 
        t.id === templateEditState.templateId 
          ? { 
              ...t, 
              name: newTplName || t.name, 
              templateGoal: newTplGoal || t.templateGoal,
              blocks: JSON.parse(JSON.stringify(prev.blocks)), // Save current workspace state
              recurringGoals: JSON.parse(JSON.stringify(prev.recurringGoals || [])) 
            } 
          : t
      ),
      // Restore original user routine
      blocks: templateEditState.originalBlocks,
      recurringGoals: templateEditState.originalGoals
    }));
    
    setTemplateEditState(null);
    setNewTplName("");
    setNewTplGoal("");
    setActiveTab('templates');
  };

  const cancelTemplateEditing = () => {
    if (!templateEditState) return;

    // Restore original user routine without saving
    updateAppData(prev => ({
      ...prev,
      blocks: templateEditState.originalBlocks,
      recurringGoals: templateEditState.originalGoals
    }));

    setTemplateEditState(null);
    setNewTplName("");
    setNewTplGoal("");
    setActiveTab('templates');
  };

  // --- INBOX ---
  const addInboxTask = () => {
    if (!newInboxTitle.trim()) return;
    const p = parseCapture(newInboxTitle);
    const newTask: Task = JSON.parse(JSON.stringify({ id: generateId(), title: p.title, completedDates: [], recurrence: p.recurrence || 'daily', subTasks: [], specificDate: p.specificDate, startTime: p.startTime, priority: p.priority, labels: p.labels, deadline: p.deadline }));
    updateAppData(prev => ({ ...prev, inboxTasks: [newTask, ...(prev.inboxTasks || [])] }));
    setNewInboxTitle("");
  };

  // Ouverture de la fenêtre : on pré-remplit avec la date déjà saisie dans la Boîte
  const openDeploy = (task: Task) => {
    const todayK = getKeyFromDate(new Date());
    setTransferTask(task);
    setDeployWhen(task.recurrence === 'weekly' && task.specificDate ? 'weekly' : task.specificDate ? (task.specificDate === todayK ? 'today' : 'date') : 'today');
    setDeployDate(task.specificDate || todayK);
    setDeployStart(todayK);
    setDeployEnd(todayK);
    setDeployBlockId(null);
    setDeployNewBlock(null);
  };

  const closeDeploy = () => { setTransferTask(null); setDeployNewBlock(null); setDeployBlockId(null); };

  // Jour visé quand la tâche est pour un seul jour (sinon null = récurrente)
  const deploySingleDay = (): string | null => {
    const now = new Date();
    if (deployWhen === 'today') return getKeyFromDate(now);
    if (deployWhen === 'tomorrow') { const t = new Date(now); t.setDate(now.getDate() + 1); return getKeyFromDate(t); }
    if (deployWhen === 'date') return deployDate || null;
    return null;
  };

  // Champs de récurrence à donner à la tâche (et au nouveau bloc éventuel)
  const deployRecurrenceFields = (): Partial<Task> => {
    const day = deploySingleDay();
    if (day) return { recurrence: 'specific', specificDate: day, startDate: undefined, endDate: undefined, stopDate: undefined };
    const now = new Date();
    if (deployWhen === 'week') {
      const offset = (now.getDay() + 6) % 7;
      const st = new Date(now); st.setDate(now.getDate() - offset);
      const en = new Date(st); en.setDate(st.getDate() + 6);
      return { recurrence: 'week', startDate: getKeyFromDate(st), endDate: getKeyFromDate(en), specificDate: undefined, stopDate: undefined };
    }
    if (deployWhen === 'month') {
      return { recurrence: 'month', startDate: getKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: getKeyFromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)), specificDate: undefined, stopDate: undefined };
    }
    if (deployWhen === 'weekly') {
      return { recurrence: 'weekly', specificDate: deployDate || getKeyFromDate(now), startDate: undefined, endDate: undefined, stopDate: undefined };
    }
    if (deployWhen === 'period') {
      const a = deployStart || getKeyFromDate(now); const b = deployEnd && deployEnd >= a ? deployEnd : a;
      return { recurrence: 'period', startDate: a, endDate: b, specificDate: undefined, stopDate: undefined };
    }
    return { recurrence: deployWhen as RecurrenceType, specificDate: undefined, startDate: undefined, endDate: undefined, stopDate: undefined };
  };

  // Blocs proposés : pour un jour précis, ceux qui existent ce jour-là (y compris
  // les blocs exceptionnels de ce jour) ; pour une récurrence, les blocs du plan.
  const deployBlockOptions = (): Block[] => {
    const day = deploySingleDay();
    if (!day) return appData.blocks.filter(b => !['specific', 'once'].includes(b.recurrence));
    const d = new Date(day + 'T12:00:00');
    const frozen = appData.days[day]?.blocks;
    if (frozen) return frozen.filter(b => isDateInRange(d, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
    return appData.blocks.filter(b => isDateInRange(d, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
  };

  const describeDeploy = (): string => {
    const day = deploySingleDay();
    if (day) return `Le ${formatDayLabel(day)} uniquement`;
    const txt = describeRecurrence(deployRecurrenceFields()).replace(/^Visible\s*/, '');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };

  const deployInboxTask = () => {
    if (!transferTask) return;
    const newName = deployNewBlock?.trim();
    if (!deployBlockId && !newName) return;
    saveToHistory();
    const fields = deployRecurrenceFields();
    const task: Task = JSON.parse(JSON.stringify({ ...transferTask, ...fields, doneAt: undefined }));
    const day = deploySingleDay();
    const todayK = getKeyFromDate(new Date());
    const targetTitle = newName || (appData.blocks.find(b => b.id === deployBlockId) || (day ? appData.days[day]?.blocks?.find(b => b.id === deployBlockId) : undefined))?.title || '';

    updateAppData(prev => {
      let blocks = prev.blocks;
      const days = { ...prev.days };
      const covers = (k: string) => isDateInRange(new Date(k + 'T12:00:00'), task.recurrence, task.specificDate, task.startDate, task.endDate, task.stopDate);

      if (newName) {
        // Nouveau bloc : pour un jour précis, il n'existe que ce jour-là ;
        // pour une récurrence, il suit la même période que la tâche.
        const nb: Block = { id: generateId(), title: newName, description: day ? 'Ajouté pour ce jour uniquement' : undefined, tasks: [task], recurrence: task.recurrence, specificDate: task.specificDate, startDate: task.startDate, endDate: task.endDate, isCollapsed: false };
        blocks = [...blocks, nb];
        Object.keys(days).forEach(k => {
          const d = days[k];
          if (d?.blocks && (k >= todayK || k === day) && covers(k)) days[k] = { ...d, blocks: [...d.blocks, JSON.parse(JSON.stringify(nb))] };
        });
      } else {
        const bid = deployBlockId!;
        const inPlan = blocks.some(b => b.id === bid);
        const src = blocks.find(b => b.id === bid) || (day ? days[day]?.blocks?.find(b => b.id === bid) : undefined);
        if (inPlan) blocks = blocks.map(b => b.id === bid ? { ...b, tasks: [...b.tasks, task] } : b);
        // Jours déjà « figés » couverts : on y ajoute aussi la tâche, sinon elle
        // resterait invisible dans l'onglet Routine (c'était le bug).
        Object.keys(days).forEach(k => {
          const d = days[k];
          if (!d?.blocks || (k < todayK && k !== day) || !covers(k)) return;
          if (d.blocks.some(b => b.id === bid)) {
            days[k] = { ...d, blocks: d.blocks.map(b => b.id === bid && !b.tasks.some(t => t.id === task.id) ? { ...b, tasks: [...b.tasks, JSON.parse(JSON.stringify(task))] } : b) };
          } else if (src && inPlan) {
            const { tasks: _t, ...rest } = JSON.parse(JSON.stringify(src));
            days[k] = { ...d, blocks: [...d.blocks, { ...rest, tasks: [JSON.parse(JSON.stringify(task))] }] };
          }
        });
      }
      return { ...prev, blocks, days, inboxTasks: (prev.inboxTasks || []).filter(t => t.id !== transferTask.id) };
    });

    const when = day ? (day === todayK ? "aujourd'hui" : `le ${formatDayLabel(day)}`) : 'selon la récurrence choisie';
    setActiveNotification(`« ${transferTask.title} » ajoutée ${when}${targetTitle ? ` dans ${targetTitle}` : ''}.`);
    setTimeout(() => setActiveNotification(null), 4000);
    closeDeploy();
  };

  // --- ANALYTICS ---
  const getPerfForRange = useCallback((startDate: Date, endDate: Date) => {
    let totalScheduledCount = 0; 
    let totalDoneCount = 0;
    const history = []; 
    const dailyBlockHistory: { date: string, name: string, total: number, validated: number }[] = [];
    const taskLog: { date: string, title: string, block: string, completed: boolean, priority?: PriorityType }[] = [];
    
    // Stats per block type (aggregated)
    const blockStats: { [title: string]: { totalAppearances: number, fullyValidated: number } } = {};

    const current = new Date(startDate);
    let streakCount = 0;
    let bestDay = { date: '', val: 0 };

    while (current <= endDate) {
      const dKey = getKeyFromDate(current);
      let dayTotal = 0; 
      let dayDone = 0;
      let dayBlocksTotal = 0;
      let dayBlocksValidated = 0;

      const dayData = appData.days[dKey];
      const hasOverrides = !!dayData?.blocks;
      const blocksForDay = hasOverrides 
         ? dayData.blocks! 
         : appData.blocks.filter(b => isDateInRange(current, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));

      blocksForDay.forEach(b => {
          // Identify tasks for this block on this day
          const tasksForDay = hasOverrides 
             ? b.tasks 
             : b.tasks.filter(t => isDateInRange(current, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate));

          // Only count block stats if the block actually has tasks today
          if (tasksForDay.length > 0) {
              dayBlocksTotal++;
              let blockTasksDone = 0;
              let blockTasksTotal = 0;

              // Aggregate Block Stats
              if (!blockStats[b.title]) {
                  blockStats[b.title] = { totalAppearances: 0, fullyValidated: 0 };
              }
              blockStats[b.title].totalAppearances++;

              tasksForDay.forEach(t => {
                blockTasksTotal++;
                dayTotal++; 
                totalScheduledCount++;
                const isCompleted = t.completedDates?.includes(dKey);
                if (isCompleted) {
                  blockTasksDone++;
                  dayDone++; 
                  totalDoneCount++;
                }
                taskLog.push({ date: dKey, title: t.title, block: b.title, completed: isCompleted, priority: t.priority });
                
                const subTasksForDay = hasOverrides
                   ? (t.subTasks || [])
                   : (t.subTasks || []).filter(st => isDateInRange(current, st.recurrence, st.specificDate, st.startDate, st.endDate, st.stopDate));

                subTasksForDay.forEach(st => { 
                      blockTasksTotal++;
                      dayTotal++; 
                      totalScheduledCount++; 
                      const isSTCompleted = st.completedDates?.includes(dKey);
                      if (isSTCompleted) { 
                        blockTasksDone++;
                        dayDone++; 
                        totalDoneCount++; 
                      }
                      taskLog.push({ date: dKey, title: st.title, block: `Sub: ${t.title}`, completed: isSTCompleted, priority: st.priority });
                });
              });

              // Check if block is fully validated (100% of tasks done)
              if (blockTasksTotal > 0 && blockTasksDone === blockTasksTotal) {
                  dayBlocksValidated++;
                  blockStats[b.title].fullyValidated++;
              }
          }
      });

      const dayPerf = dayTotal === 0 ? 0 : Math.round((dayDone / dayTotal) * 100);
      const dayLabel = current.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      history.push({ name: dayLabel, val: dayPerf, date: dKey });
      dailyBlockHistory.push({ date: dKey, name: dayLabel, total: dayBlocksTotal, validated: dayBlocksValidated });

      if (dayPerf === 100) streakCount++;
      else if (dayPerf < 100 && current.toDateString() !== new Date().toDateString()) streakCount = 0;
      if (dayPerf > bestDay.val) bestDay = { date: dKey, val: dayPerf };
      current.setDate(current.getDate() + 1);
    }
    const avg = totalScheduledCount === 0 ? 0 : Math.round((totalDoneCount / totalScheduledCount) * 100);
    
    // Sort block stats
    const sortedBlockStats = Object.entries(blockStats).map(([title, stats]) => ({
        title,
        ...stats,
        rate: stats.totalAppearances === 0 ? 0 : Math.round((stats.fullyValidated / stats.totalAppearances) * 100)
    })).sort((a, b) => b.rate - a.rate);

    return { avg, history, totalDoneCount, totalScheduledCount, streakCount, bestDay, taskLog: taskLog.reverse(), sortedBlockStats, dailyBlockHistory };
  }, [appData.blocks, appData.days]);

  // Stats sur 12 mois glissants : alimente la heatmap annuelle et les badges
  const yearStats = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return getPerfForRange(start, end);
  }, [getPerfForRange]);

  // Série de journées parfaites avec tolérance (jour de grâce)
  const gracedStreak = useMemo(
    () => computePerfectStreakWithGrace(yearStats.history, graceDays).streak,
    [yearStats.history, graceDays]
  );

  // Données de la revue hebdomadaire (7 derniers jours)
  const currentWeekKey = getWeekKey(new Date());
  const weekReviewStats = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const r = getPerfForRange(start, end);
    const perfectDays = r.history.filter(h => h.val === 100).length;
    return { avg: r.avg, perfectDays, totalDone: r.totalDoneCount };
  }, [getPerfForRange]);

  // --- Mode Focus ---
  const [focusTarget, setFocusTarget] = useState<{ task: Task; blockId: string; blockTitle: string; micro?: boolean } | null>(null);

  // Première tâche horodatée "active maintenant" et non complétée aujourd'hui
  const activeTimedTask = useMemo(() => {
    const todayKey = getKeyFromDate(new Date());
    if (dateKey !== todayKey) return null;
    for (const block of routineBlocks) {
      for (const task of getVisibleTasks(block.tasks)) {
        if (task.startTime && isTaskActive(task) && !(task.completedDates || []).includes(todayKey)) {
          return { task, blockId: block.id, blockTitle: block.title };
        }
      }
    }
    return null;
  }, [routineBlocks, currentTime, dateKey, getVisibleTasks]);

  // Données pour la vue "Maintenant & Ensuite" (anti-cécité temporelle)
  const nowNextData = useMemo(() => {
    const todayKey = getKeyFromDate(new Date());
    if (dateKey !== todayKey) return { current: null, next: null, nowMin: 0 };
    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
    const timed: { taskId: string; blockId: string; title: string; blockTitle: string; startMin: number; duration: number; done: boolean }[] = [];
    routineBlocks.forEach(block => {
      getVisibleTasks(block.tasks).forEach(task => {
        if (!task.startTime) return;
        const [h, m] = task.startTime.split(':').map(Number);
        timed.push({
          taskId: task.id, blockId: block.id, title: task.title, blockTitle: block.title,
          startMin: h * 60 + m, duration: task.duration || 30,
          done: (task.completedDates || []).includes(todayKey),
        });
      });
    });
    timed.sort((a, b) => a.startMin - b.startMin);
    const current = timed.find(t => !t.done && nowMin >= t.startMin && nowMin < t.startMin + t.duration) || null;
    const next = timed.find(t => !t.done && t.startMin > nowMin) || null;
    return { current, next, nowMin };
  }, [routineBlocks, currentTime, dateKey, getVisibleTasks]);

  // Mode journée simplifiée : n'afficher que le bloc en cours / à venir
  const simpleMode = appData.settings?.simpleMode ?? false;
  const displayedRoutineBlocks = useMemo(() => {
    if (!simpleMode) return routineBlocks;
    const focusBlockId = nowNextData.current?.blockId || nowNextData.next?.blockId;
    if (focusBlockId) return routineBlocks.filter(b => b.id === focusBlockId);
    // Repli : aucune tâche horodatée en attente → isoler le premier bloc non terminé.
    const firstIncomplete = routineBlocks.find(b => {
      const tasks = getVisibleTasks(b.tasks);
      if (tasks.length === 0) return false;
      return tasks.some(t => !(t.completedDates || []).includes(dateKey));
    });
    return firstIncomplete ? [firstIncomplete] : routineBlocks;
  }, [simpleMode, routineBlocks, nowNextData, getVisibleTasks, dateKey]);

  const handleFocusComplete = (actualMin: number = 0) => {
    if (!focusTarget) return;
    const target = focusTarget;
    toggleTask(target.blockId, target.task.id); // XP normal de la tâche
    updateAppData(prev => {
      const { profile, leveledUp } = handleXpGain(prev.userProfile, 10); // bonus Focus
      if (leveledUp) setShowLevelUpModal(profile.level);
      const session = {
        id: generateId(),
        taskId: target.task.id,
        taskTitle: target.task.title,
        blockTitle: target.blockTitle,
        date: getKeyFromDate(new Date()),
        durationMin: target.task.duration || 25,
        actualMin: actualMin || undefined,
        completedInTime: true,
      };
      return { ...prev, userProfile: profile, focusSessions: [...(prev.focusSessions || []), session] };
    });
    setActiveNotification("Session Focus terminée ! +10 XP bonus 🎯");
    setTimeout(() => setActiveNotification(null), 4000);
    setFocusTarget(null);
  };

  // Agenda : changer l'heure / la durée d'une tâche (plan + jours déjà figés à venir)
  const setTaskTime = (blockId: string, taskId: string, patch: { startTime?: string; duration?: number }, k: string) => {
    const todayKey = getKeyFromDate(new Date());
    const upd = (blocks: Block[]) => blocks.map(b => b.tasks.some(t => t.id === taskId) ? { ...b, tasks: b.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) } : b);
    updateAppData(prev => {
      const days = { ...prev.days };
      Object.keys(days).forEach(key => { const d = days[key]; if (d?.blocks && (key >= todayKey || key === k)) days[key] = { ...d, blocks: upd(d.blocks) }; });
      return { ...prev, blocks: upd(prev.blocks), days };
    });
    if (patch.startTime) { setActiveNotification(`Programmé à ${patch.startTime} ⏱`); setTimeout(() => setActiveNotification(null), 2500); }
  };

  // Agenda : appliquer une version allégée (reports, tâches sautées, nouveaux horaires)
  const applyLighten = (plan: { postpone: { id: string; blockId: string; oneOff: boolean }[]; reschedule: { id: string; blockId: string; startTime: string }[] }, k: string) => {
    saveToHistory();
    const tomorrow = new Date(k + 'T12:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
    const tk = getKeyFromDate(new Date());
    updateAppData(prev => {
      let next = prev;
      plan.postpone.filter(p => p.oneOff).forEach(p => { next = relocateTask(next, p.id, getKeyFromDate(tomorrow), undefined, tk); });
      const skipped = plan.postpone.filter(p => !p.oneOff).map(p => {
        let title = ''; [...next.blocks, ...(next.days[k]?.blocks || [])].forEach(b => b.tasks.forEach(t => { if (t.id === p.id) title = t.title; }));
        return { id: generateId(), taskId: p.id, taskTitle: title, date: k, reason: 'Journée allégée' };
      });
      const times = new Map(plan.reschedule.map(r => [r.id, r.startTime]));
      const upd = (bs: Block[]) => bs.map(b => b.tasks.some(t => times.has(t.id)) ? { ...b, tasks: b.tasks.map(t => times.has(t.id) ? { ...t, startTime: times.get(t.id) } : t) } : b);
      const days = { ...next.days };
      Object.keys(days).forEach(key => { const d = days[key]; if (d?.blocks && (key >= tk || key === k)) days[key] = { ...d, blocks: upd(d.blocks) }; });
      return { ...next, blocks: upd(next.blocks), days, skips: [...(next.skips || []), ...skipped] };
    });
    const n = plan.postpone.length + plan.reschedule.length;
    setActiveNotification(`Journée allégée : ${n} changement${n > 1 ? 's' : ''} appliqué${n > 1 ? 's' : ''} 🪶`);
    setTimeout(() => setActiveNotification(null), 3500);
  };

  // Agenda : ajout rapide d'une tâche ponctuelle sur un créneau
  const quickAddTask = (blockId: string, title: string, startTime: string, duration: number, k: string) => {
    updateAppData(prev => addOneOff(prev, { id: generateId(), title, completedDates: [], startTime, duration, subTasks: [] }, k, blockId));
    setActiveNotification(`« ${title} » ajoutée à ${startTime} ✓`);
    setTimeout(() => setActiveNotification(null), 2500);
  };

  // Déplacer une tâche vers un autre jour (agenda semaine, report des tâches non faites…)
  const handleRescheduleTask = (taskId: string, targetDateKey: string, startTime?: string | null) => {
    updateAppData(prev => relocateTask(prev, taskId, targetDateKey, startTime));
    const label = new Date(targetDateKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    setActiveNotification(`Déplacée au ${label}${startTime ? ` à ${startTime}` : ''} ⏱`);
    setTimeout(() => setActiveNotification(null), 3000);
  };

  const handleResetApp = async () => {
    // Réinitialise toutes les données, en conservant les préférences d'apparence.
    const blank: AppData = {
      days: {}, blocks: [], templates: keepTemplates ? (appData.templates || []) : [], recurringGoals: [], inboxTasks: [],
      userProfile: { xp: 0, level: 1 },
      longTermGoals: [], weeklyReviews: {}, focusSessions: [], skips: [],
      settings: appData.settings, // on garde thème, position de barre, etc.
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
      if (user) await saveDataToCloud(user.uid, blank);
    } catch (e) {
      console.error('Reset failed:', e);
    }
    setShowFullResetModal(false);
    setResetInput('');
    window.location.reload();
  };

  const handleSkipToday = () => {
    if (!configModal || configModal.type !== 'task') return;
    const item = getConfigItem();
    if (!item) return;
    setSkipReason('');
    setSkipModal({ taskId: item.id, taskTitle: item.title });
  };

  const confirmSkipToday = () => {
    if (!skipModal) return;
    const { taskId, taskTitle } = skipModal;
    updateAppData(prev => ({
      ...prev,
      skips: [...(prev.skips || []), { id: generateId(), taskId, taskTitle, date: dateKey, reason: skipReason.trim() }],
    }));
    setSkipModal(null);
    setSkipReason('');
    setConfigModal(null);
    setActiveNotification("Tâche sautée. Ce n'est pas un échec, c'est un choix. 🌿");
    setTimeout(() => setActiveNotification(null), 4000);
  };

  // Échap ferme d'abord la fenêtre « Sauter », sinon l'onglet Configuration
  useEffect(() => {
    if (!configModal && !skipModal && !logModal && !transferTask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (transferTask) { setTransferTask(null); return; }
      if (skipModal) setSkipModal(null);
      else if (logModal) { setLogModal(null); setCurrentLogText(""); }
      else setConfigModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [configModal, skipModal, logModal, transferTask]);

  // Récurrence : appliquée en une seule mise à jour au plan global ET à toutes les
  // copies « figées » des jours à partir d'aujourd'hui (l'app fige un jour dès qu'on
  // le modifie dans l'onglet Routine — plier un bloc suffit). Sans ça, un changement
  // fait dans Planning ne touchait ni aujourd'hui ni les jours déjà visités.
  // Les jours passés restent intacts pour préserver l'historique.
  const applyItemFields = (fields: Record<string, any>) => {
    if (!configModal) return;
    const { type, id, blockId, parentTaskId } = configModal;

    if (type === 'goal') {
      updateAppData(prev => ({ ...prev, recurringGoals: prev.recurringGoals.map(g => g.id === id ? { ...g, ...fields } : g) }));
      return;
    }

    const updater = (blocks: Block[]): Block[] => {
      if (type === 'block') return blocks.map(b => b.id === id ? { ...b, ...fields } : b);
      return blocks.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          tasks: b.tasks.map(t => {
            if (parentTaskId) {
              if (t.id !== parentTaskId) return t;
              return { ...t, subTasks: (t.subTasks || []).map(st => st.id === id ? { ...st, ...fields } : st) };
            }
            return t.id === id ? { ...t, ...fields } : t;
          })
        };
      });
    };

    const todayKey = getKeyFromDate(new Date());
    const isRecurrenceChange = 'recurrence' in fields || 'startDate' in fields || 'endDate' in fields || 'specificDate' in fields;
    updateAppData(prev => {
      const days = { ...prev.days };
      Object.keys(days).forEach(k => {
        const d = days[k];
        if (d?.blocks && (k >= todayKey || k === dateKey)) days[k] = { ...d, blocks: updater(d.blocks) };
      });
      let blocks = updater(prev.blocks);

      // Tâche ajoutée dans l'onglet Routine (elle n'existe que pour ce jour) :
      // appliquer une récurrence la copie dans le bloc du plan, pour qu'elle
      // apparaisse chaque jour couvert, et dans les jours déjà « figés » couverts.
      if (type === 'task' && !parentTaskId && isRecurrenceChange) {
        const inPlan = blocks.some(b => b.id === blockId && b.tasks.some(t => t.id === id));
        const srcBlock = (days[dateKey]?.blocks || []).find(b => b.id === blockId);
        const srcTask = srcBlock?.tasks.find(t => t.id === id);
        if (!inPlan && srcBlock && srcTask) {
          const promoted: Task = JSON.parse(JSON.stringify(srcTask));
          if (blocks.some(b => b.id === blockId)) {
            blocks = blocks.map(b => b.id === blockId ? { ...b, tasks: [...b.tasks, promoted] } : b);
          } else {
            // Bloc exceptionnel du jour : il suit la même période que la tâche
            const { tasks: _t, ...blockRest } = JSON.parse(JSON.stringify(srcBlock));
            blocks = [...blocks, { ...blockRest, recurrence: promoted.recurrence, specificDate: promoted.specificDate, startDate: promoted.startDate, endDate: promoted.endDate, tasks: [promoted] }];
          }
          Object.keys(days).forEach(k => {
            const d = days[k];
            if (!d?.blocks || k <= dateKey || k < todayKey) return;
            if (!isDateInRange(new Date(k + 'T12:00:00'), promoted.recurrence, promoted.specificDate, promoted.startDate, promoted.endDate, promoted.stopDate)) return;
            const hasBlock = d.blocks.some(b => b.id === blockId);
            const newBlocks = hasBlock
              ? d.blocks.map(b => b.id === blockId && !b.tasks.some(t => t.id === id) ? { ...b, tasks: [...b.tasks, JSON.parse(JSON.stringify(promoted))] } : b)
              : d.blocks;
            days[k] = { ...d, blocks: newBlocks };
          });
        }
      }
      return { ...prev, blocks, days };
    });
  };

  // Vrai si la tâche configurée n'existe que pour le jour affiché (ajoutée dans Routine)
  const isDayOnlyConfigItem = (): boolean => {
    if (!configModal || configModal.type !== 'task' || configModal.parentTaskId || activeTab !== 'routine') return false;
    if (!appData.days[dateKey]?.blocks) return false;
    return !appData.blocks.some(b => b.id === configModal.blockId && b.tasks.some(t => t.id === configModal.id));
  };

  // Bornes concrètes pour « Cette semaine » (lundi → dimanche) et « Ce mois »,
  // calculées à partir du jour affiché.
  const getRecurrenceBounds = (recurrence: RecurrenceType, current: any) => {
    const base = new Date(currentDate);
    if (recurrence === 'week') {
      const offset = (base.getDay() + 6) % 7; // lundi = 0
      const start = new Date(base); start.setDate(base.getDate() - offset);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { startDate: getKeyFromDate(start), endDate: getKeyFromDate(end) };
    }
    if (recurrence === 'month') {
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      return { startDate: getKeyFromDate(start), endDate: getKeyFromDate(end) };
    }
    if (recurrence === 'period') {
      const s0 = current.recurrence === 'period' && current.startDate ? current.startDate : dateKey;
      const e0 = current.recurrence === 'period' && current.endDate ? current.endDate : s0;
      return { startDate: s0, endDate: e0 };
    }
    return {};
  };

  const applyRecurrence = (recurrence: RecurrenceType) => {
    if (!configModal) return;
    const current: any = getConfigItem() || {};
    const fields: any = { recurrence, ...getRecurrenceBounds(recurrence, current), stopDate: undefined };
    if (recurrence === 'specific') fields.specificDate = current.specificDate || dateKey;
    if (recurrence === 'weekly') fields.specificDate = current.recurrence === 'weekly' && current.specificDate ? current.specificDate : dateKey;
    applyItemFields(fields);
  };

  // Les dates (précise / période) suivent la même règle que la récurrence
  const updateRecurrenceDate = (field: 'specificDate' | 'startDate' | 'endDate', value: string) => {
    applyItemFields({ [field]: value });
  };

  const formatDayLabel = (k?: string) => k ? new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.$/, '') : '?';

  // Phrase qui dit concrètement quand la tâche apparaît
  const describeRecurrence = (item: any): string => {
    const base = describeRecurrenceRaw(item).replace(/\.\.$/, '.');
    if (item?.stopDate && !['specific', 'once'].includes(item.recurrence)) return base.replace(/\.$/, '') + ` — jusqu'au ${formatDayLabel(item.stopDate)}.`;
    return base;
  };
  const describeRecurrenceRaw = (item: any): string => {
    if (!item) return '';
    const fmt = (k?: string) => k ? new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '?';
    switch (item.recurrence || 'daily') {
      case 'daily': return 'Visible tous les jours.';
      case 'weekdays': return 'Visible du lundi au vendredi.';
      case 'weekends': return 'Visible le samedi et le dimanche.';
      case 'week': return item.startDate ? `Visible cette semaine uniquement : du ${fmt(item.startDate)} au ${fmt(item.endDate)}.` : 'Visible cette semaine.';
      case 'month': return item.startDate ? `Visible ce mois uniquement : du ${fmt(item.startDate)} au ${fmt(item.endDate)}.` : 'Visible ce mois-ci.';
      case 'period': return `Visible du ${fmt(item.startDate)} au ${fmt(item.endDate)}.`;
      case 'weekly': return item.specificDate ? `Visible chaque ${new Date(item.specificDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' })}, à partir du ${fmt(item.specificDate)}.` : 'Visible chaque semaine.';
      case 'specific': case 'once': return `Visible uniquement le ${fmt(item.specificDate)}.`;
      default: return '';
    }
  };

  const statsData = useMemo(() => {
    let start = new Date(); 
    let end = new Date();
    if (statsTimeframe === 'day') start.setHours(0, 0, 0, 0);
    else if (statsTimeframe === 'week') start.setDate(start.getDate() - 7);
    else if (statsTimeframe === 'month') start.setMonth(start.getMonth() - 1);
    else if (statsTimeframe === 'year') start.setFullYear(start.getFullYear() - 1);
    else if (statsTimeframe === 'custom') { 
      start = new Date(customRange.start); 
      end = new Date(customRange.end); 
    }
    return getPerfForRange(start, end);
  }, [statsTimeframe, customRange, getPerfForRange]);

  const getConfigItem = () => {
    if (!configModal) return null;
    const { type, id, blockId, parentTaskId } = configModal;
    if (type === 'goal') return appData.recurringGoals.find(g => g.id === id);
    const dayData = appData.days[dateKey];
    let blocks = appData.blocks;
    if (activeTab === 'routine' && dayData?.blocks) {
        blocks = dayData.blocks;
    }
    if (type === 'block') return blocks.find(b => b.id === id);
    const block = blocks.find(b => b.id === blockId);
    if (!block) return null;
    if (parentTaskId) {
        return block.tasks.find(t => t.id === parentTaskId)?.subTasks?.find(s => s.id === id);
    }
    return block.tasks.find(t => t.id === id);
  };

  const configItem = getConfigItem();
  const dayOnly = isDayOnlyConfigItem();
  const currentLevel = appData.userProfile?.level || 1;
  const currentXp = appData.userProfile?.xp || 0;
  const xpNextLevel = getNextLevelXp(currentLevel);
  const xpPrevLevel = getNextLevelXp(currentLevel - 1);
  const xpProgress = Math.min(100, Math.max(0, ((currentXp - xpPrevLevel) / (xpNextLevel - xpPrevLevel)) * 100));

  // Firebase Auth Handlers
  const handleSignIn = async () => {
    setIsSigningIn(true);
    setSyncError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Sign in error:', error);
      setSyncError(error?.code === 'auth/popup-closed-by-user' ? 'Connexion annulée' : 'Erreur de connexion');
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => { if (user) { setShowAuth(false); setAuthNotice(null); } }, [user]);
  useEffect(() => { if (authNotice && guestMode && !user) setShowAuth(true); }, [authNotice, guestMode, user]);

  // Retour de Google après une connexion par redirection (téléphone / app installée)
  useEffect(() => {
    completeRedirectSignIn().then(({ error, lost }) => {
      if (error) setAuthNotice(authErrorMessage(error));
      else if (lost) setAuthNotice(isIOS()
        ? "La connexion Google n'est pas revenue dans l'app. Sur iPhone, l'app installée ne peut pas récupérer la connexion Google : connecte-toi avec ton e-mail et un mot de passe, ou ouvre caddr-v2.netlify.app dans Safari."
        : "La connexion Google n'a pas abouti. Réessaie, ou connecte-toi avec ton e-mail et un mot de passe.");
    });
  }, []);

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      try { localStorage.removeItem('caddr_guest'); } catch {}
      setGuestMode(false);
    } catch (error) {
      console.error('Sign out error:', error);
      setSyncError('Erreur de déconnexion');
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#080708] flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={40} /></div>;

  // Page d'accueil : affichée tant que l'utilisateur n'est ni connecté ni en mode invité
  if (!user && !guestMode) {
    return <LandingPage onGoogle={handleSignIn} onGuest={enterGuest} isSigningIn={isSigningIn} error={authNotice || syncError} />;
  }

  return (
    <div className={`min-h-screen bg-[#F4F4F5] dark:bg-[#080708] text-[#18181B] dark:text-[#E6E8E6] font-['Plus_Jakarta_Sans'] transition-all duration-300 ${navPosition === 'left' ? (navCollapsed ? 'md:pl-20' : 'md:pl-52') + ' pb-32 md:pb-8' : 'pb-32'}`}>
      
      {/* Connexion / création de compte depuis le mode sans compte */}
      {showAuth && !user && (
        <div className="fixed inset-0 z-[150] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}>
          <div className="glass relative w-full max-w-md rounded-[2.5rem] max-h-[92vh] overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5">
            <button onClick={() => setShowAuth(false)} aria-label="Fermer" className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all"><X size={15} strokeWidth={3} /></button>
            <div className="pr-10">
              <h2 className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6]">Ton compte Caddr.</h2>
              <p className="text-xs font-medium text-[#18181B]/60 dark:text-[#E6E8E6]/60 mt-1">Sauvegarde tes données et retrouve-les sur tous tes appareils.</p>
            </div>
            <AuthPanel onGoogle={handleSignIn} googleBusy={isSigningIn} notice={authNotice} guestHint onDone={() => setShowAuth(false)} />
          </div>
        </div>
      )}

      {/* Active Notification Toast */}
      {activeNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in slide-in-from-top-4 duration-500">
          <div className="bg-accent p-5 rounded-3xl shadow-2xl flex items-center gap-4 border border-[#18181B]/10 dark:border-[#E6E8E6]/20">
            <div className="bg-white/20 p-3 rounded-2xl animate-bounce"><BellRing className="text-white" size={24} /></div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Rappel Caddr.</p>
              <p className="font-black text-sm text-white">{activeNotification}</p>
            </div>
            <button onClick={() => setActiveNotification(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} className="text-white" /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }} className="px-4 sm:px-6 py-4 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#F4F4F5]/80 dark:bg-[#080708]/80 backdrop-blur-xl sticky top-0 z-40 flex flex-col gap-4 max-w-4xl mx-auto w-full transition-colors duration-300">
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d); }} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#18181B] dark:hover:text-[#E6E8E6] transition-colors"><ChevronLeft size={20}/></button>
            <div className="text-center min-w-[80px]">
                <span className="block text-[8px] font-black text-accent uppercase tracking-widest">{currentDate.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                <span className="text-xs font-bold">{currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            </div>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d); }} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#18181B] dark:hover:text-[#E6E8E6] transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Backup Actions */}
            <div className="hidden sm:flex items-center gap-1 border-r border-[#18181B]/10 dark:border-[#E6E8E6]/10 pr-2 mr-1">
                <button onClick={handleUndo} disabled={history.length === 0} title="Annuler (Undo)" className={`p-2 rounded-xl transition-all ${history.length === 0 ? 'text-[#18181B]/20 dark:text-[#E6E8E6]/20 cursor-not-allowed bg-[#18181B]/5 dark:bg-[#E6E8E6]/5' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent'}`}>
                    <RotateCcw size={16} />
                </button>
                <button onClick={handleManualSave} title="Enregistrer tout (Persistance)" className="p-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all">
                <Save size={16} />
                </button>
                <button onClick={handleExportData} title="Sauvegarder JSON" className="p-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all">
                <Download size={16} />
                </button>
                <input type="file" ref={backupInputRef} onChange={handleImportData} className="hidden" accept=".json" />
                <button onClick={() => backupInputRef.current?.click()} title="Restaurer JSON" className="p-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all">
                <Upload size={16} />
                </button>
            </div>
            
            {/* Firebase Sync Status */}
            {user ? (
              <div className="flex items-center gap-2 px-2 py-1 glass rounded-lg border-l-2 border-accent">
                {(() => {
                  // État de la synchronisation, en clair
                  const st = !isOnline ? 'offline' : syncError ? 'error' : isSaving ? 'saving' : lastSyncTime ? 'saved' : 'saving';
                  const ago = lastSyncTime ? Math.max(0, Math.round((currentTime.getTime() - lastSyncTime.getTime()) / 60000)) : 0;
                  const label = st === 'offline' ? 'Hors ligne · gardé sur l’appareil' : st === 'error' ? 'Synchro en échec · nouvel essai' : st === 'saving' ? 'Enregistrement…' : ago < 1 ? 'Synchronisé à l’instant' : `Synchronisé il y a ${ago < 60 ? ago + ' min' : Math.round(ago / 60) + ' h'}`;
                  const Icon = st === 'offline' ? CloudOff : st === 'saving' ? Loader2 : Cloud;
                  return (
                    <>
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${st === 'saving' ? 'animate-spin text-accent' : st === 'saved' ? 'text-accent' : st === 'offline' ? 'text-[#B8900A] dark:text-[#FDCA40]' : 'text-[#DF2935]'}`} />
                      <div className="flex flex-col min-w-0" title={lastSyncTime ? `Dernière synchronisation : ${lastSyncTime.toLocaleString('fr-FR')}` : undefined}>
                        <span className="text-[9px] font-bold truncate max-w-[110px]">{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>
                        <span className={`text-[8px] truncate max-w-[130px] ${st === 'error' ? 'text-[#DF2935]' : st === 'offline' ? 'text-[#B8900A] dark:text-[#FDCA40]' : 'opacity-60'}`} aria-live="polite">{label}</span>
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={handleSignOut}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                disabled={isSigningIn}
                className="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 border border-accent/30"
                title="Créer un compte ou se connecter pour sauvegarder et synchroniser"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-[#18181B]/60 dark:text-[#E6E8E6]/60" />
                )}
                <span className="text-[9px] font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60">
                  {isSigningIn ? 'Connexion...' : 'Se connecter'}
                </span>
              </button>
            )}
            
            <button onClick={toggleTheme} className="p-2 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 transition-all hover:text-accent">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button onClick={() => setShowAssistant(true)} title="Cady, ton assistante (Ctrl+K)" aria-label="Ouvrir Cady" className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-accent text-white shadow-lg shadow-accent/25 hover:scale-105 active:scale-95 transition-all"><Sparkles size={15} /><span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">Cady</span></button>
            <button onClick={requestNotificationPermission} className={`p-2 rounded-xl transition-all ${notificationsEnabled ? 'text-accent bg-accent/10' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5'}`}>{notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}</button>
            {activeTab === 'routine' && <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), simpleMode: !prev.settings?.simpleMode } }))} title="Mode journée simplifiée" className={`p-2 rounded-xl transition-all ${appData.settings?.simpleMode ? 'bg-accent text-white' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}><Minimize2 size={16} /></button>}
            {activeTab === 'routine' && <button onClick={() => setIsReorderMode(!isReorderMode)} title={isReorderMode ? "Terminer le réordonnancement" : "Réordonner les blocs"} className={`p-2 rounded-xl transition-all ${isReorderMode ? 'bg-accent text-white' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}><MoveVertical size={16} /></button>}
            <div className="bg-accent/10 px-3 py-1 rounded-full text-[10px] font-black text-accent border border-accent/20">{perfToday}%</div>
            </div>
        </div>

        {/* Barre d'en-tête : discipline du mois (défaut) ou niveau XP — touche pour basculer */}
        {headerBar === 'discipline' ? (
          <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), headerBar: 'xp' } }))} title="Touche pour afficher le niveau XP" className="relative pt-1 w-full text-left block">
            <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-black text-accent uppercase tracking-wider flex items-center gap-1"><Target size={12} /> Discipline · {monthDiscipline.label}</span>
                    {monthDiscipline.delta !== null && <span className={`text-[8px] font-black uppercase tracking-widest ${monthDiscipline.delta >= 0 ? 'text-accent' : 'text-[#DF2935]'}`}>{monthDiscipline.delta >= 0 ? '▲' : '▼'} {Math.abs(monthDiscipline.delta)} pt{Math.abs(monthDiscipline.delta) > 1 ? 's' : ''} vs {monthDiscipline.prevLabel}</span>}
                </div>
                <span className="text-[8px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest whitespace-nowrap"><span className="text-[11px] text-[#18181B] dark:text-[#E6E8E6]" style={monthDiscipline.total ? perfStyle(monthDiscipline.rate) : undefined}>{monthDiscipline.total ? `${monthDiscipline.rate} %` : '—'}</span> · {monthDiscipline.done}/{monthDiscipline.total}</span>
            </div>
            <div className="h-1.5 w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700 ease-out" style={{ width: `${monthDiscipline.rate}%`, backgroundColor: perfColor(monthDiscipline.rate) }} />
            </div>
          </button>
        ) : (
          <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), headerBar: 'discipline' } }))} title="Touche pour afficher la discipline du mois" className="relative pt-1 w-full text-left block">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-[#FDCA40] uppercase tracking-wider flex items-center gap-1"><Crown size={12} /> Lvl {currentLevel}</span>
                    <span className="text-[8px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest">• {getRankTitle(currentLevel)}</span>
                </div>
                <span className="text-[8px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest">{Math.floor(currentXp)} / {xpNextLevel} XP</span>
            </div>
            <div className="h-1.5 w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#FDCA40] transition-all duration-700 ease-out shadow-[0_0_10px_rgba(253,202,64,0.3)]" 
                    style={{ width: `${xpProgress}%` }} 
                />
            </div>
          </button>
        )}
        {import.meta.env.VITE_DEMO === '1' && (
          <p className="text-[10px] font-bold text-center rounded-xl px-3 py-2 bg-[#FDCA40]/15 text-[#B8900A] dark:text-[#FDCA40]">Version de démonstration · données d'exemple, gardées seulement dans ce navigateur · connexion, synchronisation et assistante Cady désactivées ici</p>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-4 space-y-8 pb-24 md:pb-16">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" size={28} /></div>}>
        
        {/* TAB: ROUTINE */}
        {activeTab === 'routine' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {daysAway !== null && (
              <div className="glass p-5 rounded-[2rem] border border-accent/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                <Sparkles size={20} className="text-accent shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Content de vous revoir 🌱</p>
                  <p className="text-xs font-medium text-[#18181B]/60 dark:text-[#E6E8E6]/60 mt-1">
                    {daysAway} jours d'absence, et alors ? Pas de culpabilité, pas de retard à rattraper. Reprenez tout en douceur : cochez une seule petite chose aujourd'hui, ça suffit pour relancer la machine.
                  </p>
                </div>
                <button onClick={() => setDaysAway(null)} className="shrink-0 p-1.5 rounded-lg text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent"><X size={16} /></button>
              </div>
            )}
            {!isReorderMode && dateKey === todayKeyNow && late.length > 0 && (
              <div className="glass rounded-[2rem] p-4 sm:p-5 border border-[#DF2935]/30 space-y-2.5 animate-in slide-in-from-top-2" role="alert" aria-label="Tâches en retard">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#DF2935] flex items-center gap-1.5"><AlarmClock size={13} /> Pas encore fait{late.length > 1 ? ` (${late.length})` : ''}</p>
                {late.slice(0, 3).map(t => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-[13px] font-bold text-[#18181B] dark:text-[#E6E8E6]">{t.title}</p>
                      <p className="text-[10px] font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55">Prévue à {t.start.replace(':', 'h')} · {t.block}</p>
                    </div>
                    <button onClick={() => handleReminderAction('done', t.id, todayKeyNow)} className="px-3 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider">Fait</button>
                    <button onClick={() => handleReminderAction('later', t.id, todayKeyNow)} className="px-3 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6] hover:text-accent">{t.oneOff ? 'Demain' : 'Sauter'}</button>
                    <button onClick={() => setLateDismissed(d => [...d, t.id])} aria-label="Ignorer" className="p-2 rounded-xl text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            {!isReorderMode && dateKey === todayKeyNow && briefing && (
              <MorningBriefing b={briefing} name={user?.displayName?.split(' ')[0] || undefined}
                onAskClaude={() => askClaude(PROMPTS.morning)} onOpenPlanning={() => setActiveTab('schedule')}
                onHide={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), briefingHiddenOn: todayKeyNow } }))} />
            )}
            {!isReorderMode && dateKey === todayKeyNow && eveningDue && (
              <div className="glass p-4 sm:p-5 rounded-[2rem] border border-accent/25 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-2">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0"><Moon size={18} className="text-accent" /></div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Bilan du soir</p>
                  <p className="text-[11px] font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55">Coche, reporte, note ton ressenti et ton journal : 3 minutes.</p>
                </div>
                <button onClick={() => setShowEvening(true)} className="px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Commencer</button>
                <button onClick={() => askClaude(PROMPTS.evening)} className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6] hover:text-accent"><Sparkles size={12} /> Avec Cady</button>
              </div>
            )}
            {!isReorderMode && dateKey === todayKeyNow && showJournalPrompt && (
              <button onClick={() => setActiveTab('journal')} className="w-full glass p-4 sm:p-5 rounded-[2rem] border border-[#FDCA40]/25 flex items-center gap-3 text-left animate-in slide-in-from-top-2 hover:border-[#FDCA40]/50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#FDCA40]/15 flex items-center justify-center shrink-0"><BookHeart size={18} className="text-[#B8900A] dark:text-[#FDCA40]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Mon journal du soir</p>
                  <p className="text-[11px] font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55">3 gratitudes et 3 fiertés avant de clore la journée.</p>
                </div>
                <ChevronRight size={18} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 shrink-0" />
              </button>
            )}
            {!isReorderMode && dateKey === todayKeyNow && showWeekPlanPrompt && (
              <div className="glass p-4 sm:p-5 rounded-[2rem] border border-accent/25 flex items-center gap-3 animate-in slide-in-from-top-2">
                <div className="hidden sm:flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center shrink-0"><Sparkles size={18} className="text-accent" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Planifier ma semaine</p>
                  <p className="text-[11px] font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55"><span className="sm:hidden">Bilan, reports, objectif · 3 min</span><span className="hidden sm:inline">Bilan, tâches à reporter et objectif de la semaine : 3 minutes.</span></p>
                </div>
                <button onClick={() => setShowWeekPlanner(true)} className="shrink-0 px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Commencer</button>
                <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), weekPlanDismissed: weekPlan.planKey } }))} aria-label="Plus tard" title="Plus tard (reste disponible dans Planning)" className="shrink-0 p-1.5 rounded-lg text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent"><X size={16} /></button>
              </div>
            )}
            {!isReorderMode && dateKey === todayKeyNow && pendingItems.length > 0 && (
              <CarryOver items={pendingItems} todayKey={todayKeyNow}
                onMove={(id, k) => { saveToHistory(); handleRescheduleTask(id, k); }}
                onInbox={(id) => { saveToHistory(); updateAppData(prev => sendToInbox(prev, id)); setActiveNotification('Renvoyée dans la Boîte de tâches 📥'); setTimeout(() => setActiveNotification(null), 2500); }}
                onAbandon={(p) => { updateAppData(prev => ({ ...prev, skips: [...(prev.skips || []), { id: generateId(), taskId: p.task.id, taskTitle: p.task.title, date: p.date, reason: 'Abandonnée' }] })); setActiveNotification('Tâche abandonnée. Choisir, c\'est aussi avancer. 🌿'); setTimeout(() => setActiveNotification(null), 2500); }}
                onHide={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), carryHiddenOn: todayKeyNow } }))} />
            )}
            {!isReorderMode && dateKey === getKeyFromDate(new Date()) && (nowNextData.current || nowNextData.next) && (
              <NowNext
                current={nowNextData.current}
                next={nowNextData.next}
                nowMin={nowNextData.nowMin}
                onStartFocus={(blockId, taskId) => {
                  const block = routineBlocks.find(b => b.id === blockId);
                  const task = block?.tasks.find(t => t.id === taskId) || getVisibleTasks(block?.tasks || []).find(t => t.id === taskId);
                  if (block && task) setFocusTarget({ task, blockId, blockTitle: block.title, micro: true });
                }}
                onComplete={(blockId, taskId) => toggleTask(blockId, taskId)}
              />
            )}
            {/* Disclaimer for Detached Mode */}
            {appData.days[dateKey]?.blocks && (
               <div className="bg-[#FDCA40]/5 border border-[#FDCA40]/10 p-3 rounded-2xl flex items-center justify-center gap-2 animate-in fade-in">
                  <Info size={12} className="text-[#FDCA40]" />
                  <span className="text-[8px] font-black text-[#FDCA40] uppercase tracking-widest">Routine personnalisée pour ce jour</span>
                  <button onClick={() => updateAppData(prev => { const d = { ...prev.days }; delete d[dateKey].blocks; return { ...prev, days: d }; })} className="ml-2 text-[8px] underline text-[#FDCA40] hover:text-white">Rétablir</button>
               </div>
            )}

            <div className={`glass p-6 rounded-3xl flex items-center gap-4 border-l-4 transition-all ${currentDayData.goalCompleted ? 'border-l-accent bg-accent/5' : 'border-l-accent'}`}>
              <button onClick={toggleDailyGoal} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${currentDayData.goalCompleted ? 'bg-accent shadow-lg shadow-accent/20 text-white' : 'bg-accent/10 text-accent'}`}>{currentDayData.goalCompleted ? <Check size={24} /> : <Target size={24} />}</button>
              <div className="flex-1">
                <div className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">Objectif Prioritaire {currentGoal && <Repeat size={8} className="text-accent" />} {currentGoalReminder && <Clock size={8} className="text-accent ml-1" />} <span className="text-accent normal-case ml-1 font-black">{currentGoalReminder}</span></span>
                    <button onClick={() => { const id = generateId(); updateAppData(prev => { const existingGoal = (prev.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate)); if (existingGoal) { setConfigModal({ type: 'goal', id: existingGoal.id }); return prev; } setConfigModal({ type: 'goal', id }); return { ...prev, recurringGoals: [...(prev.recurringGoals || []), { id, title: currentGoal || "Nouvel Objectif", recurrence: 'specific', specificDate: dateKey }] }; }); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Clock size={12} /></button>
                </div>
                <input className="bg-transparent w-full text-base sm:text-lg font-bold outline-none placeholder-[#18181B]/30 dark:placeholder-[#E6E8E6]/30 text-[#18181B] dark:text-[#E6E8E6]" placeholder="Focus du jour..." value={currentGoal} onChange={e => updateAppData(prev => ({ ...prev, days: { ...prev.days, [dateKey]: { ...currentDayData, dailyGoalOverride: e.target.value } } }))} />
              </div>
            </div>

            {/* Habitudes du jour (habitudes indépendantes des blocs) */}
            {(() => {
              const todays = activeHabits(appData.habits).filter(h => h.showInRoutine !== false && (habitScheduled(h, dateKey) || h.entries?.[dateKey]?.s));
              if (!todays.length || dateKey > getKeyFromDate(new Date())) return null;
              const setStatus = (id: string, st: 'done' | 'fail') => updateAppData(prev => ({
                ...prev,
                habits: (prev.habits || []).map(h => {
                  if (h.id !== id) return h;
                  const cur = { ...(h.entries?.[dateKey] || {}) };
                  if (cur.s === st) delete cur.s; else cur.s = st;
                  const entries = { ...(h.entries || {}) };
                  if (!cur.s && !cur.note) delete entries[dateKey]; else entries[dateKey] = cur;
                  return { ...h, entries };
                }),
              }));
              return (
                <div className="glass p-5 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/60 dark:text-[#E6E8E6]/60 flex items-center gap-1.5"><Repeat size={12} className="text-accent" /> Habitudes du jour</p>
                    <button onClick={() => setActiveTab('habits')} className="text-[9px] font-black uppercase tracking-wider text-accent hover:opacity-70">Tout voir</button>
                  </div>
                  <div className="space-y-2">
                    {todays.map(h => {
                      const color = brandColor(h.color, accentHex); const st = habitStateOn(h, dateKey); const L = habitLabels(h); const stt = computeHabitStats(h);
                      return (
                        <div key={h.id} className="flex items-center gap-3">
                          <DayDot state={st} color={color} size={30} />
                          <button onClick={() => setActiveTab('habits')} className="flex-1 min-w-0 text-left">
                            <span className="block text-sm font-semibold truncate text-[#18181B] dark:text-[#E6E8E6]">{h.name}</span>
                            <span className="text-[9px] font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50 flex items-center gap-1"><Flame size={10} style={{ color }} /> {stt.current} j{h.kind === 'quit' ? ` · ${stt.sinceLastFail} j sans rechute` : ''}</span>
                          </button>
                          <button onClick={() => setStatus(h.id, 'done')} aria-pressed={st === 'done'} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all" style={st === 'done' ? { backgroundColor: color, borderColor: color, color: '#fff' } : { borderColor: `${color}55`, color }}>{L.done}</button>
                          <button onClick={() => setStatus(h.id, 'fail')} aria-pressed={st === 'fail'} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${st === 'fail' ? 'bg-[#DF2935]/10 border-[#DF2935] text-[#DF2935]' : 'border-[#DF2935]/30 text-[#DF2935]/80'}`}>{L.fail}</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Daily Summary Card if review exists */}
            {currentDayData.reflection && (
               <div className="glass p-6 rounded-[2.5rem] border border-accent/10 bg-accent/[0.02] space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Quote size={14} className="text-accent fill-accent" />
                        <h3 className="text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Bilan de performance</h3>
                     </div>
                     {getMoodIcon(currentDayData.mood)}
                  </div>
                  <div className="text-sm font-medium text-[#18181B] dark:text-[#E6E8E6] italic leading-relaxed flex gap-1"><span>«</span><RichTextView html={currentDayData.reflection || ''} /><span>»</span></div>
                  
                  {currentDayData.aiFeedback && (
                    <div className="pt-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 space-y-3">
                       <div className="p-4 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                          <p className="text-[8px] font-black text-[#FDCA40] uppercase tracking-widest mb-1">Caddr. AI Insight</p>
                          <p className="text-xs text-[#18181B]/80 dark:text-[#E6E8E6]/80 leading-snug">{currentDayData.aiFeedback.feedback}</p>
                       </div>
                       <div className="flex items-center gap-3 px-1">
                          <Zap size={14} className="text-[#FDCA40]" />
                          <div>
                            <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase">Focus Demain</p>
                            <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{currentDayData.aiFeedback.focusTomorrow}</p>
                          </div>
                       </div>
                    </div>
                  )}
               </div>
            )}

            {routineBlocks.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="w-24 h-24 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full flex items-center justify-center border-2 border-dashed border-[#18181B]/10 dark:border-[#E6E8E6]/10">
                        <Layout size={32} className="text-[#18181B]/30 dark:text-[#E6E8E6]/30" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Aucune routine active</h3>
                        <p className="text-xs font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Commencez par créer votre système ou chargez un modèle.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setActiveTab('schedule')} className="px-6 py-3 bg-accent rounded-xl text-[#ffffff] text-[10px] font-black uppercase tracking-widest hover:bg-accent/80 transition-all shadow-lg shadow-accent/20">
                            Créer une routine
                        </button>
                        <button onClick={() => setActiveTab('templates')} className="px-6 py-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all">
                            Voir les modèles
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                    <SortableContext items={displayedRoutineBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    {displayedRoutineBlocks.map((block, bIdx) => {
                      const visibleTasks = getVisibleTasks(block.tasks);
                      const blockPercentage = (() => {
                        let total = 0, done = 0;
                        visibleTasks.forEach(t => { total++; if (t.completedDates?.includes(dateKey)) done++; const visST = getVisibleTasks(t.subTasks || []); visST.forEach(st => { total++; if (st.completedDates?.includes(dateKey)) done++; }); });
                        return total === 0 ? 0 : Math.round((done / total) * 100);
                      })();
                      return (
                        <Sortable key={block.id} id={block.id} disabled={!isReorderMode}>
                          {(blockHandle) => (
                        <div className="space-y-3">
                          <div className="px-2 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col flex-1">
                                <button onClick={() => toggleBlockCollapse(block.id)} className="text-left flex items-center gap-2 group/title focus:outline-none">
                                   <span className="p-1 rounded-lg bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 group-hover/title:bg-accent group-hover/title:text-white transition-all">
                                      {block.isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                   </span>
                                   <span className="font-heading text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-accent rounded-full" /> {block.title}</span>
                                </button>
                                {block.description && !block.isCollapsed && <p className="text-[8px] text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium ml-8 mt-0.5 whitespace-pre-wrap break-words animate-in slide-in-from-top-1 pr-4"><span dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.description || '') }} /></p>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-accent/80 uppercase tracking-wider">{blockPercentage}%</span>
                                {!block.isCollapsed && (
                                  <div className="flex gap-1 animate-in zoom-in-50">
                                    <button onClick={() => setConfigModal({ type: 'block', id: block.id })} className="p-2 sm:p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors" title="Configurer le bloc"><Settings2 size={14} /></button>
                                    <button onClick={() => { saveToHistory(); handleRoutineStructureChange(blocks => blocks.filter(b => b.id !== block.id)); }} className="p-2 sm:p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-colors" title="Supprimer le bloc (ce jour uniquement)"><Trash2 size={14} /></button>
                                    <button onClick={() => addTaskToBlock(block.id)} className="p-2 sm:p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Plus size={14} /></button>
                                    <button onClick={() => handleDuplicate('block', block.id)} className="p-2 sm:p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Copy size={14} /></button>
                                    {isReorderMode && <button {...blockHandle} className="cursor-grab active:cursor-grabbing touch-none p-1 text-accent" title="Glisser pour réordonner"><GripVertical size={14} /></button>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="w-full h-1 bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 rounded-full overflow-hidden"><div className="h-full bg-accent transition-all duration-500 ease-out shadow-[0_0_8px_rgba(47, 176, 166,0.5)]" style={{ width: `${blockPercentage}%` }} /></div>
                          </div>
                          {!block.isCollapsed && (
                            <div className="glass rounded-[2rem] overflow-hidden divide-y divide-[#18181B]/5 dark:divide-[#E6E8E6]/5 animate-in slide-in-from-top-2 duration-300">
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd(block.id)}>
                              <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                              {visibleTasks.map((task, tIdx) => {
                                const visibleSubTasks = getVisibleTasks(task.subTasks || []); const active = isTaskActive(task);
                                const priorityInfo = getPriorityInfo(task.priority);
                                const hasLogToday = !!task.executionNotes?.[dateKey];
                                
                                return (
                                  <Sortable key={task.id} id={task.id} disabled={!isReorderMode}>
                                    {(taskHandle) => (
                                  <div className={active ? 'bg-accent/5' : ''}>
                                    <div className={`flex items-center p-5 gap-4 group transition-colors ${isReorderMode ? 'bg-[#18181B]/[0.01] dark:bg-[#E6E8E6]/[0.01]' : 'cursor-pointer hover:bg-[#18181B]/[0.02] dark:hover:bg-[#E6E8E6]/[0.02]'}`} onClick={() => toggleTask(block.id, task.id)}>
                                      <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${task.completedDates?.includes(dateKey) ? 'bg-accent border-accent' : 'border-[#18181B]/20 dark:border-[#E6E8E6]/20'}`}>{task.completedDates?.includes(dateKey) && <Check size={14} className="text-white" strokeWidth={3} />}</div>
                                      {visibleSubTasks.length > 0 && (
                                        <button onClick={(e) => { e.stopPropagation(); toggleTaskCollapse(task.id); }} className="p-0.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent shrink-0" title={collapsedTasks[task.id] ? 'Déplier' : 'Replier'}>
                                          {collapsedTasks[task.id] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                        </button>
                                      )}
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <input 
                                              className={`bg-transparent text-sm font-semibold transition-all truncate outline-none w-full ${task.completedDates?.includes(dateKey) ? 'line-through text-[#18181B]/40 dark:text-[#E6E8E6]/40' : 'text-[#18181B] dark:text-[#E6E8E6]'}`} 
                                              value={task.title}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => {
                                                  const v = e.target.value;
                                                  handleRoutineStructureChange(blocks => blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, title: v } : t) } : b));
                                              }}
                                            />
                                            {hasLogToday && <BookOpen size={10} className="text-accent shrink-0" />}
                                            {!task.completedDates?.includes(dateKey) && task.priority && task.priority !== 'medium' && (
                                              <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${priorityInfo.bg} ${priorityInfo.color} tracking-widest shrink-0`}>
                                                {priorityInfo.label}
                                              </span>
                                            )}
                                          </div>
                                          {task.description && !task.completedDates?.includes(dateKey) && (
                                            <p className="text-[10px] text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium mb-1 line-clamp-2 leading-relaxed">
                                              {stripHtml(task.description)}
                                            </p>
                                          )}
                                          {task.startTime && <span className={`text-[9px] font-black flex items-center gap-1 mt-0.5 ${active ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'} uppercase tracking-widest`}><Clock size={10} /> {formatTaskTime(task.startTime, task.duration)}{active && <span className="ml-2 flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>}</span>}
                                          {task.stackAnchor && <span className="text-[9px] font-bold flex items-center gap-1 mt-0.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 italic"><Link2 size={9} /> après {task.stackAnchor}</span>}
                                          {task.deadline && !task.completedDates?.includes(dateKey) && (() => { const late = task.deadline < getKeyFromDate(new Date()); const today = task.deadline === getKeyFromDate(new Date()); return <span className={`text-[9px] font-black flex items-center gap-1 mt-0.5 uppercase tracking-widest ${late || today ? 'text-[#DF2935]' : 'text-[#FDCA40]'}`}><Hourglass size={10} /> {late ? 'En retard · ' : today ? "Échéance aujourd'hui · " : 'Échéance · '}{formatDayLabel(task.deadline)}</span>; })()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); openLogModal(task, block.id); }}
                                          className={`opacity-0 group-hover:opacity-100 p-2 transition-all ${hasLogToday ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent'}`}
                                          title="Journal de bord"
                                        >
                                          <BookOpen size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setConfigModal({ type: 'task', id: task.id, blockId: block.id }); }}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-all"
                                        >
                                          <Settings2 size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDuplicate('task', task.id, block.id); }}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-all"
                                          title="Dupliquer"
                                        >
                                          <Copy size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => { 
                                              e.stopPropagation(); 
                                              saveToHistory();
                                              handleRoutineStructureChange(blocks => blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.filter(t => t.id !== task.id) } : b)); 
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-all"
                                          title="Supprimer"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                        {isReorderMode && <button {...taskHandle} onClick={(e) => e.stopPropagation()} className="cursor-grab active:cursor-grabbing touch-none text-accent p-1" title="Glisser pour réordonner"><GripVertical size={14}/></button>}
                                      </div>
                                    </div>
                                    {visibleSubTasks.length > 0 && !collapsedTasks[task.id] && <div className="pl-14 pr-5 pb-5 space-y-3">{visibleSubTasks.map(st => {
                                      const stPriority = getPriorityInfo(st.priority);
                                      const stHasLog = !!st.executionNotes?.[dateKey];
                                      return (
                                        <div key={st.id} className="flex flex-col gap-1 group/sub cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleTask(block.id, st.id, task.id); }}>
                                          <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all ${st.completedDates?.includes(dateKey) ? 'bg-accent/80 border-accent' : 'border-[#18181B]/20 dark:border-[#E6E8E6]/20'}`}>{st.completedDates?.includes(dateKey) && <Check size={10} className="text-white" strokeWidth={3} />}</div>
                                            <input 
                                              className={`bg-transparent text-xs font-medium flex-1 transition-all truncate outline-none ${st.completedDates?.includes(dateKey) ? 'line-through text-[#18181B]/40 dark:text-[#E6E8E6]/40' : 'text-[#18181B]/80 dark:text-[#E6E8E6]/80'}`}
                                              value={st.title}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => {
                                                  const v = e.target.value;
                                                  handleRoutineStructureChange(blocks => blocks.map(b => b.id === block.id ? { 
                                                          ...b, 
                                                          tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: (t.subTasks || []).map(s => s.id === st.id ? { ...s, title: v } : s) } : t) 
                                                      } : b));
                                              }}
                                            />
                                            {stHasLog && <BookOpen size={8} className="text-accent shrink-0" />}
                                            <div className="flex items-center gap-2">
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); openLogModal(st, block.id, task.id); }}
                                                  className={`opacity-0 group-hover/sub:opacity-100 p-1.5 transition-all ${stHasLog ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent'}`}
                                              >
                                                  <BookOpen size={14} />
                                              </button>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setConfigModal({ type: 'task', id: st.id, blockId: block.id, parentTaskId: task.id }); }}
                                                  className="opacity-0 group-hover/sub:opacity-100 p-1.5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-all"
                                              >
                                                  <Settings2 size={14} />
                                              </button>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); handleDuplicate('subtask', st.id, task.id, block.id); }}
                                                  className="opacity-0 group-hover/sub:opacity-100 p-1.5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-all"
                                                  title="Dupliquer"
                                              >
                                                  <Copy size={14} />
                                              </button>
                                              <button 
                                                  onClick={(e) => { 
                                                      e.stopPropagation(); 
                                                      saveToHistory();
                                                      handleRoutineStructureChange(blocks => blocks.map(b => b.id === block.id ? { 
                                                          ...b, 
                                                          tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: (t.subTasks || []).filter(s => s.id !== st.id) } : t) 
                                                      } : b)); 
                                                  }}
                                                  className="opacity-0 group-hover/sub:opacity-100 p-1.5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-all"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                              {!st.completedDates?.includes(dateKey) && st.priority && st.priority !== 'medium' && (
                                                  <div className={`w-1.5 h-1.5 rounded-full ${stPriority.color.replace('text', 'bg')}`} />
                                              )}
                                            </div>
                                          </div>
                                          {st.description && !st.completedDates?.includes(dateKey) && (
                                            <p className="ml-7 text-[10px] text-[#18181B]/50 dark:text-[#E6E8E6]/50 line-clamp-1">{stripHtml(st.description)}</p>
                                          )}
                                        </div>
                                      );
                                    })}</div>}
                                  </div>
                                    )}
                                  </Sortable>
                                );
                              })}
                              </SortableContext>
                              </DndContext>
                            </div>
                          )}
                        </div>
                          )}
                        </Sortable>
                      );
                    })}
                    </SortableContext>
                    </DndContext>
                    
                    {/* NEW BUTTON: ADD LOCAL BLOCK */}
                    <div className="pt-2 pb-2 animate-in slide-in-from-bottom-2">
                        <button 
                            onClick={addLocalBlock}
                            className="w-full py-4 border-2 border-dashed border-accent/20 rounded-[2rem] text-[10px] font-black text-accent uppercase hover:bg-accent/10 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Ajouter un bloc exceptionnel pour aujourd'hui
                        </button>
                    </div>

                    {routineBlocks.length > 0 && (
                      <div className="pt-4 animate-in slide-in-from-bottom-4">
                        <button 
                          onClick={() => setShowReviewModal(true)}
                          className="w-full glass p-8 rounded-[2.5rem] border-2 border-dashed border-accent/20 hover:border-accent/50 transition-all group flex flex-col items-center gap-4"
                        >
                           <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <ClipboardCheck className="text-accent" size={28} />
                           </div>
                           <div className="text-center">
                              <p className="text-sm font-black uppercase tracking-widest text-[#18181B] dark:text-[#E6E8E6]">{currentDayData.reflection ? "Mettre à jour le bilan" : "Terminer la journée"}</p>
                              <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold mt-1 uppercase">Faire le bilan de vos accomplissements</p>
                           </div>
                        </button>
                      </div>
                    )}
                </>
            )}
          </div>
        )}

        {/* ... (Existing Tabs kept) */}
        {/* TAB: PLANNING / SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
            {!templateEditState && (
              <Agenda appData={appData} date={currentDate} now={currentTime} view={planningView} onViewChange={setPlanningView}
                onDateChange={setCurrentDate} onToggle={(b, t) => toggleTask(b, t)} onOpenTask={(b, t) => setConfigModal({ type: 'task', id: t, blockId: b })}
                onSetTime={setTaskTime} onMoveTask={handleRescheduleTask} onQuickAdd={quickAddTask}
                calendars={externalCalendars} eventsOf={cal.eventsOf} calVersion={cal.version}
                onOpenCalendars={() => setShowCalendars(true)} onPlanWeek={() => setShowWeekPlanner(true)}
                aiLighten={user ? getLightenPlan : undefined} onApplyLighten={applyLighten} />
            )}
            {!templateEditState && (
              <LongTermGoals
                goals={appData.longTermGoals || []} appData={appData} onAskClaude={askClaude}
                onChange={(goals) => updateAppData(prev => ({ ...prev, longTermGoals: goals }))}
              />
            )}
            {/* ... Existing Schedule Code ... */}
             {templateEditState ? (
              <div className="glass p-6 rounded-[2rem] space-y-4 border border-[#FDCA40]/20 bg-[#FDCA40]/5 animate-in slide-in-from-top-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-black uppercase tracking-wider text-sm text-[#FDCA40]">ÉDITION DE MODÈLE</h2>
                    <p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase">Modification de structure</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={cancelTemplateEditing} className="px-4 py-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-[#18181B]/10 dark:hover:bg-[#E6E8E6]/10 text-[10px] font-black uppercase transition-all">Annuler</button>
                    <button onClick={saveTemplateEditing} className="px-4 py-2 bg-[#FDCA40] rounded-xl text-[#080708] hover:bg-[#FDCA40]/90 text-[10px] font-black uppercase transition-all shadow-lg flex items-center gap-2"><Save size={14} /> Enregistrer</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="bg-white dark:bg-[#080708]/30 p-3 rounded-xl text-xs font-bold border border-[#FDCA40]/20 outline-none text-[#18181B] dark:text-[#E6E8E6] placeholder-[#18181B]/20 dark:placeholder-[#E6E8E6]/20" placeholder="Nom du modèle" value={newTplName} onChange={e => setNewTplName(e.target.value)} />
                    <input className="bg-white dark:bg-[#080708]/30 p-3 rounded-xl text-xs font-bold border border-[#FDCA40]/20 outline-none text-[#18181B] dark:text-[#E6E8E6] placeholder-[#18181B]/20 dark:placeholder-[#E6E8E6]/20" placeholder="Objectif associé" value={newTplGoal} onChange={e => setNewTplGoal(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="glass p-5 sm:p-6 rounded-[2rem] flex flex-wrap items-center justify-between gap-4 border border-accent/20 bg-accent/5">
                <div><h2 className="font-black uppercase tracking-wider text-sm text-[#18181B] dark:text-[#E6E8E6]">PLANNING CADDR.</h2><p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase">Structure & Objectifs</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setTemplateModal(true)} title="Enregistrer comme modèle" className="p-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all"><Save size={20} /></button>
                  <button onClick={() => setShowAiGen(true)} title="Générer avec IA" className="p-3 bg-[#FDCA40] rounded-2xl text-[#080708] shadow-lg"><Wand2 size={20} /></button>
                  <input type="file" ref={fileInputRef} onChange={handleVisionImport} className="hidden" accept="image/*" />
                  <button onClick={() => fileInputRef.current?.click()} title="Importer image" className="p-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent"><Camera size={20} /></button>
                  <button onClick={() => setShowResetModal(true)} title="Arrêter / Changer de Routine" className="p-3 bg-[#DF2935]/10 border border-[#DF2935]/20 rounded-2xl text-[#DF2935] hover:bg-[#DF2935] hover:text-white transition-all"><Power size={20} /></button>
                  <button onClick={() => updateAppData(prev => ({ ...prev, blocks: [...prev.blocks, { id: generateId(), title: "Nouveau Bloc", tasks: [], recurrence: 'daily', isCollapsed: true }] }))} className="p-3 bg-accent rounded-2xl text-white shadow-lg"><Plus size={20} /></button>
                </div>
              </div>
            )}
            
            {/* Recurring Goals Section */}
            <div className="glass p-6 rounded-[2.5rem] space-y-4">
               <div className="flex items-center justify-between px-2"><h3 className="text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest flex items-center gap-2"><Target size={12} className="text-accent" /> Objectifs Programmés</h3><button onClick={() => updateAppData(prev => ({ ...prev, recurringGoals: [...(prev.recurringGoals || []), { id: generateId(), title: "Objectif Sport", recurrence: 'daily' }] }))} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent"><Plus size={16} /></button></div>
               <div className="space-y-2">
                  {(appData.recurringGoals || []).map(goal => (
                    <div key={goal.id} className="flex flex-col gap-2 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-4 rounded-3xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex flex-col"><input className="bg-transparent text-xs font-bold outline-none text-[#18181B] dark:text-[#E6E8E6]" value={goal.title} onChange={e => updateAppData(prev => ({ ...prev, recurringGoals: prev.recurringGoals.map(g => g.id === goal.id ? { ...g, title: e.target.value } : g) }))} /><div className="flex items-center gap-2 mt-1"><span className="text-[7px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-1.5 py-0.5 rounded-full">{goal.recurrence}</span>{goal.reminderTime && (<span className="flex items-center gap-1 text-[7px] font-black text-accent uppercase bg-accent/10 px-1.5 py-0.5 rounded-full"><Clock size={8} /> {goal.reminderTime}</span>)}</div></div>
                        <button onClick={() => setConfigModal({ type: 'goal', id: goal.id })} className="p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent"><Settings2 size={14} /></button>
                        <button onClick={() => { saveToHistory(); updateAppData(prev => ({ ...prev, recurringGoals: prev.recurringGoals.filter(g => g.id !== goal.id) })); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] p-2"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleEngineBlockDragEnd}>
              <SortableContext items={appData.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {appData.blocks.map((block, bIdx) => (
                <Sortable key={block.id} id={block.id}>
                  {(blockHandle) => (
                <div className={`glass p-6 rounded-[2.5rem] space-y-4 group transition-all ${block.isLocked ? 'border-accent/20 bg-accent/[0.02]' : ''}`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button {...blockHandle} className="cursor-grab active:cursor-grabbing touch-none text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent shrink-0" title="Glisser pour réordonner"><GripVertical size={16}/></button>
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center gap-2">
                             <button onClick={() => toggleBlockCollapse(block.id)} className="p-1 rounded-lg bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all">
                                {block.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                             </button>
                             <input className="font-heading bg-transparent font-black text-sm outline-none border-b border-transparent focus:border-accent w-full text-[#18181B] dark:text-[#E6E8E6]" value={block.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, title: e.target.value } : b) }))} />
                             {block.isLocked && <Lock size={12} className="text-accent/60 shrink-0" />}
                          </div>
                          {block.description && !block.isCollapsed && <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-medium whitespace-pre-wrap break-words mt-1 ml-8"><span dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.description || '') }} /></p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateAppData(prev => ({...prev, blocks: prev.blocks.map(b => b.id === block.id ? {...b, isLocked: !b.isLocked} : b)}))} className={`p-2 rounded-xl transition-all ${block.isLocked ? 'text-accent bg-accent/10' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#E6E8E6] bg-[#18181B]/5 dark:bg-[#E6E8E6]/5'}`} title={block.isLocked ? "Déverrouiller" : "Verrouiller"}>
                             {block.isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
                        </button>
                        {!block.isLocked && (
                            <>
                                <button onClick={() => setConfigModal({ type: 'block', id: block.id })} className="px-3 py-1.5 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[9px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase transition-colors hover:text-accent">Config</button>
                                <button onClick={() => handleDuplicate('block', block.id)} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Copy size={18} /></button>
                                <button onClick={() => { saveToHistory(); updateAppData(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== block.id) })); }} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-colors"><Trash2 size={18}/></button>
                            </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!block.isCollapsed && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleEngineTaskDragEnd(block.id)}>
                      <SortableContext items={block.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {block.tasks.map((task, tIdx) => (
                        <Sortable key={task.id} id={task.id} disabled={block.isLocked}>
                          {(engineTaskHandle) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-4 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 group/task relative">
                            {!block.isLocked && (
                                <button {...engineTaskHandle} className="cursor-grab active:cursor-grabbing touch-none text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent shrink-0 -ml-1" title="Glisser pour réordonner"><GripVertical size={14} /></button>
                            )}
                            {(task.subTasks || []).length > 0 && (
                              <button onClick={() => toggleTaskCollapse(task.id)} className="p-0.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent shrink-0" title={collapsedTasks[task.id] ? 'Déplier' : 'Replier'}>
                                {collapsedTasks[task.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                  <input className="bg-transparent flex-1 text-xs font-semibold outline-none w-full text-[#18181B] dark:text-[#E6E8E6]" value={task.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, title: e.target.value } : t) } : b) }))} />
                                  {task.priority && task.priority !== 'medium' && (
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityInfo(task.priority).color.replace('text', 'bg')}`} title={getPriorityInfo(task.priority).label} />
                                  )}
                              </div>
                              {task.description && <p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 truncate mt-0.5">{stripHtml(task.description)}</p>}
                              {task.startTime && (<div className="flex items-center gap-2 mt-1"><span className="text-[7px] font-black text-accent uppercase tracking-widest bg-accent/10 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Clock size={8} /> {task.startTime}{task.duration && <span className="text-accent/60 ml-1">({task.duration}m)</span>}</span></div>)}
                            </div>
                            {!block.isLocked && (
                                <div className="flex items-center gap-1">
                                <button onClick={() => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: [...(t.subTasks || []), { id: generateId(), title: "Nouvelle sous-tâche", completedDates: [], recurrence: 'daily', subTasks: [] }] } : t) } : b) }))} title="Ajouter sous-tâche" className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors p-1"><ListPlus size={16}/></button>
                                <button onClick={() => setConfigModal({ type: 'task', id: task.id, blockId: block.id })} title="Paramètres" className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors p-1"><Settings2 size={16}/></button>
                                <button onClick={() => handleDuplicate('task', task.id, block.id)} title="Dupliquer" className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors p-1"><Copy size={16}/></button>
                                <button onClick={() => { saveToHistory(); updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.filter(t => t.id !== task.id) } : b) })); }} title="Supprimer" className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-colors p-1"><X size={16}/></button>
                                </div>
                            )}
                          </div>
                          {!collapsedTasks[task.id] && (task.subTasks || []).map((st, stIdx) => (
                            <div key={st.id} className="ml-10 flex items-center gap-3 bg-[#18181B]/[0.01] dark:bg-[#E6E8E6]/[0.01] p-3 rounded-xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 group/subtask">
                              {!block.isLocked && (
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveTaskInEngine(block.id, st.id, 'up', task.id)} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={stIdx === 0}><ChevronUp size={10} /></button>
                                    <button onClick={() => moveTaskInEngine(block.id, st.id, 'down', task.id)} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={stIdx === (task.subTasks?.length || 0) - 1}><ChevronDown size={10} /></button>
                                </div>
                              )}
                              <div className="flex-1 flex flex-col min-w-0">
                                <input className="bg-transparent text-[11px] font-medium outline-none w-full text-[#18181B] dark:text-[#E6E8E6]" value={st.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: (t.subTasks || []).map(s => s.id === st.id ? { ...s, title: e.target.value } : s) } : t) } : b) }))} />
                                {st.description && <p className="text-[8px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 truncate">{stripHtml(st.description)}</p>}
                              </div>
                              {!block.isLocked && (
                                <>
                                    <button onClick={() => setConfigModal({ type: 'task', id: st.id, blockId: block.id, parentTaskId: task.id })} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent p-1"><Settings2 size={12}/></button>
                                    <button onClick={() => handleDuplicate('subtask', st.id, task.id, block.id)} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent p-1"><Copy size={12}/></button>
                                    <button onClick={() => { saveToHistory(); updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: (t.subTasks || []).filter(s => s.id !== st.id) } : t) } : b) })); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] p-1"><X size={14}/></button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                          )}
                        </Sortable>
                      ))}
                      </SortableContext>
                      </DndContext>
                      {!block.isLocked && (
                        <button onClick={() => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: [...b.tasks, { id: generateId(), title: "Nouvelle tâche", completedDates: [], recurrence: 'daily', subTasks: [] }] } : b) }))} className="w-full py-3 border-2 border-dashed border-[#18181B]/5 dark:border-[#E6E8E6]/5 rounded-2xl text-[9px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase hover:text-accent transition-all">+ Ajouter Tâche</button>
                      )}
                    </div>
                  )}
                </div>
                  )}
                </Sortable>
              ))}
              </SortableContext>
              </DndContext>
              {appData.blocks.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                      <p className="text-[10px] text-[#18181B] dark:text-[#E6E8E6] font-bold uppercase tracking-widest">Commencez par ajouter un bloc ci-dessus</p>
                  </div>
              )}
            </div>
          </div>
        )}

        {/* ... (Existing Inbox Tab) */}
        {/* TAB: INBOX */}
        {activeTab === 'inbox' && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20">
            {/* ... Existing Inbox Code ... */}
            <div className="glass p-5 sm:p-8 rounded-[2.5rem] space-y-4 border border-accent/20 bg-accent/5">
              <div className="flex items-center gap-3"><div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center"><Archive className="text-accent" size={24} /></div><div><h2 className="font-black text-lg uppercase leading-tight text-[#18181B] dark:text-[#E6E8E6]">Boîte de tâches</h2><p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase font-black">Capturer vos idées en un clin d'œil</p></div></div>
              <div className="space-y-1.5 pt-2"><div className="flex gap-2"><input className="flex-1 bg-white dark:bg-[#080708] p-4 rounded-2xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6]" placeholder="Ex : Appeler Paul demain 15h p1 @appel" value={newInboxTitle} onChange={e => setNewInboxTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addInboxTask()} /><button onClick={addInboxTask} className="p-4 bg-accent rounded-2xl text-white shadow-lg shadow-accent/20 active:scale-95 transition-all"><Plus size={20} /></button></div><p className="text-[9px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40 px-1">Reconnaît « demain », « lundi », « 20/10 », « chaque mardi », « 15h30 », « p1/p2/p3 », « @étiquette » et « avant vendredi » (échéance).</p></div>
            </div>
            <InboxView
              items={appData.inboxTasks || []}
              onChange={(newItems) => updateAppData(prev => ({ ...prev, inboxTasks: newItems }))}
              onTransfer={(task) => openDeploy(task)}
              saveToHistory={saveToHistory}
            />
          </div>
        )}

        {/* ... (Existing Templates Tab) */}
        {/* TAB: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Routine sur mesure par Cady */}
            <div className="glass p-6 rounded-[2rem] space-y-3 border border-accent/25">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Sparkles size={16} className="text-accent" /> Routine sur mesure avec Cady</h2>
              <p className="text-[11px] font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55">Décris la routine voulue : Cady l'adapte à ton emploi du temps et à tes préférences, puis la crée après ton accord.</p>
              <div className="flex gap-2">
                <input value={routineIdea} onChange={e => setRoutineIdea(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && routineIdea.trim()) { askClaude(PROMPTS.routine(routineIdea.trim())); setRoutineIdea(''); } }} placeholder="Ex. matin productif avant le travail à 8 h" aria-label="Routine souhaitée" className="flex-1 min-w-0 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6]" />
                <button onClick={() => { if (routineIdea.trim()) { askClaude(PROMPTS.routine(routineIdea.trim())); setRoutineIdea(''); } }} disabled={!routineIdea.trim()} className="px-4 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-40">Créer</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Matin productif', 'Semaine d’examen', 'Retour de vacances', 'Journée de télétravail', 'Préparation d’un audit', 'Soirée détente'].map(k => <button key={k} onClick={() => askClaude(PROMPTS.routine(k))} className="px-3 py-1.5 rounded-lg bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[11px] font-bold text-[#18181B] dark:text-[#E6E8E6] hover:text-accent">{k}</button>)}
              </div>
            </div>

            {/* Bibliothèque de routines de départ */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <div>
                <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Sparkles size={16} className="text-accent" /> Bibliothèque de départ</h2>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40 mt-1">Routines prêtes à l'emploi · démarrage en 30s</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {STARTER_TEMPLATES.map((st) => (
                  <div key={st.key} className="p-4 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{st.emoji}</span>
                      <h4 className="font-black text-sm text-[#18181B] dark:text-[#E6E8E6]">{st.name}</h4>
                    </div>
                    <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50 leading-snug">{stripHtml(st.description)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setTplApply(tplApply?.key === st.key ? null : { key: st.key, mode: st.periodDays ? 'period' : 'always', days: st.periodDays || 7 }); }}
                        className="py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 active:scale-95 transition-all">Ajouter à ma routine</button>
                      <button
                        onClick={() => {
                          const built = st.build();
                          updateAppData(prev => ({ ...prev, templates: [...(prev.templates || []), { id: generateId(), name: st.name, blocks: built.blocks, recurringGoals: built.recurringGoals, templateGoal: st.templateGoal }] }));
                          setActiveNotification(`Modèle « ${st.name} » ajouté à vos architectures`);
                          setTimeout(() => setActiveNotification(null), 3500);
                        }}
                        className="py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-widest text-[#18181B] dark:text-[#E6E8E6] hover:text-accent transition-all">Garder en modèle</button>
                    </div>
                    {tplApply?.key === st.key && (
                      <div className="rounded-xl bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] p-3 space-y-2">
                        <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl">
                          {([['always', 'Dès aujourd’hui'], ['period', 'Sur une période']] as const).map(([m, l]) => <button key={m} onClick={() => setTplApply({ ...tplApply, mode: m })} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${tplApply.mode === m ? 'bg-accent text-white' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>{l}</button>)}
                        </div>
                        {tplApply.mode === 'period' && (
                          <label className="flex items-center gap-2 text-[11px] font-bold text-[#18181B] dark:text-[#E6E8E6]">Pendant
                            <input type="number" min={1} max={120} value={tplApply.days} onChange={e => setTplApply({ ...tplApply, days: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })} className="w-16 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-2 py-1.5 rounded-lg text-sm font-black outline-none" aria-label="Nombre de jours" />
                            jours, à partir d'aujourd'hui</label>
                        )}
                        <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Les blocs s'ajoutent à ta routine actuelle, sans rien remplacer.</p>
                        <button onClick={() => { addTemplateToRoutine(st.build().blocks, tplApply.mode === 'period' ? tplApply.days : undefined, st.name); setTplApply(null); }} className="w-full py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest">Confirmer</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* ... Existing Templates Code ... */}
            <div className="flex items-center justify-between"><div><h2 className="font-black text-lg uppercase text-[#18181B] dark:text-[#E6E8E6]">Architectures</h2><p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase font-black">Sauvegardes personnalisées</p></div><div className="flex items-center gap-2"><input type="file" ref={templateInputRef} onChange={handleTemplateUpload} className="hidden" accept=".json" /><button onClick={() => templateInputRef.current?.click()} className="p-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all"><Upload size={18} /></button><Sparkles size={24} className="text-[#FDCA40]" /></div></div>
            {(!appData.templates || appData.templates.length === 0) ? (<div className="text-center py-24 glass rounded-[3rem] border-2 border-dashed border-[#18181B]/20 dark:border-[#E6E8E6]/20"><p className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 text-sm font-medium">Aucun modèle disponible.</p></div>) : (<div className="grid gap-4">{appData.templates.map(tpl => (<div key={tpl.id} className="glass p-6 rounded-[2.5rem] flex items-center justify-between group hover:border-accent/40 transition-all"><div className="flex-1"><h4 className="font-black text-base text-[#18181B] dark:text-[#E6E8E6]">{tpl.name}</h4>{tpl.templateGoal && <p className="text-[10px] text-accent font-bold flex items-center gap-1 mt-1"><Target size={10} /> {tpl.templateGoal}</p>}</div><div className="flex gap-2"><button onClick={() => applyTemplate(tpl.id)} className="bg-accent px-5 py-2 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-accent/20 active:scale-95 transition-all text-white">Charger</button><button onClick={() => startTemplateEditing(tpl.id)} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl"><Pencil size={16} /></button><button onClick={() => handleTemplateDownload(tpl)} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl"><Download size={16} /></button><button onClick={() => updateAppData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== tpl.id) }))} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935]"><Trash2 size={18} /></button></div></div>))}</div>)}
          </div>
        )}

        {/* ... (Existing Analytics Tab) */}
        {/* TAB: ANALYTICS */}
        {activeTab === 'habits' && (
          <HabitsView habits={appData.habits || []} accentHex={accentHex} onChange={(habits) => updateAppData(prev => ({ ...prev, habits }))} />
        )}

        {activeTab === 'journal' && (
          <JournalView journal={appData.journal || {}} accentHex={accentHex}
            onSave={(k, entry) => updateAppData(prev => ({ ...prev, journal: { ...(prev.journal || {}), [k]: entry } }))}
            doneOn={journalDoneOn} />
        )}

        {activeTab === 'stats' && (
          <HiddenSectionsContext.Provider value={hiddenSections}>
          <Analytics
            appData={appData}
            accentHex={accentHex}
            onDownloadPDF={async (tf, period) => (await import('./report')).generateReport(appData, tf, period, accentHex)}
            onOpenHabits={() => setActiveTab('habits')}
            onToggleHabit={(taskId, value) => updateAppData(prev => {
              const mark = (blocks: Block[]) => blocks.map(b => ({ ...b, tasks: b.tasks.map(t => t.id === taskId ? { ...t, isHabit: value } : t) }));
              const days = { ...prev.days };
              Object.keys(days).forEach(k => { if (days[k]?.blocks) days[k] = { ...days[k], blocks: mark(days[k].blocks!) }; });
              return { ...prev, blocks: mark(prev.blocks), days };
            })}
          >
            <Section id="insights" title="Observations" icon={<Lightbulb size={16} />} subtitle="Ce que tes données révèlent" defaultOpen={false} embedded>
              <Insights history={yearStats.history.filter(h => h.val > 0 || appData.days[h.date])} days={appData.days} blockStats={yearStats.sortedBlockStats} />
            </Section>
            <Section id="weekly-review" title="Bilans de la semaine et du mois" icon={<CalendarRange size={16} />} subtitle="Écris tes bilans et retrouve les précédents" defaultOpen={false}>
              <Reviews
                appData={appData}
                onSave={(kind, r) => updateAppData(prev => kind === 'week'
                  ? { ...prev, weeklyReviews: { ...(prev.weeklyReviews || {}), [r.weekKey]: r } }
                  : { ...prev, monthlyReviews: { ...(prev.monthlyReviews || {}), [r.weekKey]: r } })}
                onGenerate={async (summary) => {
                  const res = await getDailyReviewFeedback([], 0, summary);
                  return res ? { feedback: (res as any).feedback, focusNextWeek: (res as any).focusTomorrow } : null;
                }}
              />
            </Section>
            <Section id="wheel" title="Roue de la vie" icon={<Target size={16} />} subtitle="Revue trimestrielle : équilibre de tes domaines de vie" defaultOpen={false}>
              <LifeWheel reviews={appData.lifeReviews || {}} accentHex={accentHex}
                onSave={(r) => { updateAppData(prev => ({ ...prev, lifeReviews: { ...(prev.lifeReviews || {}), [r.quarter]: r } })); setActiveNotification('Revue du trimestre enregistrée ✓'); setTimeout(() => setActiveNotification(null), 2500); }}
                onAskClaude={(domains) => askClaude(PROMPTS.wheelHabits(domains))} />
            </Section>
            <Section id="mood" title="Humeur et performance" icon={<Smile size={16} />} subtitle="Ta constance selon ton humeur du jour" defaultOpen={false} embedded>
              <MoodPerfChart days={appData.days} history={yearStats.history} />
            </Section>
            <Section id="focus" title="Concentration" icon={<Timer size={16} />} subtitle="Sessions du mode Focus" defaultOpen={false} embedded>
              <FocusStats sessions={appData.focusSessions || []} />
            </Section>
            <Section id="badges" title="Succès" icon={<Trophy size={16} />} subtitle="Badges débloqués" defaultOpen={false} embedded>
              <Badges appData={appData} bestStreak={yearStats.streakCount} />
            </Section>
            <Section id="annual" title="Bilan de l'année" icon={<Crown size={16} />} subtitle="Ton année en chiffres" defaultOpen={false} embedded>
              <AnnualReview appData={appData} history={yearStats.history} />
            </Section>
          </Analytics>
          </HiddenSectionsContext.Provider>
        )}

        {/* ... (Existing Caddr AI Tab) */}
        {activeTab === 'ai' && (
           <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-20">
            <button onClick={() => setShowAssistant(true)} className="w-full text-left glass p-5 sm:p-6 rounded-[2rem] border border-accent/30 flex items-center gap-4 hover:border-accent/60 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shrink-0 shadow-lg shadow-accent/30"><Sparkles size={22} className="text-white" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-[#18181B] dark:text-[#E6E8E6]">Parler à Cady</p>
                <p className="text-xs font-semibold text-[#18181B]/55 dark:text-[#E6E8E6]/55">« Programme mon sport demain à 6h », « Crée l'habitude lire 10 pages », « Allège ma soirée »… À l'écrit ou à la voix.</p>
              </div>
              <ChevronRight size={20} className="text-accent shrink-0" />
            </button>
            {(() => {
              const rk = getWeekKey(weekPlan.reviewStart);
              return (
                <div className="glass p-5 sm:p-6 rounded-[2rem] space-y-3">
                  <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Coach de la semaine <span className="text-[11px] font-semibold text-[#18181B]/50 dark:text-[#E6E8E6]/50">· {weekPlan.reviewStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – {weekPlan.reviewEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></p>
                  <CoachCard coach={appData.weeklyReviews?.[rk]?.coach} busy={coachBusy} title="Résumé et 3 actions"
                    onGenerate={user ? async () => {
                      setCoachBusy(true);
                      const res = await getWeeklyCoach(weekCoachPayload(appData, weekPlan.reviewStart, weekPlan.reviewEnd, todayKeyNow));
                      setCoachBusy(false);
                      if (res?.summary) updateAppData(prev => ({ ...prev, weeklyReviews: { ...(prev.weeklyReviews || {}), [rk]: { ...(prev.weeklyReviews?.[rk] || { createdAt: new Date().toISOString() }), weekKey: rk, coach: { ...res, at: new Date().toISOString() }, aiFeedback: { feedback: res.summary, focusNextWeek: res.focusNextWeek } } } }));
                    } : undefined} />
                </div>
              );
            })()}
            {/* Same AI view */}
            <div className="glass p-8 rounded-[3.5rem] text-center space-y-6"><div className="w-20 h-20 bg-gradient-to-br from-[#FDCA40] to-accent rounded-3xl flex items-center justify-center mx-auto shadow-2xl"><BrainCircuit size={40} className="text-white" /></div><h2 className="text-2xl font-black text-[#18181B] dark:text-[#E6E8E6]">Caddr. IA</h2>{!aiAdvice && !isAiLoading && <button onClick={async () => { setIsAiLoading(true); setAiAdvice(await getRoutineAdvice(routineBlocks, perfToday)); setIsAiLoading(false); }} className="bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Lancer l'Analyse</button>}{isAiLoading && <Loader2 className="animate-spin text-[#FDCA40] mx-auto" size={32} />}{aiAdvice && (<div className="text-left space-y-4 animate-in fade-in slide-in-from-top-4"><div className="p-5 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5"><p className="text-[8px] font-black text-[#FDCA40] uppercase tracking-widest mb-1">Conseil IA</p><p className="text-sm text-[#18181B] dark:text-[#E6E8E6] font-medium">{aiAdvice.advice}</p></div><div className="p-5 bg-accent/10 rounded-2xl border border-accent/10"><p className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">Action Recommandée</p><p className="text-sm font-bold flex items-center gap-2 text-[#18181B] dark:text-[#E6E8E6]"><ArrowRight size={14} /> {aiAdvice.powerTask}</p></div></div>)}</div>
          </div>
        )}

        {/* TAB: SETTINGS / RÉGLAGES */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="px-2">
              <h1 className="text-2xl font-black text-[#18181B] dark:text-[#E6E8E6]">Réglages</h1>
              <p className="text-xs font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50 mt-1">Personnalise ton Caddr.</p>
            </div>

            {/* Apparence */}
            <div className="glass p-6 rounded-[2rem] space-y-5">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Settings2 size={16} className="text-accent" /> Apparence</h2>

              {/* Mode clair / sombre */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Mode</label>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  <button onClick={() => setTheme('light')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}><Sun size={14} /> Clair</button>
                  <button onClick={() => setTheme('dark')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}><Moon size={14} /> Sombre</button>
                </div>
              </div>

              {/* Barre d'en-tête */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Barre d'en-tête</label>
                <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Ce qu'affiche la barre sous le titre. Tu peux aussi la toucher pour basculer.</p>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), headerBar: 'discipline' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${headerBar === 'discipline' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>Discipline du mois</button>
                  <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), headerBar: 'xp' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${headerBar === 'xp' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>Niveau XP</button>
                </div>
              </div>
              <BackupsPanel onRestore={(data) => { saveToHistory(); updateAppData(() => data); setActiveNotification('Sauvegarde restaurée ✓'); setTimeout(() => setActiveNotification(null), 3000); }} />
              {/* Rappels intelligents */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Rappels intelligents</label>
                <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Quand une tâche à heure fixe n'est pas cochée après son créneau : un rappel avec « Fait » ou « Reporter » en un geste. Importantes = priorité haute, habitudes et tâches reliées à un objectif.</p>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  {([['off', 'Désactivés'], ['important', 'Importantes'], ['all', 'Toutes']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), smartReminders: v } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reminderMode === v ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>{l}</button>
                  ))}
                </div>
                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && reminderMode !== 'off' && (
                  <button onClick={requestNotificationPermission} className="w-full py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-widest text-accent">Autoriser les notifications sur cet appareil</button>
                )}
                <p className="text-[10px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40">Les rappels arrivent tant que l'app est ouverte ou en arrière-plan ; l'app fermée, ils s'affichent à la prochaine ouverture.</p>
              </div>
              {/* XP et discipline */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">XP et discipline</label>
                <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">L'XP récompense surtout ta régularité. Objectif hebdomadaire pour les bonus :</p>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  {[70, 80, 90].map(v => (
                    <button key={v} onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), weeklyTarget: v } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(appData.settings?.weeklyTarget ?? WEEK_TARGET) === v ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>{v} %</button>
                  ))}
                </div>
                <ul className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-3 space-y-1.5">
                  {XP_RULES.map(r => <li key={r.label} className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[#18181B] dark:text-[#E6E8E6]"><span>{r.label}</span><span className="shrink-0 font-black text-[#B8900A] dark:text-[#FDCA40]">{r.xp}</span></li>)}
                </ul>
                {Object.keys(appData.userProfile?.bonuses || {}).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">Derniers bonus</p>
                    {Object.values(appData.userProfile?.bonuses || {}).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((b, i) => (
                      <p key={i} className="flex justify-between gap-3 text-[11px] font-semibold text-[#18181B]/70 dark:text-[#E6E8E6]/70"><span className="truncate">{b.label}</span><span className="font-black text-[#B8900A] dark:text-[#FDCA40] shrink-0">+{b.xp}</span></p>
                    ))}
                  </div>
                )}
              </div>
              {/* Position de la barre d'onglets */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Barre d'onglets</label>
                <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">La barre latérale s'applique sur écran large ; sur mobile, elle reste en bas.</p>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), navPosition: 'bottom' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${navPosition === 'bottom' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>En bas</button>
                  <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), navPosition: 'left' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${navPosition === 'left' ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>À gauche</button>
                </div>
                {navPosition === 'left' && (
                  <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), navCollapsed: !navCollapsed } }))} className="w-full py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-widest text-[#18181B]/70 dark:text-[#E6E8E6]/70 hover:text-accent transition-all">
                    {navCollapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
                  </button>
                )}
              </div>
            </div>

            {/* Discipline */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Flame size={16} className="text-accent" /> Discipline</h2>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Jours de grâce par semaine</label>
                <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Nombre de jours non-parfaits tolérés sans rompre votre série. Un seul jour manqué ne doit pas tout effacer.</p>
                <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), graceDaysPerWeek: n } }))}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${graceDays === n ? 'bg-accent text-white shadow-lg' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}
                    >
                      {n === 0 ? 'Aucun' : `${n} jour${n > 1 ? 's' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 pt-4">
                <p className="text-xs font-medium text-[#18181B]/70 dark:text-[#E6E8E6]/70 max-w-xs">Petit son + vibration à la validation d'une tâche.</p>
                <button
                  onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), soundEffects: !(prev.settings?.soundEffects ?? true) } }))}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(appData.settings?.soundEffects ?? true) ? 'bg-accent text-white' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}
                >
                  {(appData.settings?.soundEffects ?? true) ? 'Activé' : 'Désactivé'}
                </button>
              </div>
            </div>

            {/* Sections d'Analytics */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <div>
                <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><BarChart3 size={16} className="text-accent" /> Sections d'Analytics</h2>
                <p className="text-[11px] font-semibold text-[#18181B]/60 dark:text-[#E6E8E6]/55 mt-1">Choisis les sections affichées dans l'onglet Analytics. Les données restent enregistrées, même masquées.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {ANALYTICS_SECTIONS.map(sec => {
                  const on = !hiddenSections.has(sec.id);
                  return (
                    <button key={sec.id} role="switch" aria-checked={on} onClick={() => toggleAnalyticsSection(sec.id)}
                      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all ${on ? 'border-accent/30 bg-accent/5' : 'border-[#18181B]/10 dark:border-[#E6E8E6]/10'}`}>
                      <span className={`text-[12px] font-bold ${on ? 'text-[#18181B] dark:text-[#E6E8E6]' : 'text-[#18181B]/50 dark:text-[#E6E8E6]/45'}`}>{sec.title}</span>
                      <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-[#18181B]/15 dark:bg-[#E6E8E6]/15'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} /></span>
                    </button>
                  );
                })}
              </div>
              {hiddenSections.size > 0 && <button onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), analyticsHidden: [] } }))} className="text-[10px] font-black uppercase tracking-wider text-accent">Tout réafficher</button>}
            </div>

            {/* Notifications */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Bell size={16} className="text-accent" /> Notifications</h2>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#18181B]/70 dark:text-[#E6E8E6]/70 max-w-xs">Recevoir les rappels de tâches à l'heure prévue (nécessite l'app ouverte).</p>
                <button
                  onClick={requestNotificationPermission}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${notificationsEnabled ? 'bg-accent/10 text-accent' : 'bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708]'}`}
                >
                  {notificationsEnabled ? 'Activées' : 'Activer'}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 pt-4">
                <p className="text-xs font-medium text-[#18181B]/70 dark:text-[#E6E8E6]/70 max-w-xs">Notifications push (même app fermée). Nécessite une configuration serveur — voir PUSH_SETUP.md.</p>
                <button
                  onClick={async () => {
                    if (!user) { setPushStatus('Connectez-vous d\'abord.'); return; }
                    setPushStatus('…');
                    const r = await enablePush(user.uid);
                    setPushStatus(r.message);
                  }}
                  className="shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] hover:bg-accent hover:text-white transition-all"
                >
                  Activer push
                </button>
              </div>
              {pushStatus && <p className="text-[10px] font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50">{pushStatus}</p>}
            </div>

            {/* Compte */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><User size={16} className="text-accent" /> Compte</h2>
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-[#18181B] dark:text-[#E6E8E6] truncate">{user.displayName || 'Connecté'}</p>
                    <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleSignOut} className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DF2935]/10 text-[#DF2935] text-[10px] font-black uppercase tracking-widest hover:bg-[#DF2935]/20 transition-all"><LogOut size={14} /> Déconnexion</button>
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest"><User size={14} /> Créer un compte ou se connecter</button>
              )}
            </div>

            {/* Données */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
              <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Archive size={16} className="text-accent" /> Données</h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleExportData} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all"><Download size={14} /> Exporter</button>
                <button onClick={() => backupInputRef.current?.click()} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all"><Upload size={14} /> Importer</button>
              </div>
              <button onClick={() => downloadICS(appData)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all"><CalendarRange size={14} /> Exporter vers l'agenda (.ics)</button>
              <p className="text-[10px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40">Sauvegarde JSON, ou export .ics des 4 prochaines semaines à importer dans Google/Apple Calendar.</p>
              <button onClick={() => setShowFullResetModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#DF2935]/5 text-[#DF2935] text-[10px] font-black uppercase tracking-widest border border-[#DF2935]/10 hover:bg-[#DF2935] hover:text-white transition-all mt-2">
                <Trash2 size={14} /> Réinitialiser l'application
              </button>
            </div>

            <p className="text-center text-[9px] font-medium text-[#18181B]/30 dark:text-[#E6E8E6]/30 pt-2">Version {APP_VERSION}</p>
          </div>
        )}
        {showWeekPlanner && (
          <WeekPlanner appData={appData} update={(fn) => updateAppData(fn)} onClose={() => setShowWeekPlanner(false)} saveToHistory={saveToHistory} aiCoach={user ? getWeeklyCoach : undefined}
            notify={(m) => { setActiveNotification(m); setTimeout(() => setActiveNotification(null), 3500); }} />
        )}
        {showCalendars && (
          <CalendarsPanel calendars={externalCalendars} onChange={setCalendars} onClose={() => setShowCalendars(false)}
            errors={cal.errors} loading={cal.loading} lastSync={cal.lastSync} eventCount={(c) => cal.eventsOf(c).length} onRefresh={cal.refresh} />
        )}
        {showEvening && (
          <EveningReview appData={appData} onClose={() => setShowEvening(false)}
            onAskClaude={() => { setShowEvening(false); askClaude(PROMPTS.evening); }}
            onFinish={(d, msg) => { saveToHistory(); updateAppData(() => d); setShowEvening(false); setActiveNotification(msg); setTimeout(() => setActiveNotification(null), 3500); }} />
        )}
        </Suspense>
      </main>
      <Suspense fallback={null}>
          {showAssistant && (
          <Assistant open={showAssistant} onClose={() => setShowAssistant(false)}
            getData={() => appDataRef.current}
            commit={(d) => { saveToHistory(); updateAppData(() => d); }}
            undo={handleUndo}
            navigate={(t) => setActiveTab(t)}
            externalEvents={(from, to) => occurrencesBetween(externalCalendars, cal.eventsOf, from, to)}
            signedIn={!!user || devAssistant()} onSignIn={() => { setShowAssistant(false); setShowAuth(true); }}
            userName={user?.displayName?.split(' ')[0] || undefined}
            initialPrompt={assistantPrompt} onInitialConsumed={() => setAssistantPrompt(null)} />
        )}
      </Suspense>

      {/* Navigation */}
      {/* Barre du bas — toujours sur mobile ; sur desktop uniquement si position = bas */}
      {/* Navigation mobile : 5 onglets principaux + « Plus » (feuille avec les autres) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-3xl border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 pt-2 px-2 transition-colors duration-300" style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }} aria-label="Navigation principale">
        <div className="grid grid-cols-6">
          {(() => {
            const primary = ['routine', 'habits', 'schedule', 'inbox', 'stats'];
            const secondaryActive = !primary.includes(activeTab);
            return (
              <>
                {navTabs.filter(t => primary.includes(t.id)).map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabType); setIsReorderMode(false); setShowMoreNav(false); }} aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all ${activeTab === tab.id ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>
                    <tab.icon size={21} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className="text-[9px] font-black whitespace-nowrap">{tab.label === 'Analytics' ? 'Stats' : tab.label}</span>
                  </button>
                ))}
                <button onClick={() => setShowMoreNav(v => !v)} aria-expanded={showMoreNav}
                  className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all ${secondaryActive || showMoreNav ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>
                  <MoreHorizontal size={21} strokeWidth={secondaryActive ? 2.5 : 2} />
                  <span className="text-[9px] font-black">Plus</span>
                </button>
              </>
            );
          })()}
        </div>
      </nav>
      {showMoreNav && (
        <div className="md:hidden fixed inset-0 z-[45]" onClick={() => setShowMoreNav(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-3 right-3 glass bg-[#F4F4F5] dark:bg-[#111] rounded-3xl p-3 space-y-1 animate-in slide-in-from-bottom-4" style={{ bottom: 'calc(max(0.6rem, env(safe-area-inset-bottom)) + 4.6rem)' }} onClick={e => e.stopPropagation()}>
            {navTabs.filter(t => !['routine', 'habits', 'schedule', 'inbox', 'stats'].includes(t.id)).map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabType); setIsReorderMode(false); setShowMoreNav(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-accent/15 text-accent' : 'text-[#18181B] dark:text-[#E6E8E6] hover:bg-[#18181B]/5 dark:hover:bg-[#E6E8E6]/5'}`}>
                <tab.icon size={19} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation ordinateur (barre du bas) */}
      <nav className={`hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-[#F4F4F5]/90 dark:bg-[#080708]/90 backdrop-blur-3xl border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 pb-6 pt-4 px-4 overflow-x-auto custom-scrollbar transition-colors duration-300 ${navPosition === 'left' ? 'md:hidden' : ''}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 min-w-max px-4">
          {navTabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabType); setIsReorderMode(false); }} className={`flex flex-col items-center gap-2 transition-all px-2 ${activeTab === tab.id ? 'text-accent scale-110' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Barre latérale gauche — desktop uniquement, si position = gauche */}
      {navPosition === 'left' && (
        <aside className={`hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-[#F4F4F5]/90 dark:bg-[#080708]/90 backdrop-blur-3xl border-r border-[#18181B]/5 dark:border-[#E6E8E6]/5 py-6 transition-all duration-300 ${navCollapsed ? 'w-20 px-2' : 'w-52 px-4'}`}>
          <div className={`flex items-center mb-8 ${navCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            {!navCollapsed && <span className="font-heading font-black text-lg text-[#18181B] dark:text-[#E6E8E6]">Caddr.</span>}
            <button
              onClick={() => updateAppData(prev => ({ ...prev, settings: { ...(prev.settings || {}), navCollapsed: !navCollapsed } }))}
              className="p-2 rounded-xl text-[#18181B]/50 dark:text-[#E6E8E6]/50 hover:text-accent hover:bg-[#18181B]/5 dark:hover:bg-[#E6E8E6]/5 transition-all"
              title={navCollapsed ? 'Déplier' : 'Replier'}
            >
              {navCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            {navTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as TabType); setIsReorderMode(false); }}
                title={tab.label}
                className={`flex items-center gap-3 rounded-2xl transition-all ${navCollapsed ? 'justify-center p-3' : 'px-4 py-3'} ${activeTab === tab.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-[#18181B]/5 dark:hover:bg-[#E6E8E6]/5'}`}
              >
                <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} className="shrink-0" />
                {!navCollapsed && <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* MODAL: RÉINITIALISATION */}
      {showFullResetModal && (
        <div className="fixed inset-0 z-[210] bg-[#080708]/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in">
          <div className="glass w-full max-w-sm p-8 rounded-[2.5rem] space-y-5 border border-[#DF2935]/30">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-[#DF2935]/10 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="text-[#DF2935]" size={26} />
              </div>
              <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Tout réinitialiser</h3>
              <p className="text-xs font-medium text-[#18181B]/60 dark:text-[#E6E8E6]/60">
                Cette action supprime définitivement toutes vos routines, tâches, statistiques et historiques{user ? ', en local et dans le cloud' : ''}. Vos préférences d'apparence sont conservées. <strong className="text-[#DF2935]">C'est irréversible.</strong>
              </p>
              <p className="text-[10px] font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50">Pensez à exporter vos données avant, si besoin.</p>
            </div>
            <button
              onClick={() => setKeepTemplates(v => !v)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] transition-all"
            >
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${keepTemplates ? 'bg-accent border-accent' : 'border-[#18181B]/20 dark:border-[#E6E8E6]/20'}`}>
                {keepTemplates && <Check size={13} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#18181B] dark:text-[#E6E8E6] text-left">Conserver mes modèles</span>
            </button>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Tapez « RÉINITIALISER » pour confirmer</label>
              <input
                autoFocus
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-2xl text-sm font-black text-center tracking-widest border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-[#DF2935] text-[#18181B] dark:text-[#E6E8E6]"
                placeholder="RÉINITIALISER"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowFullResetModal(false); setResetInput(''); }} className="flex-1 py-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] font-black uppercase text-[10px] tracking-widest">Annuler</button>
              <button
                onClick={handleResetApp}
                disabled={resetInput.trim().toUpperCase() !== 'RÉINITIALISER'}
                className="flex-1 py-3 rounded-2xl bg-[#DF2935] text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Effacer tout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LEVEL UP */}
      {/* Bouton Focus flottant : visible quand une tâche horodatée est en cours */}
      {activeTimedTask && !focusTarget && (
        <button
          onClick={() => setFocusTarget(activeTimedTask)}
          className="fixed bottom-24 right-5 z-[90] flex items-center gap-2 px-5 py-4 rounded-full bg-accent text-white font-black uppercase tracking-wider text-[10px] shadow-2xl shadow-accent/40 hover:scale-105 transition-all animate-in slide-in-from-bottom-4"
        >
          <Timer size={16} />
          Focus : {activeTimedTask.task.title.length > 20 ? activeTimedTask.task.title.slice(0, 20) + '…' : activeTimedTask.task.title}
        </button>
      )}

      {/* Overlay Mode Focus */}
      {focusTarget && (
        <FocusMode
          task={focusTarget.task}
          blockTitle={focusTarget.blockTitle}
          initialMicro={focusTarget.micro}
          onComplete={handleFocusComplete}
          onClose={() => setFocusTarget(null)}
        />
      )}

      {showLevelUpModal && (
        <div className="fixed inset-0 z-[200] bg-[#080708]/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-50 duration-500">
           <div className="bg-[#111213] w-full max-w-sm p-6 sm:p-10 rounded-[3.5rem] shadow-[0_0_50px_rgba(47,176,166,0.3)] border border-accent/30 relative overflow-hidden group text-center space-y-6">
              {/* Confetti / Rays effect bg */}
              <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 via-transparent to-[#FDCA40]/20 animate-pulse" />
              
              <div className="relative z-10">
                 <div className="w-24 h-24 bg-gradient-to-tr from-accent to-[#FDCA40] rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3 group-hover:rotate-6 transition-transform duration-500">
                    <Crown size={48} className="text-white drop-shadow-md" />
                 </div>
                 <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-1">Niveau Supérieur !</h2>
                 <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#FDCA40' }}>Tu passes au niveau {showLevelUpModal}</p>
                 
                 <div className="my-8 py-4 border-y border-[#E6E8E6]/10 space-y-2">
                    <p className="text-[10px] text-[#E6E8E6]/60 font-bold uppercase tracking-widest">Nouveau Rang</p>
                    <p className="text-xl font-black text-[#E6E8E6] uppercase">{getRankTitle(showLevelUpModal)}</p>
                 </div>

                 <button 
                   onClick={() => setShowLevelUpModal(null)}
                   className="w-full bg-[#E6E8E6] text-[#080708] py-4 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all hover:bg-white"
                 >
                    Continuer
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* LOGBOOK MODAL */}
      {logModal && (
        <div className="fixed inset-0 z-[110] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
           <div className="glass relative w-full rounded-[3rem] max-h-[94vh] flex flex-col" style={{ maxWidth: logSize.width }}>
              <SideResizeHandles onStart={logSize.startResize} onReset={logSize.reset} />
              <div className="p-6 sm:p-10 space-y-6 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => { setLogModal(null); setCurrentLogText(""); }}
                title="Fermer (Échap)"
                aria-label="Fermer"
                className="absolute z-20 top-7 right-7 w-7 h-7 rounded-full flex items-center justify-center bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all"
              >
                <X size={14} strokeWidth={3} />
              </button>
              <div className="text-center">
                 <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="text-accent" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Journal de bord</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4 mt-2">"{logModal.task.title}"</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Notes d'exécution</p>
                 <RichText
                    minHeight={logEditor.height}
                    placeholder="Comment s'est passée cette tâche ? Détails, obstacles, réussites..."
                    value={currentLogText}
                    onChange={(html) => setCurrentLogText(html)}
                 />
                 <BottomResizeHandle onStart={logEditor.startResize} onReset={logEditor.reset} />
              </div>
              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={saveLogText}
                   className="flex-1 bg-accent py-4 rounded-[2rem] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20"
                 >
                    Enregistrer
                 </button>
                 <button 
                   onClick={() => { setLogModal(null); setCurrentLogText(""); }}
                   className="flex-1 py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest"
                 >
                    Annuler
                 </button>
              </div>
              </div>
           </div>
        </div>
      )}

      {/* ... (Existing Modals kept same) */}
      {configModal && (
        <div className="fixed inset-0 z-[100] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfigModal(null); }}>
          <div className="glass relative w-full rounded-[3rem] max-h-[90vh] flex flex-col" style={{ maxWidth: configSize.width }}>
            <SideResizeHandles onStart={configSize.startResize} onReset={configSize.reset} />

            <div className="relative shrink-0 px-6 sm:px-10 pt-7 sm:pt-8 pb-4 text-center">
              <h3 className="font-black uppercase text-sm tracking-widest italic text-[#18181B] dark:text-[#E6E8E6]">Configuration</h3>
              <button
                onClick={() => setConfigModal(null)}
                title="Fermer (Échap)"
                aria-label="Fermer"
                className="absolute top-7 right-7 w-7 h-7 rounded-full flex items-center justify-center bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>

          <div className="px-5 sm:px-10 pb-8 sm:pb-10 space-y-6 overflow-y-auto custom-scrollbar">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Désignation</p>
                <input 
                  className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6]"
                  placeholder="Titre..."
                  value={
                    configModal.type === 'goal' 
                      ? (activeTab === 'routine' ? (appData.days[dateKey]?.dailyGoalOverride ?? appData.recurringGoals.find(g => g.id === configModal.id)?.title ?? "") : (appData.recurringGoals.find(g => g.id === configModal.id)?.title || ""))
                      : (configModal.type === 'block' 
                          ? (
                              (activeTab === 'routine' && appData.days[dateKey]?.blocks 
                                ? appData.days[dateKey].blocks?.find(b => b.id === configModal.id)
                                : appData.blocks.find(b => b.id === configModal.id)
                              )?.title || ""
                            )
                          : (configModal.parentTaskId 
                              ? (
                                  (activeTab === 'routine' && appData.days[dateKey]?.blocks
                                    ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId)
                                    : appData.blocks.find(b => b.id === configModal.blockId)
                                  )?.tasks.find(t => t.id === configModal.parentTaskId)?.subTasks?.find(s => s.id === configModal.id)?.title || ""
                                )
                              : (
                                  (activeTab === 'routine' && appData.days[dateKey]?.blocks
                                    ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId)
                                    : appData.blocks.find(b => b.id === configModal.blockId)
                                  )?.tasks.find(t => t.id === configModal.id)?.title || ""
                                )
                            )
                        )
                  }
                  onChange={(e) => updateConfiguredItem('title', e.target.value)}
                />
              </div>

              {(configModal.type === 'block' || configModal.type === 'task') && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 flex items-center gap-1"><Info size={10} /> Description / Notes</p>
                  <RichText
                    minHeight={130}
                    placeholder="Détails supplémentaires, conseils..."
                    value={
                      configModal.type === 'block'
                        ? (
                            (activeTab === 'routine' && appData.days[dateKey]?.blocks 
                                ? appData.days[dateKey].blocks?.find(b => b.id === configModal.id)
                                : appData.blocks.find(b => b.id === configModal.id)
                            )?.description || ""
                          )
                        : (configModal.parentTaskId
                            ? (
                                (activeTab === 'routine' && appData.days[dateKey]?.blocks
                                    ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId)
                                    : appData.blocks.find(b => b.id === configModal.blockId)
                                )?.tasks.find(t => t.id === configModal.parentTaskId)?.subTasks?.find(s => s.id === configModal.id)?.description || ""
                              )
                            : (
                                (activeTab === 'routine' && appData.days[dateKey]?.blocks
                                    ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId)
                                    : appData.blocks.find(b => b.id === configModal.blockId)
                                )?.tasks.find(t => t.id === configModal.id)?.description || ""
                              )
                          )
                    }
                    onChange={(html) => updateConfiguredItem('description', html)}
                  />
                </div>
              )}

              {(configModal.type === 'goal' || configModal.type === 'task') && (
                <div className="space-y-4 animate-in zoom-in-95">
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Heure du rappel / début</p>
                    <div className="flex items-center gap-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-3xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10">
                      <Clock size={18} className="text-accent" />
                      <input 
                        type="time" 
                        className="bg-transparent flex-1 font-black text-lg outline-none text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                        value={
                            configModal.type === 'goal' 
                            ? (activeTab === 'routine' ? (appData.days[dateKey]?.reminderTime ?? appData.recurringGoals.find(g => g.id === configModal.id)?.reminderTime ?? "") : (appData.recurringGoals.find(g => g.id === configModal.id)?.reminderTime || "")) 
                            : (
                                (activeTab === 'routine' && appData.days[dateKey]?.blocks
                                    ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId)
                                    : appData.blocks.find(b => b.id === configModal.blockId)
                                )?.tasks.find(t => t.id === configModal.id)?.startTime || ""
                              )
                        } 
                        onChange={(e) => {
                          if (e.target.value && 'Notification' in window && Notification.permission === 'default') {
                            requestNotificationPermission();
                          }
                          if (configModal.type === 'goal') {
                              updateConfiguredItem('reminderTime', e.target.value);
                          } else {
                              updateConfiguredItem('startTime', e.target.value);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {configModal.type === 'task' && (
                    <>
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Durée estimée (minutes)</p>
                        <div className="flex items-center gap-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-3xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10"><Timer size={18} className="text-accent" /><input type="number" min="0" placeholder="Ex: 30" className="bg-transparent flex-1 font-black text-lg outline-none text-[#18181B] dark:text-[#E6E8E6]" value={(configModal.parentTaskId ? (activeTab === 'routine' && appData.days[dateKey]?.blocks ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId) : appData.blocks.find(b => b.id === configModal.blockId))?.tasks.find(t => t.id === configModal.parentTaskId)?.subTasks?.find(s => s.id === configModal.id)?.duration : (activeTab === 'routine' && appData.days[dateKey]?.blocks ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId) : appData.blocks.find(b => b.id === configModal.blockId))?.tasks.find(t => t.id === configModal.id)?.duration) || ""} onChange={(e) => updateConfiguredItem('duration', parseInt(e.target.value) || 0)} /></div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Échéance (date limite)</p>
                        <div className="flex items-center gap-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-3xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10">
                          <Hourglass size={18} className="text-[#FDCA40]" />
                          <input type="date" aria-label="Échéance" className="bg-transparent flex-1 font-black text-sm outline-none text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" value={(configItem as any)?.deadline || ''} onChange={(e) => applyItemFields({ deadline: e.target.value || undefined })} />
                          {(configItem as any)?.deadline && <button type="button" onClick={() => applyItemFields({ deadline: undefined })} aria-label="Retirer l'échéance" className="p-1 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935]"><X size={14} /></button>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Priorité</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['low', 'medium', 'high'] as PriorityType[]).map(p => {
                            const info = getPriorityInfo(p);
                            const currentBlock = activeTab === 'routine' && appData.days[dateKey]?.blocks ? appData.days[dateKey].blocks?.find(b => b.id === configModal.blockId) : appData.blocks.find(b => b.id === configModal.blockId);
                            const isSelected = (configModal.parentTaskId ? currentBlock?.tasks.find(t => t.id === configModal.parentTaskId)?.subTasks?.find(s => s.id === configModal.id)?.priority : currentBlock?.tasks.find(t => t.id === configModal.id)?.priority) === p;
                            return (
                              <button 
                                key={p} 
                                onClick={() => updateConfiguredItem('priority', p)}
                                className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${isSelected ? `border-transparent bg-[#18181B] dark:bg-[#E6E8E6] ${p === 'high' ? 'text-[#DF2935] shadow-[#DF2935]/20' : p === 'medium' ? 'text-[#FDCA40] shadow-[#FDCA40]/20' : 'text-[#E6E8E6] dark:text-[#080708]'}` : 'border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}
                              >
                                {info.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {(configModal.type !== 'goal' || activeTab !== 'routine') && (
                <>
                    <div className="grid gap-2">
                      <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mt-4">Récurrence</p>
                      <div className="grid grid-cols-2 gap-2">
                      {[ { id: 'daily', label: 'Quotidien' }, { id: 'weekdays', label: 'Semaine (L-V)' }, { id: 'weekends', label: 'Week-end' }, { id: 'weekly', label: 'Chaque semaine' }, { id: 'week', label: 'Cette semaine' }, { id: 'month', label: 'Ce mois' }, { id: 'period', label: 'Période perso.' }, { id: 'specific', label: 'Date précise' } ].map((opt, idx, arr) => {
                        const isActive = !dayOnly && (configItem?.recurrence || 'daily') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => applyRecurrence(opt.id as RecurrenceType)}
                            className={`p-4 rounded-2xl font-black text-[10px] tracking-wider uppercase border transition-all ${idx === arr.length - 1 && arr.length % 2 === 1 ? 'col-span-2' : ''} ${isActive ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent text-[#18181B] dark:text-[#E6E8E6] hover:bg-accent/20'}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                      </div>
                      {configItem && (
                        <p className="text-[10px] font-bold text-accent px-2 leading-relaxed">
                          {dayOnly
                            ? "Tâche prévue pour aujourd'hui seulement. Choisissez une récurrence pour la répéter les jours suivants."
                            : describeRecurrence(configItem)}
                        </p>
                      )}
                    </div>

                    {configItem && (configItem.recurrence === 'specific' || configItem.recurrence === 'weekly') && (
                        <div className="animate-in slide-in-from-top-2 mt-2">
                           <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">{configItem.recurrence === 'weekly' ? 'À partir du (fixe le jour de la semaine)' : 'Date précise'}</p>
                           <input 
                              type="date" 
                              className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                              value={configItem.specificDate || ''} 
                              onChange={(e) => updateRecurrenceDate('specificDate', e.target.value)}
                           />
                        </div>
                    )}

                    {configItem && configItem.recurrence === 'period' && (
                        <div className="grid grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2">
                           <div>
                              <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Début</p>
                              <input 
                                  type="date" 
                                  className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                                  value={configItem.startDate || ''} 
                                  onChange={(e) => updateRecurrenceDate('startDate', e.target.value)}
                              />
                           </div>
                           <div>
                              <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Fin</p>
                              <input 
                                  type="date" 
                                  className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                                  value={configItem.endDate || ''} 
                                  onChange={(e) => updateRecurrenceDate('endDate', e.target.value)}
                              />
                           </div>
                        </div>
                    )}

                    {/* ARRÊTER LA RÉCURRENCE */}
                    {configItem && !dayOnly && !['specific', 'once'].includes((configItem as any).recurrence || 'daily') && (
                      <div className="mt-2 p-4 rounded-2xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] space-y-3">
                        {(configItem as any).stopDate ? (
                          <>
                            <p className="text-[10px] font-bold text-[#FDCA40] leading-relaxed flex items-center gap-2">
                              <Power size={12} /> Récurrence arrêtée : dernier jour le {formatDayLabel((configItem as any).stopDate)}.
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                aria-label="Modifier le dernier jour"
                                className="flex-1 min-w-0 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2.5 rounded-xl text-xs font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]"
                                value={(configItem as any).stopDate}
                                onChange={(e) => e.target.value && applyItemFields({ stopDate: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => applyItemFields({ stopDate: undefined })}
                                className="shrink-0 px-4 py-2.5 rounded-xl bg-accent text-white text-[9px] font-black uppercase tracking-wider shadow-lg shadow-accent/20 active:scale-95 transition-all"
                              >
                                Reprendre
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase">Arrêter la récurrence</p>
                            <button
                              type="button"
                              onClick={() => applyItemFields({ stopDate: dateKey })}
                              className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border border-[#FDCA40]/20 bg-[#FDCA40]/5 text-[#FDCA40] hover:bg-[#FDCA40] hover:text-[#080708] transition-all flex items-center justify-center gap-2"
                            >
                              <Power size={12} /> {dateKey === getKeyFromDate(new Date()) ? "Arrêter après aujourd'hui" : `Arrêter après le ${formatDayLabel(dateKey)}`}
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50 shrink-0">ou dernier jour le</span>
                              <input
                                type="date"
                                aria-label="Choisir le dernier jour"
                                min={dateKey}
                                className="flex-1 min-w-0 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2.5 rounded-xl text-xs font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]"
                                value=""
                                onChange={(e) => e.target.value && applyItemFields({ stopDate: e.target.value })}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                </>
            )}
            
            {configModal.type === 'task' && configItem && (
              <>
                <div className="mt-2">
                  <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Empilement d'habitude (après…)</p>
                  <input
                    type="text"
                    placeholder="Ex : après mon café du matin"
                    className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6]"
                    value={(configItem as any).stackAnchor || ''}
                    onChange={(e) => updateConfiguredItem('stackAnchor', e.target.value)}
                  />
                </div>
                {!configModal.parentTaskId && (
                  <button
                    type="button"
                    onClick={() => applyItemFields({ isHabit: !(configItem as any).isHabit })}
                    aria-pressed={!!(configItem as any).isHabit}
                    className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${(configItem as any).isHabit ? 'bg-accent/10 border-accent/40' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent'}`}
                  >
                    <span className="flex items-center gap-2 text-left">
                      <Flame size={16} className={(configItem as any).isHabit ? 'text-accent' : 'text-[#18181B]/40 dark:text-[#E6E8E6]/40'} />
                      <span>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6]">Suivre comme habitude</span>
                        <span className="block text-[9px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50">Série et régularité visibles dans Analytics</span>
                      </span>
                    </span>
                    <span className={`w-9 h-5 rounded-full p-0.5 transition-all shrink-0 ${(configItem as any).isHabit ? 'bg-accent' : 'bg-[#18181B]/15 dark:bg-[#E6E8E6]/15'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${(configItem as any).isHabit ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                )}
                <button
                  onClick={handleSkipToday}
                  className="w-full py-4 text-[#FDCA40] font-black uppercase text-[10px] tracking-widest bg-[#FDCA40]/5 rounded-2xl border border-[#FDCA40]/10 hover:bg-[#FDCA40] hover:text-white transition-all"
                >
                  Sauter aujourd'hui (avec motif)
                </button>
              </>
            )}

            {(configModal.type !== 'goal' || activeTab !== 'routine') && (
                <button 
                  onClick={handleDeleteConfigItem} 
                  className="w-full py-4 text-[#DF2935] font-black uppercase text-[10px] tracking-widest bg-[#DF2935]/5 rounded-2xl border border-[#DF2935]/10 hover:bg-[#DF2935] hover:text-white transition-all"
                >
                  Supprimer
                </button>
            )}
            <button onClick={() => setConfigModal(null)} className="w-full py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest">Fermer</button>
          </div>
          </div>
        </div>
      )}

      {/* SKIP TODAY MODAL — remplace window.prompt pour respecter le design de l'app */}
      {skipModal && (
        <div className="fixed inset-0 z-[120] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setSkipModal(null); }}>
           <div className="glass relative w-full max-w-sm p-6 sm:p-10 rounded-[3rem] space-y-6 animate-in zoom-in-95">
              <button
                onClick={() => setSkipModal(null)}
                aria-label="Fermer"
                className="absolute top-7 right-7 w-7 h-7 rounded-full flex items-center justify-center bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-[#FDCA40] hover:text-white transition-all"
              >
                <X size={14} strokeWidth={3} />
              </button>
              <div className="text-center">
                 <div className="w-16 h-16 bg-[#FDCA40]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <SkipForward className="text-[#FDCA40]" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Sauter aujourd'hui</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4 mt-2">"{skipModal.taskTitle}"</p>
              </div>
              <div className="space-y-3">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Pourquoi ? <span className="normal-case font-bold">(facultatif)</span></p>
                 <div className="flex flex-wrap gap-2">
                   {['Fatigue', 'Imprévu', 'Manque de temps', 'Pas prioritaire', 'Malade'].map(r => {
                     const on = skipReason.trim() === r;
                     return (
                       <button
                         key={r}
                         type="button"
                         onClick={() => setSkipReason(on ? '' : r)}
                         className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-[#FDCA40] border-[#FDCA40] text-[#080708]' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent text-[#18181B]/70 dark:text-[#E6E8E6]/70 hover:border-[#FDCA40]/40'}`}
                       >
                         {r}
                       </button>
                     );
                   })}
                 </div>
                 <textarea
                    autoFocus
                    rows={3}
                    placeholder="Ou écrivez votre motif…"
                    className="w-full resize-none bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-[#FDCA40] transition-all text-[#18181B] dark:text-[#E6E8E6] placeholder-[#18181B]/30 dark:placeholder-[#E6E8E6]/30"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmSkipToday(); } }}
                 />
                 <p className="text-[9px] font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50 px-2 leading-relaxed">Le motif nourrit vos observations, sans culpabilité. 🌿</p>
              </div>
              <div className="flex gap-3 pt-2">
                 <button
                   onClick={confirmSkipToday}
                   className="flex-1 bg-[#FDCA40] py-4 rounded-[2rem] text-[#080708] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#FDCA40]/20 active:scale-95 transition-all"
                 >
                    Sauter
                 </button>
                 <button
                   onClick={() => setSkipModal(null)}
                   className="flex-1 py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest"
                 >
                    Annuler
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-[110] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="glass w-full max-w-sm p-6 sm:p-10 rounded-[3rem] space-y-6">
              <div className="text-center">
                 <div className="w-16 h-16 bg-[#FDCA40]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarClock className="text-[#FDCA40]" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Reporter la tâche</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4 mt-2">"{rescheduleModal.task.title}"</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Nouvelle date</p>
                 <input 
                    type="date" 
                    className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-[#FDCA40] transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                    value={rescheduleDate}
                    min={getKeyFromDate(new Date())}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                 />
              </div>
              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={handleRescheduleConfirm}
                   disabled={!rescheduleDate}
                   className="flex-1 bg-[#FDCA40] py-4 rounded-[2rem] text-[#080708] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#FDCA40]/20 disabled:opacity-50"
                 >
                    Confirmer
                 </button>
                 <button 
                   onClick={() => { setRescheduleModal(null); setRescheduleDate(""); }}
                   className="flex-1 py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest"
                 >
                    Annuler
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Other Modals (Templates, Reset, etc. remain the same) */}
      {showResetModal && (
        <div className="fixed inset-0 z-[120] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="glass w-full max-sm p-10 rounded-[3.5rem] space-y-6 shadow-2xl border border-[#DF2935]/20">
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 bg-[#DF2935]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Power className="text-[#DF2935]" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Changer de Routine</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest px-4">Cette action arrêtera la routine en cours.</p>
              </div>

              <div className="space-y-4">
                 <p className="text-xs text-[#18181B]/60 dark:text-[#E6E8E6]/60 text-center leading-relaxed">Voulez-vous sauvegarder votre configuration actuelle comme modèle avant de tout remettre à zéro ?</p>
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase ml-2">Nom de l'archive (Optionnel)</label>
                    <input 
                      className="w-full bg-[#18181B]/5 dark:bg-[#080708] p-4 rounded-2xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-[#DF2935] transition-all text-[#18181B] dark:text-[#E6E8E6]"
                      placeholder="Ex: Routine Hiver 2024"
                      value={resetArchiveName}
                      onChange={e => setResetArchiveName(e.target.value)}
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                 <button 
                   onClick={() => performResetRoutine(true)} 
                   disabled={!resetArchiveName}
                   className="w-full bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] py-4 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-[#E6E8E6]/5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    Archiver & Réinitialiser
                 </button>
                 <button 
                   onClick={() => performResetRoutine(false)} 
                   className="w-full bg-[#DF2935] py-4 rounded-[2rem] text-[10px] font-black uppercase shadow-xl shadow-[#DF2935]/30 active:scale-95 transition-all text-white"
                 >
                    Réinitialiser sans sauvegarder
                 </button>
                 <button 
                   onClick={() => setShowResetModal(false)} 
                   className="w-full py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest"
                 >
                    Annuler
                 </button>
              </div>
           </div>
        </div>
      )}

      {transferTask && (() => {
        const options = deployBlockOptions();
        const chip = (on: boolean) => `py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent text-[#18181B] dark:text-[#E6E8E6] hover:bg-accent/20'}`;
        const dateCls = "w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]";
        const canDeploy = !!deployBlockId || !!deployNewBlock?.trim();
        return (
        <div className="fixed inset-0 z-[120] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDeploy(); }}>
           <div className="glass relative w-full rounded-[3rem] max-h-[92vh] flex flex-col" style={{ maxWidth: deploySize.width }}>
              <SideResizeHandles onStart={deploySize.startResize} onReset={deploySize.reset} />
              <button onClick={closeDeploy} title="Fermer (Échap)" aria-label="Fermer" className="absolute z-20 top-7 right-7 w-7 h-7 rounded-full flex items-center justify-center bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all"><X size={14} strokeWidth={3} /></button>
              <div className="p-6 sm:p-10 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="text-center space-y-2">
                 <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Send className="text-accent" size={22} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Déployer la tâche</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4">"{transferTask.title}"</p>
              </div>

              {/* 1. QUAND */}
              <div className="space-y-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">1. Quand ?</p>
                 <p className="text-[8px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase px-2 pt-1">Un seul jour</p>
                 <div className="grid grid-cols-3 gap-2">
                   {([['today', "Aujourd'hui"], ['tomorrow', 'Demain'], ['date', 'Jour précis']] as const).map(([id, label]) => (
                     <button key={id} type="button" onClick={() => { setDeployWhen(id); setDeployBlockId(null); }} className={chip(deployWhen === id)}>{label}</button>
                   ))}
                 </div>
                 {deployWhen === 'date' && (
                   <input type="date" aria-label="Jour de la tâche" className={dateCls} value={deployDate} onChange={(e) => { setDeployDate(e.target.value); setDeployBlockId(null); }} />
                 )}
                 <p className="text-[8px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase px-2 pt-2">Plusieurs jours</p>
                 <div className="grid grid-cols-3 gap-2">
                   {([['daily', 'Tous les jours'], ['weekdays', 'Lun – Ven'], ['weekends', 'Week-end'], ['weekly', 'Chaque semaine'], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['period', 'Période']] as const).map(([id, label]) => (
                     <button key={id} type="button" onClick={() => { setDeployWhen(id); setDeployBlockId(null); }} className={chip(deployWhen === id)}>{label}</button>
                   ))}
                 </div>
                 {deployWhen === 'weekly' && (
                   <div><p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">À partir du (le jour de la semaine est repris)</p><input type="date" aria-label="Premier jour" className={dateCls} value={deployDate} onChange={(e) => setDeployDate(e.target.value)} /></div>
                 )}
                 {deployWhen === 'period' && (
                   <div className="grid grid-cols-2 gap-2">
                     <div><p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Début</p><input type="date" className={dateCls} value={deployStart} onChange={(e) => setDeployStart(e.target.value)} /></div>
                     <div><p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Fin</p><input type="date" min={deployStart} className={dateCls} value={deployEnd} onChange={(e) => setDeployEnd(e.target.value)} /></div>
                   </div>
                 )}
                 <p className="text-[10px] font-bold text-accent px-2">{describeDeploy()}</p>
              </div>

              {/* 2. OÙ */}
              <div className="space-y-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">2. Dans quel bloc ?</p>
                 {options.map(block => {
                   const on = deployBlockId === block.id && deployNewBlock === null;
                   return (
                     <button
                       key={block.id}
                       type="button"
                       onClick={() => { setDeployBlockId(block.id); setDeployNewBlock(null); }}
                       className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${on ? 'bg-accent/15 border-accent' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent hover:border-accent/50'}`}
                     >
                        {on ? <Check size={12} className="text-accent" strokeWidth={3} /> : <Circle size={8} className="text-accent fill-accent" />}
                        <span className="font-heading text-xs font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6]">{block.title}</span>
                        {block.recurrence === 'specific' && <span className="ml-auto text-[8px] font-black uppercase text-[#FDCA40]">Ce jour</span>}
                     </button>
                   );
                 })}
                 {options.length === 0 && <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 italic text-center py-2">Aucun bloc prévu {deploySingleDay() ? 'ce jour-là' : 'dans le planning'}. Créez-en un ci-dessous.</p>}

                 {deployNewBlock === null ? (
                   <button type="button" onClick={() => { setDeployNewBlock(''); setDeployBlockId(null); }} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-accent/40 text-accent text-[10px] font-black uppercase tracking-wider hover:bg-accent/10 transition-all">
                     <Plus size={14} /> {deploySingleDay() ? 'Nouveau bloc pour ce jour' : 'Nouveau bloc'}
                   </button>
                 ) : (
                   <div className="flex items-center gap-2 p-2 rounded-2xl border border-accent bg-accent/10">
                     <input
                       autoFocus
                       placeholder="Nom du nouveau bloc…"
                       className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm font-bold outline-none text-[#18181B] dark:text-[#E6E8E6] placeholder-[#18181B]/30 dark:placeholder-[#E6E8E6]/30"
                       value={deployNewBlock}
                       onChange={(e) => setDeployNewBlock(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && deployNewBlock.trim()) deployInboxTask(); if (e.key === 'Escape') { e.stopPropagation(); setDeployNewBlock(null); } }}
                     />
                     <button type="button" onClick={() => setDeployNewBlock(null)} aria-label="Annuler la création" className="p-2 text-[#18181B]/50 dark:text-[#E6E8E6]/50 hover:text-[#DF2935]"><X size={14} /></button>
                   </div>
                 )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={!canDeploy}
                  onClick={deployInboxTask}
                  className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${canDeploy ? 'bg-accent text-white shadow-lg shadow-accent/20 active:scale-95' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/30 dark:text-[#E6E8E6]/30 cursor-not-allowed'}`}
                >
                  Déployer
                </button>
                <button type="button" onClick={closeDeploy} className="flex-1 py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest">Annuler</button>
              </div>
              </div>
           </div>
        </div>
        );
      })()}

      {showReviewModal && (
        <div className="fixed inset-0 z-[100] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="glass w-full max-xl p-8 md:p-12 rounded-[3.5rem] space-y-8 overflow-y-auto max-h-[90vh] custom-scrollbar shadow-2xl relative">
              <button onClick={() => setShowReviewModal(false)} className="absolute top-8 right-8 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#18181B] dark:hover:text-[#E6E8E6] transition-colors p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full"><X size={20}/></button>
              
              <div className="text-center space-y-2">
                 <div className="w-20 h-20 bg-accent/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                    <Star className="text-accent fill-accent" size={32} />
                 </div>
                 <h3 className="text-2xl font-black uppercase tracking-tight text-[#18181B] dark:text-[#E6E8E6]">Bilan de la journée</h3>
                 <p className="text-xs font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Une minute pour grandir demain</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="glass p-6 rounded-3xl text-center space-y-1">
                    <span className="text-4xl font-black text-accent">{perfToday}%</span>
                    <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Score de Routine</p>
                 </div>
                 <div className="glass p-6 rounded-3xl flex flex-col items-center justify-center gap-2">
                    <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Humeur</p>
                    <div className="flex gap-2">
                       {[
                         {id: 'bad', icon: Frown},
                         {id: 'neutral', icon: Meh},
                         {id: 'good', icon: Smile},
                         {id: 'great', icon: Laugh},
                       ].map(m => (
                         <button 
                           key={m.id} 
                           onClick={() => updateAppData(prev => ({ ...prev, days: { ...prev.days, [dateKey]: { ...currentDayData, mood: m.id } } }))}
                           className={`p-2 rounded-xl transition-all ${currentDayData.mood === m.id ? 'bg-accent text-white scale-110 shadow-lg shadow-accent/20' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}
                         >
                           <m.icon size={20} />
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <p className="text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest ml-2 italic">Réflexion & Gratitude</p>
                 <RichText
                   minHeight={160}
                   placeholder="Qu'avez-vous appris aujourd'hui ? Qu'allez-vous améliorer ?"
                   value={currentDayData.reflection || ""}
                   onChange={(html) => updateAppData(prev => ({ ...prev, days: { ...prev.days, [dateKey]: { ...currentDayData, reflection: html } } }))}
                 />
              </div>

              {currentDayData.aiFeedback ? (
                <div className="bg-accent/10 p-6 rounded-3xl border border-accent/20 animate-in slide-in-from-top-2">
                   <p className="text-[9px] font-black text-accent uppercase tracking-widest mb-2 flex items-center gap-2"><BrainCircuit size={12}/> Caddr. AI Insight</p>
                   <p className="text-sm font-medium text-[#18181B] dark:text-[#E6E8E6] italic mb-4">"{currentDayData.aiFeedback.feedback}"</p>
                   <div className="bg-accent/20 p-4 rounded-2xl flex items-center gap-3">
                      <Zap size={16} className="text-accent" />
                      <div>
                        <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase">Focus Demain</p>
                        <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{currentDayData.aiFeedback.focusTomorrow}</p>
                      </div>
                   </div>
                </div>
              ) : (
                <button 
                  onClick={handleReviewAI}
                  disabled={isReviewAiLoading || !currentDayData.reflection}
                  className="w-full bg-accent py-5 rounded-[2rem] text-xs font-black uppercase shadow-xl shadow-accent/30 flex items-center justify-center gap-3 disabled:opacity-50 text-white"
                >
                  {isReviewAiLoading ? <Loader2 className="animate-spin" size={18} /> : <><Sparkles size={18}/> Analyser ma journée</> }
                </button>
              )}

              <button 
                onClick={() => setShowReviewModal(false)}
                className="w-full py-2 text-[9px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest"
              >
                Terminer
              </button>
           </div>
        </div>
      )}

      {templateModal && (
        <div className="fixed inset-0 z-[100] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
          <div className="glass w-full max-sm p-10 rounded-[3rem] space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Save className="text-accent" size={24} />
              </div>
              <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">{editingTemplateId ? "Modifier le modèle" : "Nouveau modèle"}</h3>
            </div>
            <div className="space-y-4">
                <input autoFocus className="w-full bg-[#18181B]/5 dark:bg-[#080708] p-4 rounded-2xl text-sm border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent transition-all font-bold text-[#18181B] dark:text-[#E6E8E6]" placeholder="Nom du modèle" value={newTplName} onChange={e => setNewTplName(e.target.value)} />
                <input className="w-full bg-[#18181B]/5 dark:bg-[#080708] p-4 rounded-2xl text-sm border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent transition-all font-bold text-[#18181B] dark:text-[#E6E8E6]" placeholder="Objectif par défaut" value={newTplGoal} onChange={e => setNewTplGoal(e.target.value)} />
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setTemplateModal(false); setEditingTemplateId(null); setNewTplName(""); setNewTplGoal(""); }} className="flex-1 py-5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest">Annuler</button>
              <button onClick={handleSaveTemplate} className="flex-1 bg-accent py-5 rounded-[2rem] text-[10px] font-black uppercase shadow-xl shadow-accent/30 tracking-widest text-white">{editingTemplateId ? "Mettre à jour" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {showAiGen && (
        <div className="fixed inset-0 z-[100] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
          <div className="glass w-full max-w-sm p-6 sm:p-10 rounded-[3rem] space-y-6 shadow-2xl border border-[#FDCA40]/20">
            <div className="text-center"><div className="w-16 h-16 bg-[#FDCA40]/10 rounded-3xl flex items-center justify-center mx-auto mb-4"><Wand2 className="text-[#FDCA40]" size={28} /></div><h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Architecte IA</h3></div>
            <textarea className="w-full bg-[#18181B]/5 dark:bg-[#080708] p-5 rounded-[2rem] text-sm border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-[#FDCA40] h-32 font-semibold text-[#18181B] dark:text-[#E6E8E6]" placeholder="Décrivez vos objectifs de vie..." value={aiGoal} onChange={e => setAiGoal(e.target.value)} />
            <div className="flex gap-4"><button onClick={() => setShowAiGen(false)} className="flex-1 py-5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px]">Annuler</button><button onClick={handleGenerateRoutine} disabled={isAiLoading || !aiGoal} className="flex-1 bg-[#FDCA40] py-5 rounded-[2rem] text-[10px] font-black uppercase text-[#080708]">{isAiLoading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Générer"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
