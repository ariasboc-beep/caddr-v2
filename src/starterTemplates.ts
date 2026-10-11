import { Block, RecurringGoal } from './types';
import { generateId } from './utils';

export interface StarterTemplate {
  key: string;
  name: string;
  emoji: string;
  description: string;
  templateGoal?: string;
  periodDays?: number; // durée suggérée quand le modèle est temporaire (ex. semaine d'examen)
  build: () => { blocks: Block[]; recurringGoals: RecurringGoal[] };
}

const task = (title: string, startTime?: string, duration?: number) => ({
  id: generateId(), title, completedDates: [], recurrence: 'daily' as const, subTasks: [], startTime, duration,
});
const block = (title: string, tasks: ReturnType<typeof task>[], recurrence: 'daily' | 'weekdays' | 'weekends' = 'daily') => ({
  id: generateId(), title, tasks, recurrence,
});

// Bibliothèque de routines prêtes à l'emploi (démarrage en 30 secondes).
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'morning',
    name: 'Matinée puissante',
    emoji: '🌅',
    description: 'Réveil sans snooze, hydratation, mouvement et intention avant 9h.',
    templateGoal: 'Bien démarrer chaque journée',
    build: () => ({
      blocks: [
        block('Matin', [
          task('Réveil sans snooze', '06:30'),
          task('Grand verre d\'eau', '06:35', 5),
          task('Mouvement / étirements', '06:45', 15),
          task('Douche froide', '07:05', 5),
          task('Intention du jour', '07:15', 5),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'deepwork',
    name: 'Deep Work',
    emoji: '🎯',
    description: 'Deux blocs de concentration profonde avec pauses, sans distraction.',
    templateGoal: 'Produire un travail de qualité',
    build: () => ({
      blocks: [
        block('Travail profond', [
          task('Bloc focus #1', '09:00', 90),
          task('Pause active', '10:30', 15),
          task('Bloc focus #2', '10:45', 90),
          task('Traiter la boîte mail', '13:30', 30),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'evening',
    name: 'Coucher réparateur',
    emoji: '🌙',
    description: 'Décrochage des écrans, lecture, gratitude et heure de coucher fixe.',
    templateGoal: 'Un sommeil de qualité',
    build: () => ({
      blocks: [
        block('Soir', [
          task('Fin des écrans', '21:30'),
          task('Préparer le lendemain', '21:40', 10),
          task('Lecture', '21:50', 20),
          task('Gratitude (3 choses)', '22:10', 5),
          task('Extinction des lumières', '22:30'),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'fitness',
    name: 'Forme & santé',
    emoji: '💪',
    description: 'Mouvement quotidien, nutrition et hydratation suivis.',
    templateGoal: 'Un corps en forme',
    build: () => ({
      blocks: [
        block('Santé', [
          task('Séance de sport', '07:30', 45),
          task('Petit-déjeuner protéiné', '08:30', 20),
          task('10 000 pas', '18:00', 60),
          task('Hydratation (2L)', '20:00'),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'workday',
    name: 'Journée de travail efficace',
    emoji: '💼',
    description: 'Les 3 priorités d’abord, deux blocs de concentration, mails regroupés et clôture propre.',
    templateGoal: 'Avancer sur ce qui compte vraiment',
    build: () => ({
      blocks: [
        block('Travail', [
          task('Choisir mes 3 priorités du jour', '08:00', 10),
          task('Bloc de concentration n°1 (sans notifications)', '08:15', 90),
          task('Mails et messages (regroupés)', '10:00', 30),
          task('Bloc de concentration n°2', '14:00', 90),
          task('Mails et messages (regroupés)', '16:00', 30),
          task('Clôture : bilan et liste de demain', '17:15', 15),
        ], 'weekdays'),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'exams',
    name: 'Semaine d’examen / de révision',
    emoji: '📚',
    description: 'Sessions de révision espacées, pauses actives, sommeil protégé. À appliquer sur une période.',
    templateGoal: 'Réussir mon examen',
    periodDays: 14,
    build: () => ({
      blocks: [
        block('Révisions', [
          task('Révision 1 (technique Pomodoro)', '08:30', 100),
          task('Pause active / marche', '10:10', 15),
          task('Révision 2 : exercices et annales', '10:30', 90),
          task('Révision 3 : fiches et récapitulatif', '15:00', 90),
          task('Auto-interrogation (flashcards)', '18:00', 30),
          task('Coucher avant 23 h', '22:45'),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'comeback',
    name: 'Retour de vacances en douceur',
    emoji: '🌴',
    description: 'Une semaine pour reprendre le rythme sans se surcharger : tri, petites victoires, routine réduite.',
    templateGoal: 'Reprendre le rythme sereinement',
    periodDays: 7,
    build: () => ({
      blocks: [
        block('Reprise', [
          task('Réveil à heure fixe', '07:00'),
          task('Trier mails et messages (30 min max)', '09:00', 30),
          task('Une seule tâche importante', '09:45', 60),
          task('Marche ou sport léger', '18:00', 30),
          task('Préparer demain', '21:00', 10),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'weekend',
    name: 'Week-end ressourçant',
    emoji: '🌿',
    description: 'Repos, liens, nature et préparation de la semaine, sans culpabilité.',
    templateGoal: 'Recharger les batteries',
    build: () => ({
      blocks: [
        block('Week-end', [
          task('Grasse matinée raisonnable', '08:30'),
          task('Activité dehors / nature', '10:00', 90),
          task('Temps avec mes proches', '16:00', 120),
          task('Planifier ma semaine', '19:00', 20),
        ], 'weekends'),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'digital',
    name: 'Soirée sans écrans',
    emoji: '📵',
    description: 'Couper les écrans le soir pour mieux dormir et retrouver du temps pour soi.',
    templateGoal: 'Mieux dormir',
    build: () => ({
      blocks: [
        block('Soirée', [
          task('Téléphone en mode avion', '21:00'),
          task('Lecture papier', '21:15', 30),
          task('Journal : gratitude et fierté', '21:50', 10),
          task('Coucher', '22:30'),
        ]),
      ],
      recurringGoals: [],
    }),
  },
  {
    key: 'project',
    name: 'Grand projet / préparation d’audit',
    emoji: '🎯',
    description: 'Un créneau quotidien protégé, une revue hebdomadaire et un point d’avancement. À appliquer sur une période.',
    templateGoal: 'Livrer le projet dans les temps',
    periodDays: 30,
    build: () => ({
      blocks: [
        block('Projet', [
          task('Créneau protégé sur le projet', '08:00', 90),
          task('Noter l’avancement et les blocages', '17:00', 10),
        ], 'weekdays'),
      ],
      recurringGoals: [],
    }),
  },
];
