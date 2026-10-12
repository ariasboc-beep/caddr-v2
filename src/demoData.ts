// Données d'exemple pour la version de démonstration (artefact) : jamais utilisées en production.
import type { AppData, Block, Task, StandaloneHabit, JournalEntry } from './types';
import { getKeyFromDate } from './utils';
import { getWeekKey } from './streaks';

export function demoData(): AppData {
  let x = 11; const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const key = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return getKeyFromDate(d); };
  const t = (id: string, title: string, rec: Task['recurrence'], o: Partial<Task> = {}): Task => ({ id, title, completedDates: [], recurrence: rec, subTasks: [], ...o });

  const blocks: Block[] = [
    { id: 'matin', title: 'Matin', recurrence: 'daily', isCollapsed: false, tasks: [
      t('m1', 'Méditation', 'daily', { startTime: '06:00', duration: 10, isHabit: true }),
      t('m2', 'Sport 30 min', 'weekdays', { startTime: '06:15', duration: 30, priority: 'high', isHabit: true }),
      t('m3', 'Lecture (10 pages)', 'daily', { startTime: '06:50', duration: 20 }),
    ] },
    { id: 'travail', title: 'Travail', recurrence: 'weekdays', isCollapsed: false, tasks: [
      t('w1', 'Choisir mes 3 priorités', 'weekdays', { startTime: '08:00', duration: 10 }),
      t('w2', 'Bloc de concentration', 'weekdays', { startTime: '08:15', duration: 90, priority: 'high' }),
      t('w3', 'Tournée terrain et inspections', 'weekdays', { startTime: '10:30', duration: 60 }),
      t('w4', 'Mails regroupés', 'weekdays', { startTime: '16:00', duration: 30, priority: 'low' }),
      t('w5', 'Rédiger la procédure de pesage', 'specific', { specificDate: key(0), startTime: '14:00', duration: 90, priority: 'high' }),
      t('w6', 'Préparer le comité de pilotage', 'specific', { specificDate: key(1), startTime: '11:00', duration: 60 }),
      t('w7', 'Envoyer le rapport mensuel', 'specific', { specificDate: key(-1) }),
    ] },
    { id: 'soir', title: 'Soir', recurrence: 'daily', isCollapsed: false, tasks: [
      t('s1', 'Anglais : shadowing 15 min', 'daily', { startTime: '20:30', duration: 15, isHabit: true }),
      t('s2', 'Préparer demain', 'daily', { startTime: '21:00', duration: 10 }),
      t('s3', 'Pas d’écran après 22 h', 'daily'),
    ] },
  ];
  const probs: Record<string, number> = { m1: .85, m2: .65, m3: .55, w1: .8, w2: .7, w3: .75, w4: .6, s1: .6, s2: .7, s3: .45 };
  const all = blocks.flatMap(b => b.tasks);
  for (let i = 60; i >= 1; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i); const k = getKeyFromDate(d); const dow = d.getDay();
    all.forEach(task => {
      if (!probs[task.id]) return;
      if ((task.recurrence === 'weekdays') && (dow === 0 || dow === 6)) return;
      if (rnd() < probs[task.id] + (i < 20 ? 0.08 : 0)) {
        task.completedDates.push(k);
        if (task.startTime && rnd() < 0.8) { const [h, m] = task.startTime.split(':').map(Number); const done = h * 60 + m + (task.duration || 30) + Math.round(rnd() * 40 - 10); task.completedAt = { ...(task.completedAt || {}), [k]: `${String(Math.floor(done / 60)).padStart(2, '0')}:${String(done % 60).padStart(2, '0')}` }; }
      }
    });
  }
  // Aujourd'hui : la matinée est faite
  ['m1', 'm3'].forEach(id => all.find(a => a.id === id)!.completedDates.push(key(0)));

  const habit = (id: string, name: string, kind: 'build' | 'quit', color: string, p: number): StandaloneHabit => {
    const entries: StandaloneHabit['entries'] = {};
    for (let i = 40; i >= 1; i--) entries[key(-i)] = { s: rnd() < p ? 'done' : 'fail' };
    return { id, name, kind, color, startDate: key(-40), createdAt: new Date().toISOString(), showInRoutine: true, entries };
  };
  const journal: { [k: string]: JournalEntry } = {};
  const G = ['Ma famille en bonne santé', 'Un appel de ma mère', 'Le calme du matin', 'Une équipe motivée', 'Un bon repas partagé', 'La pluie qui rafraîchit'];
  const P = ['J’ai tenu mon sport malgré la fatigue', 'Audit fournisseur bouclé', 'Je suis restée calme en réunion', 'Procédure envoyée à temps', 'J’ai dit non à une demande non prioritaire'];
  for (let i = 9; i >= 1; i--) if (rnd() < 0.8) journal[key(-i)] = { gratitude: [G[i % 6], G[(i + 2) % 6], ''], pride: [P[i % 5], P[(i + 3) % 5], ''], updatedAt: new Date().toISOString() };

  return {
    days: {}, blocks, templates: [], inboxTasks: [
      { id: 'i1', title: 'Commander des EPI pour l’atelier', completedDates: [], recurrence: 'once', subTasks: [], deadline: key(2) },
      { id: 'i2', title: 'Idée : formation incendie pour les nouveaux', completedDates: [], recurrence: 'once', subTasks: [] },
      { id: 'i3', title: 'Renouveler mon passeport', completedDates: [], recurrence: 'once', subTasks: [] },
    ],
    recurringGoals: [{ id: 'rg1', title: 'Finaliser le manuel qualité', recurrence: 'week', startDate: key(-((today.getDay() + 6) % 7)), endDate: key(6 - ((today.getDay() + 6) % 7)) }],
    userProfile: { xp: 3800, level: 9 },
    longTermGoals: [
      { id: 'g1', title: 'Certification ISO 9001', progress: 0, createdAt: new Date(today.getTime() - 40 * 86400000).toISOString(), targetDate: key(80), autoProgress: true, linkedBlocks: ['Travail'],
        milestones: [{ id: 'ms1', title: 'Cartographie des processus', date: key(-10), done: true }, { id: 'ms2', title: 'Revue documentaire terminée', date: key(25) }, { id: 'ms3', title: 'Audit à blanc', date: key(60) }] },
      { id: 'g2', title: 'Parler anglais avec aisance', progress: 0, createdAt: new Date(today.getTime() - 30 * 86400000).toISOString(), targetDate: key(240), autoProgress: true, linkedTasks: ['s1'] },
    ],
    weeklyReviews: { [getWeekKey(new Date(today.getTime() - 7 * 86400000))]: { weekKey: getWeekKey(new Date(today.getTime() - 7 * 86400000)), wins: 'Sport tenu 4 jours sur 5', improve: 'Moins de mails le matin', createdAt: new Date().toISOString() } },
    projects: [
      {
        id: 'p1', title: 'Certification ISO 22000 de l’usine', why: 'Ouvrir les marchés à l’export et rassurer nos clients',
        status: 'active', createdAt: new Date(today.getTime() - 35 * 86400000).toISOString(), startDate: key(-35), dueDate: key(70),
        goalId: 'g1', color: '',
        steps: [
          { id: 'p1s1', title: 'Diagnostic et périmètre', order: 0 },
          { id: 'p1s2', title: 'Documentation du système', order: 1 },
          { id: 'p1s3', title: 'Audit à blanc', order: 2 },
        ],
        tasks: [
          { id: 'p1t1', title: 'Cartographier les dangers par atelier', stepId: 'p1s1', done: true, doneAt: `${key(-28)}T10:30`, createdAt: new Date().toISOString(), order: 0, estimateMin: 180 },
          { id: 'p1t2', title: 'Constituer l’équipe HACCP', stepId: 'p1s1', done: true, doneAt: `${key(-21)}T09:00`, createdAt: new Date().toISOString(), order: 1, estimateMin: 60 },
          { id: 'p1t3', title: 'Rédiger le manuel de sécurité des aliments', stepId: 'p1s2', due: key(12), estimateMin: 300, priority: 'high', createdAt: new Date().toISOString(), order: 2 },
          { id: 'p1t4', title: 'Mettre à jour les 12 instructions de nettoyage', stepId: 'p1s2', due: key(20), estimateMin: 240, createdAt: new Date().toISOString(), order: 3 },
          { id: 'p1t5', title: 'Former les chefs d’équipe aux PRP', stepId: 'p1s2', due: key(30), estimateMin: 120, createdAt: new Date().toISOString(), order: 4 },
          { id: 'p1t6', title: 'Planifier l’audit à blanc avec le cabinet', stepId: 'p1s3', due: key(45), estimateMin: 45, createdAt: new Date().toISOString(), order: 5 },
        ],
      },
      {
        id: 'p2', title: 'Lancer la gamme épices Goût Unik', why: 'Une deuxième source de revenus, et un produit dont je suis fière',
        status: 'active', createdAt: new Date(today.getTime() - 14 * 86400000).toISOString(), startDate: key(-14), dueDate: key(25), color: '#FDCA40',
        steps: [{ id: 'p2s1', title: 'Produit', order: 0 }, { id: 'p2s2', title: 'Mise sur le marché', order: 1 }],
        tasks: [
          { id: 'p2t1', title: 'Figer les trois recettes', stepId: 'p2s1', done: true, doneAt: `${key(-9)}T18:00`, createdAt: new Date().toISOString(), order: 0 },
          { id: 'p2t2', title: 'Valider l’étiquetage réglementaire', stepId: 'p2s1', due: key(-2), estimateMin: 90, priority: 'high', createdAt: new Date().toISOString(), order: 1 },
          { id: 'p2t3', title: 'Devis pour 500 sachets', stepId: 'p2s2', due: key(6), estimateMin: 45, createdAt: new Date().toISOString(), order: 2 },
          { id: 'p2t4', title: 'Séance photo des produits', stepId: 'p2s2', due: key(14), estimateMin: 180, createdAt: new Date().toISOString(), order: 3 },
        ],
      },
    ],
    habits: [habit('h1', 'Boire 2 L d’eau', 'build', '', .7), habit('h2', 'Pas de sucre ajouté', 'quit', '#FDCA40', .75), (() => {
      // Habitude à durée limitée : défi de 30 jours commencé il y a 20 jours
      const h = habit('h3', 'Défi 30 jours : marcher 30 min', 'build', '', .8);
      Object.keys(h.entries).forEach(k => { if (k < key(-20)) delete h.entries[k]; });
      return { ...h, startDate: key(-20), endDate: key(9) };
    })()],
    journal,
    assistantMemory: [{ id: 'am1', text: 'Pas de travail après 21 h', createdAt: new Date().toISOString() }, { id: 'am2', text: 'Sport le matin avant 7 h', createdAt: new Date().toISOString() }],
    lifeReviews: {},
    focusSessions: [
      { id: 'f1', taskId: 'w2', taskTitle: 'Bloc de concentration', date: key(-3), durationMin: 90, actualMin: 110, completedInTime: false },
      { id: 'f2', taskId: 'w2', taskTitle: 'Bloc de concentration', date: key(-2), durationMin: 90, actualMin: 95, completedInTime: true },
      { id: 'f3', taskId: 'm3', taskTitle: 'Lecture (10 pages)', date: key(-1), durationMin: 20, actualMin: 18, completedInTime: true },
    ],
    skips: [],
    settings: { headerBar: 'discipline', briefingHiddenOn: undefined },
  };
}
