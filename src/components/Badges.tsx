import React, { useMemo } from 'react';
import {
  Check, Zap, Award, TrendingUp, Flame, BookOpen,
  Sparkles, Target, LayoutTemplate, Star, Crown, Trophy, LucideIcon,
} from 'lucide-react';
import { AppData, Task, DayRoutine } from '../types';

interface Props {
  appData: AppData;
  bestStreak: number;
}

interface Badge {
  Icon: LucideIcon;
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
    let totalDone = countCompletions(appData.blocks.flatMap((b) => b.tasks));
    (Object.values(appData.days) as DayRoutine[]).forEach((day) => {
      if (day.blocks) totalDone += countCompletions(day.blocks.flatMap((b) => b.tasks));
    });

    const dayList = Object.values(appData.days) as DayRoutine[];
    const reviewsCount = dayList.filter((d) => d.reflection).length;
    const goalsDone = dayList.filter((d) => d.goalCompleted).length;
    const level = appData.userProfile?.level || 1;
    const templatesCount = appData.templates.length;

    return [
      { Icon: Check, name: 'Premier pas', desc: '1 tâche complétée', unlocked: totalDone >= 1 },
      { Icon: Zap, name: 'Lancé', desc: '25 tâches complétées', unlocked: totalDone >= 25 },
      { Icon: Award, name: 'Centurion', desc: '100 tâches complétées', unlocked: totalDone >= 100 },
      { Icon: TrendingUp, name: 'Machine', desc: '500 tâches complétées', unlocked: totalDone >= 500 },
      { Icon: Flame, name: 'Étincelle', desc: 'Série de 3 jours à 100%', unlocked: bestStreak >= 3 },
      { Icon: Flame, name: 'Enflammé', desc: 'Série de 7 jours à 100%', unlocked: bestStreak >= 7 },
      { Icon: Flame, name: 'Inarrêtable', desc: 'Série de 30 jours à 100%', unlocked: bestStreak >= 30 },
      { Icon: BookOpen, name: 'Introspectif', desc: '5 bilans du soir rédigés', unlocked: reviewsCount >= 5 },
      { Icon: Sparkles, name: 'Sage', desc: '30 bilans du soir rédigés', unlocked: reviewsCount >= 30 },
      { Icon: Target, name: 'Viseur', desc: '10 objectifs du jour atteints', unlocked: goalsDone >= 10 },
      { Icon: LayoutTemplate, name: 'Architecte', desc: 'Créer un modèle de routine', unlocked: templatesCount >= 1 },
      { Icon: Star, name: 'Étoile montante', desc: 'Atteindre le niveau 5', unlocked: level >= 5 },
      { Icon: Crown, name: 'Élite', desc: 'Atteindre le niveau 10', unlocked: level >= 10 },
      { Icon: Trophy, name: 'Légende', desc: 'Atteindre le niveau 20', unlocked: level >= 20 },
    ];
  }, [appData, bestStreak]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="glass p-6 rounded-[2rem] space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase tracking-wider text-sm">Succès</h2>
        <span className="text-[10px] font-black uppercase tracking-wider text-accent">
          {unlockedCount}/{badges.length} débloqués
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {badges.map(({ Icon, name, desc, unlocked }) => (
          <div
            key={name}
            title={`${name} — ${desc}`}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
              unlocked
                ? 'bg-accent/10 border-accent/20'
                : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent opacity-40'
            }`}
          >
            <Icon
              size={22}
              strokeWidth={2}
              className={unlocked ? 'text-accent' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}
            />
            <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Badges;
