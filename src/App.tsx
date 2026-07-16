
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Check, ChevronLeft, ChevronRight, Target, 
  Plus, Trash2, Layout, BarChart3, 
  Circle, Calendar, Repeat, X, 
  TrendingUp, Save, Copy, Cloud, 
  Loader2, Sparkles, BrainCircuit, 
  ArrowRight, Camera, Wand2, Zap,
  ChevronUp, ChevronDown, CalendarDays, GripVertical, Link2, CalendarRange,
  History, MoveVertical, Clock, ListPlus,
  ChevronRightSquare, Bell, BellRing, BellOff, Timer, AlarmClock,
  ClipboardCheck, Smile, Meh, Frown, Laugh, Star, Flame, Trophy,
  ListChecks, Search, AlertCircle, Quote, Archive, Inbox, Send,
  Lock, LockOpen, User, LogOut, ShieldCheck, Mail, Key, Settings2, Info,
  Download, Upload, Power, Pencil, Edit3, PieChart, FileText,
  CalendarClock, ArrowUpCircle, BookOpen, PenTool, Crown, Swords,
  Medal, Sun, Moon, RotateCcw, CloudOff
} from 'lucide-react';
import { AppData, Block, TabType, RecurrenceType, TimeframeType, RecurringGoal, Task, PriorityType, DayRoutine, UserProfile } from './types';
import { getKeyFromDate, generateId, isDateInRange } from './utils';
import { getRoutineAdvice, generateRoutineFromGoal, extractRoutineFromImage, getDailyReviewFeedback } from './services/geminiService';
import { 
  signInWithGoogle, 
  signOut as firebaseSignOut, 
  onAuthChange, 
  saveDataToCloud, 
  loadDataFromCloud,
  mergeAppData
} from './services/syncService';
import YearHeatmap from './components/YearHeatmap';
import MoodPerfChart from './components/MoodPerfChart';
import Badges from './components/Badges';
import FocusMode from './components/FocusMode';
import DayTimeline from './components/DayTimeline';
import InboxView from './components/InboxView';
import HabitStreaks from './components/HabitStreaks';
import LongTermGoals from './components/LongTermGoals';
import WeeklyReview from './components/WeeklyReview';
import FocusStats from './components/FocusStats';
import Insights from './components/Insights';
import WeekAgenda from './components/WeekAgenda';
import AnnualReview from './components/AnnualReview';
import { STARTER_TEMPLATES } from './starterTemplates';
import { downloadICS } from './ics';
import { computePerfectStreakWithGrace, getWeekKey } from './streaks';
import { enablePush } from './push';
import { parseCapture } from './nlParse';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Sortable } from './components/Sortable';
import type { User as FirebaseUser } from 'firebase/auth';
import { 
  CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, BarChart, Bar, Legend, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STORAGE_KEY = 'caddr_routine_v6_timing';
const THEME_KEY = 'caddr_theme_preference';
const ACCENT_KEY = 'caddr_accent_preference';

// Thèmes d'accent — { rgb pour Tailwind/CSS, hex pour recharts/PDF }
export type AccentTheme = 'teal' | 'blue' | 'violet' | 'amber' | 'rose';
const THEMES: Record<AccentTheme, { label: string; rgb: string; hex: string }> = {
  teal:   { label: 'Teal',   rgb: '47 176 166',  hex: '#2FB0A6' },
  blue:   { label: 'Océan',  rgb: '55 114 255',  hex: '#3772FF' },
  violet: { label: 'Violet', rgb: '124 92 252',  hex: '#7C5CFC' },
  amber:  { label: 'Ambre',  rgb: '245 144 12',  hex: '#F5900C' },
  rose:   { label: 'Rose',   rgb: '244 63 110',  hex: '#F43F6E' },
};

// XP Constants
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>('teal');

  // Firebase/Sync States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Inbox Local State
  const [newInboxTitle, setNewInboxTitle] = useState("");
  const [transferTask, setTransferTask] = useState<Task | null>(null);

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
  const backupInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const dateKey = getKeyFromDate(currentDate);

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
        } catch (error) {
          console.error('Error loading cloud data:', error);
          setSyncError('Erreur de chargement');
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
    const valid: TabType[] = ['routine', 'stats', 'schedule', 'templates', 'ai', 'inbox', 'settings'];
    if (tab && valid.includes(tab as TabType)) setActiveTab(tab as TabType);
  }, []);

  const accentHex = (THEMES[accentTheme] || THEMES.teal).hex;
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const graceDays = appData.settings?.graceDaysPerWeek ?? 1;

  // Auto-save to cloud when user is signed in
  useEffect(() => {
    if (!user || isLoading) return;

    const saveTimer = setTimeout(async () => {
      try {
        await saveDataToCloud(user.uid, appData);
        setLastSyncTime(new Date());
        setSyncError(null);
      } catch (error) {
        console.error('Error auto-saving to cloud:', error);
        setSyncError('Erreur de sync');
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [appData, user, isLoading]);

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
      const recurring = (appData.recurringGoals || []).filter(g => isDateInRange(today, g.recurrence, g.specificDate, g.startDate, g.endDate));
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
          profile: { xp: newXp, level: newLevel },
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

  const handleDownloadPDF = () => {
    // ... (Existing PDF logic kept the same)
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
    const recurring = (appData.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate));
    return recurring?.title || "";
  }, [appData.days, appData.recurringGoals, dateKey, currentDate]);

  const currentDayData = useMemo(() => {
    return appData.days[dateKey] || { goalCompleted: false, note: "" } as DayRoutine;
  }, [appData.days, dateKey]);

  const currentGoalReminder = useMemo(() => {
    const dayData = appData.days[dateKey];
    if (dayData?.reminderTime) return dayData.reminderTime;
    const recurring = (appData.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate));
    return recurring?.reminderTime || "";
  }, [appData.days, appData.recurringGoals, dateKey, currentDate]);

  // --- LOGIC: VISIBLE ITEMS ---
  const routineBlocks = useMemo(() => {
    if (appData.days[dateKey]?.blocks) {
      return appData.days[dateKey].blocks!;
    }
    return appData.blocks.filter(b => isDateInRange(currentDate, b.recurrence, b.specificDate, b.startDate, b.endDate));
  }, [appData.blocks, appData.days, dateKey, currentDate]);

  const getVisibleTasks = useCallback((tasks: Task[]) => {
    return (tasks || []).filter(t => isDateInRange(currentDate, t.recurrence, t.specificDate, t.startDate, t.endDate));
  }, [currentDate]);

  const perfToday = useMemo(() => {
    let total = 0; let done = 0;
    routineBlocks.forEach(block => {
      const tasks = getVisibleTasks(block.tasks);
      tasks.forEach(task => {
        total++; if (task.completedDates?.includes(dateKey)) done++;
        (task.subTasks || []).forEach(st => {
           if (isDateInRange(currentDate, st.recurrence, st.specificDate, st.startDate, st.endDate)) {
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
        : prev.blocks.filter(b => isDateInRange(currentDate, b.recurrence, b.specificDate, b.startDate, b.endDate));
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


    if (targetIsRoutine && hasLocalBlocks) {
      updateAppData(prev => {
          const { profile, leveledUp } = handleXpGain(prev.userProfile, xpDelta);
          if (leveledUp) setShowLevelUpModal(profile.level);

          const newBlocks = prev.days[dateKey].blocks!.map(b => {
              if (b.id !== blockId) return b;
              const updateTask = (t: Task) => {
                if (t.id !== taskId) return t;
                const completed = t.completedDates || [];
                return { ...t, completedDates: completed.includes(dateKey) ? completed.filter(d => d !== dateKey) : [...completed, dateKey] };
              };
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
            const updateTask = (t: Task) => {
              if (t.id !== taskId) return t;
              const completed = t.completedDates || [];
              return { ...t, completedDates: completed.includes(dateKey) ? completed.filter(d => d !== dateKey) : [...completed, dateKey] };
            };
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
    const newTask: Task = { id: generateId(), title: p.title, completedDates: [], recurrence: p.recurrence || 'daily', subTasks: [], specificDate: p.specificDate, startTime: p.startTime, priority: p.priority };
    updateAppData(prev => ({ ...prev, inboxTasks: [newTask, ...(prev.inboxTasks || [])] }));
    setNewInboxTitle("");
  };

  const deployInboxTask = (blockId: string) => {
    if (!transferTask) return;
    saveToHistory(); // Save before deploy
    updateAppData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, tasks: [...b.tasks, transferTask] } : b),
      inboxTasks: (prev.inboxTasks || []).filter(t => t.id !== transferTask.id)
    }));
    setTransferTask(null);
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
         : appData.blocks.filter(b => isDateInRange(current, b.recurrence, b.specificDate, b.startDate, b.endDate));

      blocksForDay.forEach(b => {
          // Identify tasks for this block on this day
          const tasksForDay = hasOverrides 
             ? b.tasks 
             : b.tasks.filter(t => isDateInRange(current, t.recurrence, t.specificDate, t.startDate, t.endDate));

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
                   : (t.subTasks || []).filter(st => isDateInRange(current, st.recurrence, st.specificDate, st.startDate, st.endDate));

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
  const [focusTarget, setFocusTarget] = useState<{ task: Task; blockId: string; blockTitle: string } | null>(null);

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

  const handleFocusComplete = () => {
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
        completedInTime: true,
      };
      return { ...prev, userProfile: profile, focusSessions: [...(prev.focusSessions || []), session] };
    });
    setActiveNotification("Session Focus terminée ! +10 XP bonus 🎯");
    setTimeout(() => setActiveNotification(null), 4000);
    setFocusTarget(null);
  };

  const handleRescheduleTask = (taskId: string, targetDateKey: string, startTime: string) => {
    updateAppData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => ({
        ...b,
        tasks: b.tasks.map(t => {
          if (t.id !== taskId) return t;
          const moved: Task = { ...t, startTime };
          // Tâche ponctuelle : on la déplace aussi sur le jour cible
          if (t.recurrence === 'specific' || t.recurrence === 'once') moved.specificDate = targetDateKey;
          return moved;
        }),
      })),
    }));
    setActiveNotification(`Reprogrammé à ${startTime} ⏱`);
    setTimeout(() => setActiveNotification(null), 3000);
  };

  const handleSkipToday = () => {
    if (!configModal || configModal.type !== 'task') return;
    const item = getConfigItem();
    if (!item) return;
    const reason = window.prompt("Pourquoi sauter cette tâche aujourd'hui ? (le motif nourrit vos observations, sans culpabilité)");
    if (reason === null) return;
    updateAppData(prev => ({
      ...prev,
      skips: [...(prev.skips || []), { id: generateId(), taskId: item.id, taskTitle: item.title, date: dateKey, reason: reason.trim() }],
    }));
    setConfigModal(null);
    setActiveNotification("Tâche sautée. Ce n'est pas un échec, c'est un choix. 🌿");
    setTimeout(() => setActiveNotification(null), 4000);
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
    } catch (error) {
      console.error('Sign in error:', error);
      setSyncError('Erreur de connexion');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setSyncError('Erreur de déconnexion');
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#080708] flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#080708] pb-32 text-[#18181B] dark:text-[#E6E8E6] font-['Plus_Jakarta_Sans'] transition-colors duration-300">
      
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
      <header className="px-6 py-4 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#F4F4F5]/80 dark:bg-[#080708]/80 backdrop-blur-xl sticky top-0 z-40 flex flex-col gap-4 max-w-4xl mx-auto w-full transition-colors duration-300">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d); }} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#18181B] dark:hover:text-[#E6E8E6] transition-colors"><ChevronLeft size={20}/></button>
            <div className="text-center min-w-[80px]">
                <span className="block text-[8px] font-black text-accent uppercase tracking-widest">{currentDate.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                <span className="text-xs font-bold">{currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            </div>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d); }} className="p-2 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#18181B] dark:hover:text-[#E6E8E6] transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="flex items-center gap-2">
            {/* Backup Actions */}
            <div className="flex items-center gap-1 border-r border-[#18181B]/10 dark:border-[#E6E8E6]/10 pr-2 mr-1">
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
                <Cloud className={`w-3.5 h-3.5 ${syncError ? 'text-red-500' : 'text-green-500'}`} />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold truncate max-w-[100px]">
                    {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  {lastSyncTime && !syncError && (
                    <span className="text-[8px] opacity-60">
                      {lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {syncError && (
                    <span className="text-[7px] text-red-500">{syncError}</span>
                  )}
                </div>
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
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 border border-[#18181B]/5 dark:border-[#E6E8E6]/5"
                title="Se connecter pour synchroniser"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-[#18181B]/60 dark:text-[#E6E8E6]/60" />
                )}
                <span className="text-[9px] font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60">
                  {isSigningIn ? 'Connexion...' : 'Sync'}
                </span>
              </button>
            )}
            
            <button onClick={toggleTheme} className="p-2 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 transition-all hover:text-accent">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button onClick={requestNotificationPermission} className={`p-2 rounded-xl transition-all ${notificationsEnabled ? 'text-accent bg-accent/10' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5'}`}>{notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}</button>
            {activeTab === 'routine' && <button onClick={() => setIsReorderMode(!isReorderMode)} className={`p-2 rounded-xl transition-all ${isReorderMode ? 'bg-accent text-white' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}><MoveVertical size={16} /></button>}
            <div className="bg-accent/10 px-3 py-1 rounded-full text-[10px] font-black text-accent border border-accent/20">{perfToday}%</div>
            </div>
        </div>

        {/* RPG Bar */}
        <div className="relative pt-1">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-[#FDCA40] uppercase tracking-wider flex items-center gap-1"><Crown size={12} /> Lvl {currentLevel}</span>
                    <span className="text-[8px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest">• {getRankTitle(currentLevel)}</span>
                </div>
                <span className="text-[8px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest">{Math.floor(currentXp)} / {xpNextLevel} XP</span>
            </div>
            <div className="h-1.5 w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-[#FDCA40] to-[#FF9F1C] transition-all duration-700 ease-out shadow-[0_0_10px_rgba(253,202,64,0.3)]" 
                    style={{ width: `${xpProgress}%` }} 
                />
            </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-4 space-y-8">
        
        {/* TAB: ROUTINE */}
        {activeTab === 'routine' && (
          <div className="space-y-6 animate-in fade-in duration-500">
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
                    <button onClick={() => { const id = generateId(); updateAppData(prev => { const existingGoal = (prev.recurringGoals || []).find(g => isDateInRange(currentDate, g.recurrence, g.specificDate, g.startDate, g.endDate)); if (existingGoal) { setConfigModal({ type: 'goal', id: existingGoal.id }); return prev; } setConfigModal({ type: 'goal', id }); return { ...prev, recurringGoals: [...(prev.recurringGoals || []), { id, title: currentGoal || "Nouvel Objectif", recurrence: 'specific', specificDate: dateKey }] }; }); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Clock size={12} /></button>
                </div>
                <input className="bg-transparent w-full text-lg font-bold outline-none placeholder-[#18181B]/30 dark:placeholder-[#E6E8E6]/30 text-[#18181B] dark:text-[#E6E8E6]" placeholder="Focus du jour..." value={currentGoal} onChange={e => updateAppData(prev => ({ ...prev, days: { ...prev.days, [dateKey]: { ...currentDayData, dailyGoalOverride: e.target.value } } }))} />
              </div>
            </div>

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
                  <p className="text-sm font-medium text-[#18181B] dark:text-[#E6E8E6] italic leading-relaxed">"{currentDayData.reflection}"</p>
                  
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
                    <SortableContext items={routineBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    {routineBlocks.map((block, bIdx) => {
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
                                   <span className="text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-accent rounded-full" /> {block.title}</span>
                                </button>
                                {block.description && !block.isCollapsed && <p className="text-[8px] text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium ml-8 mt-0.5 whitespace-pre-wrap break-words animate-in slide-in-from-top-1 pr-4">{block.description}</p>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-accent/80 uppercase tracking-wider">{blockPercentage}%</span>
                                {!block.isCollapsed && (
                                  <div className="flex gap-1 animate-in zoom-in-50">
                                    <button onClick={() => setConfigModal({ type: 'block', id: block.id })} className="p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors" title="Configurer le bloc"><Settings2 size={14} /></button>
                                    <button onClick={() => { saveToHistory(); handleRoutineStructureChange(blocks => blocks.filter(b => b.id !== block.id)); }} className="p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-colors" title="Supprimer le bloc (ce jour uniquement)"><Trash2 size={14} /></button>
                                    <button onClick={() => addTaskToBlock(block.id)} className="p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Plus size={14} /></button>
                                    <button onClick={() => handleDuplicate('block', block.id)} className="p-1 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent transition-colors"><Copy size={14} /></button>
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
                                              {task.description}
                                            </p>
                                          )}
                                          {task.startTime && <span className={`text-[9px] font-black flex items-center gap-1 mt-0.5 ${active ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'} uppercase tracking-widest`}><Clock size={10} /> {formatTaskTime(task.startTime, task.duration)}{active && <span className="ml-2 flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>}</span>}
                                          {task.stackAnchor && <span className="text-[9px] font-bold flex items-center gap-1 mt-0.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 italic"><Link2 size={9} /> après {task.stackAnchor}</span>}
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
                                    {visibleSubTasks.length > 0 && <div className="pl-14 pr-5 pb-5 space-y-3">{visibleSubTasks.map(st => {
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
                                            <p className="ml-7 text-[10px] text-[#18181B]/50 dark:text-[#E6E8E6]/50 line-clamp-1">{st.description}</p>
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
              <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 max-w-xs">
                <button onClick={() => setPlanningView('day')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${planningView === 'day' ? 'bg-accent text-white shadow' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>Jour</button>
                <button onClick={() => setPlanningView('week')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${planningView === 'week' ? 'bg-accent text-white shadow' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>Semaine</button>
              </div>
            )}
            {!templateEditState && planningView === 'day' && (
              <DayTimeline blocks={routineBlocks} currentTime={currentTime} dateKey={dateKey} />
            )}
            {!templateEditState && planningView === 'week' && (
              <WeekAgenda appData={appData} currentTime={currentTime} onReschedule={handleRescheduleTask} />
            )}
            {!templateEditState && (
              <LongTermGoals
                goals={appData.longTermGoals || []}
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
              <div className="glass p-6 rounded-[2rem] flex items-center justify-between border border-accent/20 bg-accent/5">
                <div><h2 className="font-black uppercase tracking-wider text-sm text-[#18181B] dark:text-[#E6E8E6]">PLANNING CADDR.</h2><p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase">Structure & Objectifs</p></div>
                <div className="flex gap-2">
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
              {appData.blocks.map((block, bIdx) => (
                <div key={block.id} className={`glass p-6 rounded-[2.5rem] space-y-4 group transition-all ${block.isLocked ? 'border-accent/20 bg-accent/[0.02]' : ''}`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { const n = [...appData.blocks]; if (bIdx > 0) [n[bIdx], n[bIdx-1]] = [n[bIdx-1], n[bIdx]]; updateAppData(prev => ({...prev, blocks: n})); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={bIdx === 0}><ChevronUp size={14}/></button>
                          <button onClick={() => { const n = [...appData.blocks]; if (bIdx < n.length-1) [n[bIdx], n[bIdx+1]] = [n[bIdx+1], n[bIdx]]; updateAppData(prev => ({...prev, blocks: n})); }} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={bIdx === appData.blocks.length - 1}><ChevronDown size={14}/></button>
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center gap-2">
                             <button onClick={() => toggleBlockCollapse(block.id)} className="p-1 rounded-lg bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all">
                                {block.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                             </button>
                             <input className="bg-transparent font-black text-sm outline-none border-b border-transparent focus:border-accent w-full text-[#18181B] dark:text-[#E6E8E6]" value={block.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, title: e.target.value } : b) }))} />
                             {block.isLocked && <Lock size={12} className="text-accent/60 shrink-0" />}
                          </div>
                          {block.description && !block.isCollapsed && <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-medium whitespace-pre-wrap break-words mt-1 ml-8">{block.description}</p>}
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
                      {block.tasks.map((task, tIdx) => (
                        <div key={task.id} className="space-y-2">
                          <div className="flex items-center gap-4 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-4 rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 group/task relative">
                            {!block.isLocked && (
                                <div className="flex flex-col gap-1 items-center justify-center -ml-2 shrink-0">
                                <button onClick={() => moveTaskInEngine(block.id, task.id, 'up')} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={tIdx === 0}><ChevronUp size={12} /></button>
                                <button onClick={() => moveTaskInEngine(block.id, task.id, 'down')} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={tIdx === block.tasks.length - 1}><ChevronDown size={12} /></button>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                  <input className="bg-transparent flex-1 text-xs font-semibold outline-none w-full text-[#18181B] dark:text-[#E6E8E6]" value={task.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, title: e.target.value } : t) } : b) }))} />
                                  {task.priority && task.priority !== 'medium' && (
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityInfo(task.priority).color.replace('text', 'bg')}`} title={getPriorityInfo(task.priority).label} />
                                  )}
                              </div>
                              {task.description && <p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 truncate mt-0.5">{task.description}</p>}
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
                          {(task.subTasks || []).map((st, stIdx) => (
                            <div key={st.id} className="ml-10 flex items-center gap-3 bg-[#18181B]/[0.01] dark:bg-[#E6E8E6]/[0.01] p-3 rounded-xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 group/subtask">
                              {!block.isLocked && (
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveTaskInEngine(block.id, st.id, 'up', task.id)} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={stIdx === 0}><ChevronUp size={10} /></button>
                                    <button onClick={() => moveTaskInEngine(block.id, st.id, 'down', task.id)} className="text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent disabled:opacity-0" disabled={stIdx === (task.subTasks?.length || 0) - 1}><ChevronDown size={10} /></button>
                                </div>
                              )}
                              <div className="flex-1 flex flex-col min-w-0">
                                <input className="bg-transparent text-[11px] font-medium outline-none w-full text-[#18181B] dark:text-[#E6E8E6]" value={st.title} readOnly={block.isLocked} onChange={e => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: b.tasks.map(t => t.id === task.id ? { ...t, subTasks: (t.subTasks || []).map(s => s.id === st.id ? { ...s, title: e.target.value } : s) } : t) } : b) }))} />
                                {st.description && <p className="text-[8px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 truncate">{st.description}</p>}
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
                      ))}
                      {!block.isLocked && (
                        <button onClick={() => updateAppData(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, tasks: [...b.tasks, { id: generateId(), title: "Nouvelle tâche", completedDates: [], recurrence: 'daily', subTasks: [] }] } : b) }))} className="w-full py-3 border-2 border-dashed border-[#18181B]/5 dark:border-[#E6E8E6]/5 rounded-2xl text-[9px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase hover:text-accent transition-all">+ Ajouter Tâche</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
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
            <div className="glass p-8 rounded-[2.5rem] space-y-4 border border-accent/20 bg-accent/5">
              <div className="flex items-center gap-3"><div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center"><Archive className="text-accent" size={24} /></div><div><h2 className="font-black text-lg uppercase leading-tight text-[#18181B] dark:text-[#E6E8E6]">Boîte de tâches</h2><p className="text-[9px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase font-black">Capturer vos idées en un clin d'œil</p></div></div>
              <div className="space-y-1.5 pt-2"><div className="flex gap-2"><input className="flex-1 bg-white dark:bg-[#080708] p-4 rounded-2xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6]" placeholder="Ex : Appeler Paul demain 15h p1" value={newInboxTitle} onChange={e => setNewInboxTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addInboxTask()} /><button onClick={addInboxTask} className="p-4 bg-accent rounded-2xl text-white shadow-lg shadow-accent/20 active:scale-95 transition-all"><Plus size={20} /></button></div><p className="text-[9px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40 px-1">Reconnaît « demain », « lundi », « chaque mardi », « 15h30 », « p1/p2/p3 » automatiquement.</p></div>
            </div>
            <InboxView
              items={appData.inboxTasks || []}
              onChange={(newItems) => updateAppData(prev => ({ ...prev, inboxTasks: newItems }))}
              onTransfer={(task) => setTransferTask(task)}
              saveToHistory={saveToHistory}
            />
          </div>
        )}

        {/* ... (Existing Templates Tab) */}
        {/* TAB: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
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
                    <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50 leading-snug">{st.description}</p>
                    <button
                      onClick={() => {
                        const built = st.build();
                        updateAppData(prev => ({ ...prev, templates: [...(prev.templates || []), { id: generateId(), name: st.name, blocks: built.blocks, recurringGoals: built.recurringGoals, templateGoal: st.templateGoal }] }));
                        setActiveNotification(`Modèle « ${st.name} » ajouté à vos architectures`);
                        setTimeout(() => setActiveNotification(null), 3500);
                      }}
                      className="w-full py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 active:scale-95 transition-all"
                    >
                      Ajouter à mes modèles
                    </button>
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
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Titre */}
            <div className="px-2">
              <h1 className="text-2xl font-black text-[#18181B] dark:text-[#E6E8E6]">Analytics</h1>
              <p className="text-xs font-bold text-[#18181B]/50 dark:text-[#E6E8E6]/50 mt-1">Ta discipline, mesurée.</p>
            </div>
            <AnnualReview appData={appData} history={yearStats.history} />
            <div className="space-y-6">
                {/* Timeframe Selector with PDF Download */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex justify-center p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-[2rem] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 shadow-inner flex-1">{(['day', 'week', 'month', 'year', 'custom'] as TimeframeType[]).map((t) => (<button key={t} onClick={() => setStatsTimeframe(t)} className={`flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${statsTimeframe === t ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>{t === 'day' ? 'Auj.' : t === 'week' ? 'Sem.' : t === 'month' ? 'Mois' : t === 'year' ? 'Ann.' : 'Perso.'}</button>))}</div>
                    <button 
                      onClick={handleDownloadPDF} 
                      className="p-3 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-white hover:bg-accent transition-all flex items-center justify-center shadow-lg"
                      title="Télécharger le rapport mensuel PDF"
                    >
                      <FileText size={20} />
                    </button>
                </div>
                
                {statsTimeframe === 'custom' && (<div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2"><div className="space-y-1"><label className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase ml-2">Début</label><input type="date" value={customRange.start} onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-2xl text-xs font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none [color-scheme:dark] text-[#18181B] dark:text-[#E6E8E6]" /></div><div className="space-y-1"><label className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase ml-2">Fin</label><input type="date" value={customRange.end} onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))} className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-2xl text-xs font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none [color-scheme:dark] text-[#18181B] dark:text-[#E6E8E6]" /></div></div>)}

                {/* Global Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="glass p-5 rounded-[2rem] flex flex-col items-center justify-center space-y-2"><div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center"><TrendingUp size={20} className="text-accent" /></div><span className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6]">{statsData.avg}%</span><span className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest text-center leading-tight">Constance Moyenne</span></div><div className="glass p-5 rounded-[2rem] flex flex-col items-center justify-center space-y-2"><div className="w-10 h-10 bg-[#FDCA40]/10 rounded-xl flex items-center justify-center"><Flame size={20} className="text-[#FDCA40]" /></div><span className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6]">{gracedStreak} j</span><span className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest text-center leading-tight">Série Parfaite</span></div><div className="glass p-5 rounded-[2rem] flex flex-col items-center justify-center space-y-2"><div className="w-10 h-10 bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 rounded-xl flex items-center justify-center"><Trophy size={20} className="text-[#18181B] dark:text-[#E6E8E6]" /></div><span className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6]">{statsData.totalDoneCount}</span><span className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest text-center leading-tight">Succès Totaux</span></div><div className="glass p-5 rounded-[2rem] flex flex-col items-center justify-center space-y-2"><div className="w-10 h-10 bg-[#FDCA40]/10 rounded-xl flex items-center justify-center"><Star size={20} className="text-[#FDCA40]" /></div><span className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6]">{statsData.bestDay.val}%</span><span className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest text-center leading-tight">Record Période</span></div></div>

                {/* Heatmap — fenêtre pilotée par le sélecteur de période */}
                {(() => {
                  const winDays: Record<TimeframeType, number> = { day: 1, week: 7, month: 30, year: 365, custom: 30 };
                  const winTitle: Record<TimeframeType, string> = { day: "Aujourd'hui", week: '7 derniers jours', month: '30 derniers jours', year: '12 derniers mois', custom: 'Période perso.' };
                  return <YearHeatmap history={statsData.history} streakCount={yearStats.streakCount} days={winDays[statsTimeframe]} title={winTitle[statsTimeframe]} />;
                })()}

                {/* Global Performance Graph */}
                <div className="glass p-8 rounded-[3rem] space-y-4">
                    <div className="flex items-center justify-between mb-4"><p className="text-[10px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest px-2">Constance au fil des jours</p><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-accent" /><span className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase">Score %</span></div></div>
                    <div className="relative h-48 w-full overflow-hidden"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><AreaChart data={statsData.history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}><defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={accentHex} stopOpacity={0.3}/><stop offset="95%" stopColor={accentHex} stopOpacity={0}/></linearGradient></defs><Tooltip contentStyle={{ background: '#080708', border: '1px solid rgba(230, 232, 230, 0.1)', borderRadius: '1rem', fontSize: '10px', fontWeight: 'bold' }} itemStyle={{ color: accentHex }} /><Area type="monotone" dataKey="val" stroke={accentHex} strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" /></AreaChart></ResponsiveContainer></div>
                </div>

                {/* Succès + Humeur */}
                <Badges appData={appData} bestStreak={yearStats.streakCount} />
                <Insights history={statsData.history} days={appData.days} blockStats={statsData.sortedBlockStats} />
                <FocusStats sessions={appData.focusSessions || []} />
                <HabitStreaks blocks={routineBlocks} />
                <WeeklyReview
                  weekKey={currentWeekKey}
                  review={appData.weeklyReviews?.[currentWeekKey]}
                  stats={weekReviewStats}
                  onSave={(r) => updateAppData(prev => ({ ...prev, weeklyReviews: { ...(prev.weeklyReviews || {}), [r.weekKey]: r } }))}
                  onGenerate={async (summary) => {
                    const res = await getDailyReviewFeedback([], weekReviewStats.avg, summary);
                    return res ? { feedback: res.feedback, focusNextWeek: res.focusTomorrow } : null;
                  }}
                />
                <MoodPerfChart days={appData.days} history={statsData.history} />

                {/* NEW: Block Validation Graph */}
                <div className="glass p-8 rounded-[3rem] space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase tracking-widest px-2">Constance des Blocs (Validés à 100%)</p>
                    </div>
                    <div className="relative h-48 w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={statsData.dailyBlockHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <Tooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white dark:bg-[#080708] border border-[#18181B]/10 dark:border-[#E6E8E6]/10 p-3 rounded-xl shadow-xl">
                                                    <p className="text-[10px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase mb-1">{payload[0].payload.name}</p>
                                                    <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{payload[0].value} / {payload[0].payload.total} Blocs</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="validated" fill={accentHex} radius={[4, 4, 4, 4]} barSize={8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* NEW: Block Habits & Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass p-6 rounded-[2.5rem] space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Layout size={16} className="text-accent" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-[#18181B] dark:text-[#E6E8E6]">Habitudes de Blocs</h3>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                            {statsData.sortedBlockStats.length === 0 ? (
                                <p className="text-[10px] text-[#18181B]/40 dark:text-[#E6E8E6]/40 italic">Aucune donnée de bloc disponible.</p>
                            ) : (
                                statsData.sortedBlockStats.map((stat, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-[#18181B] dark:text-[#E6E8E6]">
                                            <span>{stat.title}</span>
                                            <span className={`${stat.rate >= 80 ? 'text-accent' : stat.rate >= 50 ? 'text-[#FDCA40]' : 'text-[#18181B]/40 dark:text-[#E6E8E6]/40'}`}>{stat.rate}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${stat.rate >= 80 ? 'bg-accent' : stat.rate >= 50 ? 'bg-[#FDCA40]' : 'bg-[#18181B]/20 dark:bg-[#E6E8E6]/20'}`} 
                                                style={{ width: `${stat.rate}%` }} 
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {statsData.sortedBlockStats.length > 0 && statsData.sortedBlockStats[0].rate > 0 && (
                            <div className="flex-1 glass p-5 rounded-[2rem] flex items-center gap-4 bg-accent/5 border border-accent/20">
                                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Trophy size={20} className="text-accent" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Point Fort</p>
                                    <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{statsData.sortedBlockStats[0].title}</p>
                                    <p className="text-[9px] text-accent font-medium mt-0.5">Validé {statsData.sortedBlockStats[0].fullyValidated} fois</p>
                                </div>
                            </div>
                        )}
                        {statsData.sortedBlockStats.length > 0 && statsData.sortedBlockStats[statsData.sortedBlockStats.length - 1].rate < 50 && (
                            <div className="flex-1 glass p-5 rounded-[2rem] flex items-center gap-4 bg-[#FDCA40]/5 border border-[#FDCA40]/20">
                                <div className="w-10 h-10 bg-[#FDCA40]/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Target size={20} className="text-[#FDCA40]" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase tracking-widest">Zone d'effort</p>
                                    <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{statsData.sortedBlockStats[statsData.sortedBlockStats.length - 1].title}</p>
                                    <p className="text-[9px] text-[#FDCA40] font-medium mt-0.5">Simplifiez ce bloc ?</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* ... (Existing Caddr AI Tab) */}
        {activeTab === 'ai' && (
           <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-20">
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

              {/* Thème d'accent */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Couleur d'accent</label>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(THEMES) as AccentTheme[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setAccentTheme(key)}
                      title={THEMES[key].label}
                      className={`flex flex-col items-center gap-1.5 transition-all ${accentTheme === key ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <span
                        className={`w-10 h-10 rounded-2xl border-2 transition-all ${accentTheme === key ? 'border-[#18181B] dark:border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: THEMES[key].hex }}
                      />
                      <span className="text-[8px] font-black uppercase tracking-wider">{THEMES[key].label}</span>
                    </button>
                  ))}
                </div>
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
                <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] text-[10px] font-black uppercase tracking-widest"><User size={14} /> Se connecter avec Google</button>
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
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#F4F4F5]/90 dark:bg-[#080708]/90 backdrop-blur-3xl border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 pb-10 pt-4 px-4 overflow-x-auto custom-scrollbar transition-colors duration-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 min-w-max px-4">
          {[
            { id: 'routine', icon: Layout, label: 'Routine' },
            { id: 'schedule', icon: CalendarDays, label: 'Planning' },
            { id: 'inbox', icon: Archive, label: 'Boîte' },
            { id: 'ai', icon: BrainCircuit, label: 'Caddr. IA' },
            { id: 'templates', icon: Copy, label: 'Modèles' },
            { id: 'stats', icon: BarChart3, label: 'Analytics' },
            { id: 'settings', icon: Settings2, label: 'Réglages' }
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabType); setIsReorderMode(false); }} className={`flex flex-col items-center gap-2 transition-all px-2 ${activeTab === tab.id ? 'text-accent scale-110' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

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
          onComplete={handleFocusComplete}
          onClose={() => setFocusTarget(null)}
        />
      )}

      {showLevelUpModal && (
        <div className="fixed inset-0 z-[200] bg-[#080708]/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-50 duration-500">
           <div className="glass w-full max-w-sm p-10 rounded-[3.5rem] shadow-[0_0_50px_rgba(47, 176, 166,0.3)] border border-accent/30 relative overflow-hidden group text-center space-y-6">
              {/* Confetti / Rays effect bg */}
              <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 via-transparent to-[#FDCA40]/20 animate-pulse" />
              
              <div className="relative z-10">
                 <div className="w-24 h-24 bg-gradient-to-tr from-accent to-[#FDCA40] rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3 group-hover:rotate-6 transition-transform duration-500">
                    <Crown size={48} className="text-white drop-shadow-md" />
                 </div>
                 <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-1">Niveau Supérieur !</h2>
                 <p className="text-xs font-bold text-[#FDCA40] uppercase tracking-widest">Vous êtes passé niveau {showLevelUpModal}</p>
                 
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
        <div className="fixed inset-0 z-[110] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="glass w-full max-w-sm p-10 rounded-[3rem] space-y-6">
              <div className="text-center">
                 <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="text-accent" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Journal de bord</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4 mt-2">"{logModal.task.title}"</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Notes d'exécution</p>
                 <textarea 
                    className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-xs font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] h-32 resize-none"
                    placeholder="Comment s'est passée cette tâche ? Détails, obstacles, réussites..."
                    value={currentLogText}
                    onChange={(e) => setCurrentLogText(e.target.value)}
                    autoFocus
                 />
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
      )}

      {/* ... (Existing Modals kept same) */}
      {configModal && (
        <div className="fixed inset-0 z-[100] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
          <div className="glass w-full max-w-sm p-10 rounded-[4rem] space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="text-center"><h3 className="font-black uppercase text-sm tracking-widest italic text-[#18181B] dark:text-[#E6E8E6]">Configuration</h3></div>
            
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
                  <textarea 
                    className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-xs font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] h-24 resize-none"
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
                    onChange={(e) => updateConfiguredItem('description', e.target.value)}
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
                      {[ { id: 'daily', label: 'Quotidien' }, { id: 'weekdays', label: 'Semaine (L-V)' }, { id: 'weekends', label: 'Week-end' }, { id: 'week', label: 'Cette semaine' }, { id: 'month', label: 'Ce mois' }, { id: 'period', label: 'Période personnalisée' }, { id: 'specific', label: 'Date précise' } ].map(opt => (<button key={opt.id} onClick={() => { 
                          if (configModal.type === 'goal') {
                              updateAppData(prev => ({
                                  ...prev,
                                  recurringGoals: prev.recurringGoals.map(g => g.id === configModal.id ? { 
                                      ...g, 
                                      recurrence: opt.id as any,
                                      specificDate: opt.id === 'specific' ? dateKey : g.specificDate,
                                      startDate: opt.id === 'period' ? dateKey : g.startDate,
                                      endDate: opt.id === 'period' ? dateKey : g.endDate
                                  } : g)
                              }));
                          } else {
                              updateConfiguredItem('recurrence', opt.id);
                              // Smart Defaults for better UX
                              if (opt.id === 'specific') updateConfiguredItem('specificDate', dateKey);
                              if (opt.id === 'period') {
                                  updateConfiguredItem('startDate', dateKey);
                                  updateConfiguredItem('endDate', dateKey);
                              }
                          }
                      }} className="p-5 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl font-black text-xs uppercase hover:bg-accent/20 border border-transparent transition-all text-[#18181B] dark:text-[#E6E8E6]" > {opt.label} </button>))}
                    </div>

                    {configItem && configItem.recurrence === 'specific' && (
                        <div className="animate-in slide-in-from-top-2 mt-2">
                           <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Date précise</p>
                           <input 
                              type="date" 
                              className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                              value={configItem.specificDate || ''} 
                              onChange={(e) => updateConfiguredItem('specificDate', e.target.value)}
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
                                  onChange={(e) => updateConfiguredItem('startDate', e.target.value)}
                              />
                           </div>
                           <div>
                              <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2 mb-1">Fin</p>
                              <input 
                                  type="date" 
                                  className="w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-4 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent transition-all text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]" 
                                  value={configItem.endDate || ''} 
                                  onChange={(e) => updateConfiguredItem('endDate', e.target.value)}
                              />
                           </div>
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
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-[110] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="glass w-full max-w-sm p-10 rounded-[3rem] space-y-6">
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

      {transferTask && (
        <div className="fixed inset-0 z-[120] bg-[#F4F4F5]/95 dark:bg-[#080708]/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="glass w-full max-sm p-10 rounded-[3.5rem] space-y-6">
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Send className="text-accent" size={24} />
                 </div>
                 <h3 className="text-xl font-black uppercase text-[#18181B] dark:text-[#E6E8E6]">Déployer la tâche</h3>
                 <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-bold uppercase tracking-widest italic px-4">"{transferTask.title}"</p>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                 <p className="text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 uppercase px-2">Choisir un bloc de routine</p>
                 {appData.blocks.map(block => (
                   <button 
                     key={block.id}
                     onClick={() => deployInboxTask(block.id)}
                     className="w-full flex items-center gap-3 p-4 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:bg-accent/20 rounded-2xl border border-transparent hover:border-accent/50 transition-all text-left"
                   >
                      <Circle size={8} className="text-accent fill-accent" />
                      <span className="text-xs font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6]">{block.title}</span>
                   </button>
                 ))}
                 {appData.blocks.length === 0 && <p className="text-[10px] text-[#18181B]/60 dark:text-[#E6E8E6]/60 italic text-center py-4">Aucun bloc configuré dans le planning.</p>}
              </div>
              <button onClick={() => setTransferTask(null)} className="w-full py-4 text-[#18181B]/60 dark:text-[#E6E8E6]/60 font-black uppercase text-[10px] tracking-widest">Annuler</button>
           </div>
        </div>
      )}

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
                 <textarea 
                   className="w-full bg-[#18181B]/5 dark:bg-[#080708]/50 p-6 rounded-[2rem] text-sm font-semibold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent h-32 transition-all text-[#18181B] dark:text-[#E6E8E6]"
                   placeholder="Qu'avez-vous appris aujourd'hui ? Qu'allez-vous améliorer ?"
                   value={currentDayData.reflection || ""}
                   onChange={e => updateAppData(prev => ({ ...prev, days: { ...prev.days, [dateKey]: { ...currentDayData, reflection: e.target.value } } }))}
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
          <div className="glass w-full max-w-sm p-10 rounded-[3rem] space-y-6 shadow-2xl border border-[#FDCA40]/20">
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
