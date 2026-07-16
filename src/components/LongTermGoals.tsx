import React, { useState } from 'react';
import { Target, Plus, Trash2, CalendarClock, Flag } from 'lucide-react';
import { LongTermGoal } from '../types';
import { generateId } from '../utils';

interface Props {
  goals: LongTermGoal[];
  onChange: (goals: LongTermGoal[]) => void;
}

const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const LongTermGoals: React.FC<Props> = ({ goals, onChange }) => {
  const [newTitle, setNewTitle] = useState('');

  const add = () => {
    if (!newTitle.trim()) return;
    onChange([...goals, { id: generateId(), title: newTitle.trim(), progress: 0, createdAt: new Date().toISOString() }]);
    setNewTitle('');
  };

  const patch = (id: string, p: Partial<LongTermGoal>) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, ...p } : g)));

  return (
    <div className="glass p-6 rounded-[2rem] space-y-4">
      <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Flag size={16} className="text-accent" /> Objectifs long terme</h2>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6]"
          placeholder="Nouvel objectif de fond..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="p-3 bg-accent rounded-xl text-white shadow-lg shadow-accent/20 active:scale-95 transition-all"><Plus size={18} /></button>
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium">Reliez votre discipline quotidienne à un cap : ajoutez un objectif de fond.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const dLeft = daysUntil(g.targetDate);
            return (
              <div key={g.id} className="p-4 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    className="flex-1 bg-transparent text-sm font-black outline-none text-[#18181B] dark:text-[#E6E8E6]"
                    value={g.title}
                    onChange={(e) => patch(g.id, { title: e.target.value })}
                  />
                  <button onClick={() => onChange(goals.filter((x) => x.id !== g.id))} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935] p-1 shrink-0"><Trash2 size={15} /></button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-xs font-black text-accent tabular-nums w-10 text-right">{g.progress}%</span>
                </div>

                <input
                  type="range" min={0} max={100} value={g.progress}
                  onChange={(e) => patch(g.id, { progress: parseInt(e.target.value) })}
                  className="w-full accent-[color:var(--accent)]"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                    <input
                      type="date"
                      className="bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-2 py-1.5 rounded-lg text-[11px] font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none [color-scheme:dark] text-[#18181B] dark:text-[#E6E8E6]"
                      value={g.targetDate || ''}
                      onChange={(e) => patch(g.id, { targetDate: e.target.value })}
                    />
                  </div>
                  {dLeft !== null && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${dLeft < 0 ? 'bg-[#DF2935]/10 text-[#DF2935]' : dLeft <= 7 ? 'bg-[#FDCA40]/10 text-[#FDCA40]' : 'bg-accent/10 text-accent'}`}>
                      {dLeft < 0 ? `${-dLeft}j de retard` : dLeft === 0 ? "aujourd'hui" : `${dLeft}j restants`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LongTermGoals;
