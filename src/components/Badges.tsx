import React, { useMemo } from 'react';
import { AppData, Task } from '../types';

interface Props {
  appData: AppData;
  bestStreak: number;
}

interface Badge {
  emoji: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

const countCompletions = (tasks: Task[]): number =>
  tasks.reduce(
    (sum, t) => sum + (t.completedDates?.length || 0) + countCompletions(t.subTasks || []),
    0
  );

// Système de succès : tout est calculé à partir des données existantes.
const Badges: React.FC<Props> = ({ appData, bestStreak }) => {
  const badges = useMemo<Badge[]>(() => {
    // Complétions : blocs maîtres + journées détachées
    let totalDone = countCompletions(appData.blocks.flatMap((b) => b.tasks));
    (Object.values(appData.days) as import('../types').DayRoutine[]).forEach((day) => {
      if (day.blocks) totalDone += countCompletions(day.blocks.flatMap((b) => b.tasks));
    });

    const dayList = Object.values(appData.days) as import('../types').DayRoutine[];
    const reviewsCount = dayList.filter((d) => d.reflection).length;
    const goalsDone = dayList.filter((d) => d.goalCompleted).length;
    const level = appData.userProfile?.level || 1;
    const templatesCount = appData.templates.length;

    return [
      { emoji: '🌱', name: 'Premier pas', desc: '1 tâche complétée', unlocked: totalDone >= 1 },
      { emoji: '⚡', name: 'Lancé', desc: '25 tâches complétées', unlocked: totalDone >= 25 },
      { emoji: '💯', name: 'Centurion', desc: '100 tâches complétées', unlocked: totalDone >= 100 },
      { emoji: '🚀', name: 'Machine', desc: '500 tâches complétées', unlocked: totalDone >= 500 },
      { emoji: '🔥', name: 'Étincelle', desc: 'Série de 3 jours à 100%', unlocked: bestStreak >= 3 },
      { emoji: '🌋', name: 'Enflammé', desc: 'Série de 7 jours à 100%', unlocked: bestStreak >= 7 },
      { emoji: '☄️', name: 'Inarrêtable', desc: 'Série de 30 jours à 100%', unlocked: bestStreak >= 30 },
      { emoji: '📓', name: 'Introspectif', desc: '5 bilans du soir rédigés', unlocked: reviewsCount >= 5 },
      { emoji: '🧘', name: 'Sage', desc: '30 bilans du soir rédigés', unlocked: reviewsCount >= 30 },
      { emoji: '🎯', name: 'Viseur', desc: '10 objectifs du jour atteints', unlocked: goalsDone >= 10 },
      { emoji: '🏗️', name: 'Architecte', desc: 'Créer un modèle de routine', unlocked: templatesCount >= 1 },
      { emoji: '⭐', name: 'Étoile montante', desc: 'Atteindre le niveau 5', unlocked: level >= 5 },
      { emoji: '👑', name: 'Élite', desc: 'Atteindre le niveau 10', unlocked: level >= 10 },
      { emoji: '🏆', name: 'Légende', desc: 'Atteindre le niveau 20', unlocked: level >= 20 },
    ];
  }, [appData, bestStreak]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="glass p-6 rounded-[2rem] space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase tracking-wider text-sm">Succès</h2>
        <span className="text-[10px] font-black uppercase tracking-wider text-[#3772FF]">
          {unlockedCount}/{badges.length} débloqués
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {badges.map((b) => (
          <div
            key={b.name}
            title={`${b.name} — ${b.desc}`}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
              b.unlocked
                ? 'bg-[#3772FF]/10 border-[#3772FF]/20'
                : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl">{b.emoji}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight">
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Badges;
