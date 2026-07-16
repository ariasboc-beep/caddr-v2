import { Block, RecurringGoal } from './types';
import { generateId } from './utils';

export interface StarterTemplate {
  key: string;
  name: string;
  emoji: string;
  description: string;
  templateGoal?: string;
  build: () => { blocks: Block[]; recurringGoals: RecurringGoal[] };
}

const task = (title: string, startTime?: string, duration?: number) => ({
  id: generateId(), title, completedDates: [], recurrence: 'daily' as const, subTasks: [], startTime, duration,
});
const block = (title: string, tasks: ReturnType<typeof task>[]) => ({
  id: generateId(), title, tasks, recurrence: 'daily' as const,
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
];
