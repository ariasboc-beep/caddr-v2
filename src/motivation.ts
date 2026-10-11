// Message de motivation du jour : court, original, en tutoiement.
// Le message est stable pour une journée donnée (même message toute la journée, sur tous
// les appareils) et adapté au contexte : début de semaine, week-end, veille réussie ou
// difficile, série en cours.

export type MotivationContext = 'monday' | 'friday' | 'weekend' | 'afterGreat' | 'afterHard' | 'streak' | 'general';

const M: Record<MotivationContext, string[]> = {
  general: [
    "La discipline, c'est choisir ce que tu veux le plus plutôt que ce que tu veux maintenant.",
    "Une journée réussie n'est pas parfaite : c'est une journée où tu as tenu l'essentiel.",
    "Commence par la tâche qui compte. Le reste trouvera sa place.",
    "Tu n'as pas besoin de motivation pour commencer. C'est le premier pas qui la fait naître.",
    "Chaque case cochée aujourd'hui est une promesse tenue envers toi-même.",
    "Les grandes réussites sont faites de petites journées bien tenues.",
    "Fais aujourd'hui ce que la personne que tu veux devenir ferait.",
    "La constance bat l'intensité. Un peu chaque jour, et tout change.",
    "Ton futur se construit dans les gestes simples d'aujourd'hui.",
    "Pas besoin d'aller vite. Il faut juste ne pas t'arrêter.",
    "Protège tes premières heures : elles donnent le ton à toute la journée.",
    "Une tâche à la fois. Pleinement. Puis la suivante.",
    "Ce que tu répètes chaque jour finit par te définir.",
    "Le confort ne fait pas grandir. L'effort régulier, si.",
    "Tu es plus capable que ce que ta fatigue te raconte.",
    "Décide une fois, puis agis sans renégocier avec toi-même.",
    "Un objectif sans plan reste un souhait. Ta journée est ton plan : suis-le.",
    "La fierté du soir se gagne dans les efforts du matin.",
    "Fais le difficile d'abord : la suite sera légère.",
    "Tu n'as pas à tout faire. Tu as à faire ce qui compte.",
    "La discipline est une forme de respect envers toi-même.",
    "Chaque jour est une nouvelle chance de prouver ce dont tu es capable.",
    "Avance, même lentement. Reculer n'est pas au programme.",
    "Ton énergie va là où va ton attention. Choisis bien où la poser.",
    "Les excuses ne construisent rien. Les actions, oui.",
    "Mieux vaut fait que parfait. Lance-toi.",
    "Quand l'envie manque, rappelle-toi pourquoi tu as commencé.",
    "Ce n'est pas le temps qui manque, c'est la priorité qu'on lui donne.",
    "Ta régularité d'aujourd'hui est le résultat de demain.",
    "Les petits pas répétés mènent plus loin que les grands bonds isolés.",
    "Chaque effort compte, même quand personne ne le voit.",
    "Le meilleur moment pour avancer, c'est maintenant.",
    "Une heure concentrée vaut mieux qu'une journée dispersée.",
    "Tu as déjà surmonté des journées plus difficiles que celle-ci.",
    "Ce qui est planifié a beaucoup plus de chances d'être fait.",
    "Chaque matin, tu choisis qui tu vas être. Choisis la meilleure version.",
    "Termine ce que tu commences : c'est là que se trouve la vraie satisfaction.",
    "La motivation te fait démarrer. L'habitude te fait continuer.",
    "Ne compte pas les jours. Fais que chaque jour compte.",
    "Ton calme et ta constance sont tes plus grandes forces.",
    "Fais un pas de plus qu'hier. C'est suffisant.",
    "Reste fidèle à ton plan, surtout quand c'est difficile.",
    "La réussite aime ceux qui se présentent tous les jours.",
    "Range une chose, termine une tâche, tiens une promesse : c'est comme ça qu'on avance.",
    "Ta journée t'appartient. Prends-en les commandes.",
    "Le progrès se cache dans la répétition des choses simples.",
    "Respire, concentre-toi, commence. Le reste suivra.",
    "Tu récoltes ce que tu sèmes chaque jour. Sème avec soin.",
    "Dis non à ce qui disperse, pour dire oui à ce qui compte.",
    "Tes objectifs de vie se jouent aussi dans les tâches de ce matin.",
  ],
  monday: [
    "Nouvelle semaine, nouvelle page. Écris-la avec intention.",
    "Le lundi donne le rythme de la semaine. Pose-le fermement.",
    "Une semaine réussie commence par un lundi bien tenu.",
    "Sept jours pour avancer. Commence fort, continue régulier.",
    "Fixe ta priorité de la semaine et attaque-la dès aujourd'hui.",
  ],
  friday: [
    "Dernière ligne droite de la semaine : finis en beauté.",
    "Termine la semaine comme tu aurais voulu la commencer : avec énergie.",
    "Ce que tu boucles aujourd'hui, tu ne le traîneras pas ce week-end.",
    "Un vendredi bien tenu, c'est un week-end l'esprit léger.",
  ],
  weekend: [
    "Le week-end aussi, la discipline est une liberté : celle de te sentir bien.",
    "Repose-toi sans te perdre. Garde tes habitudes essentielles.",
    "Prends soin de toi : c'est aussi une façon d'avancer.",
    "Profite, recharge-toi, et garde un pied dans tes bonnes habitudes.",
    "Un week-end équilibré prépare une semaine réussie.",
  ],
  afterGreat: [
    "Belle journée hier. Garde cet élan : la régularité fait la différence.",
    "Hier, tu as tenu bon. Aujourd'hui, prouve que ce n'était pas un hasard.",
    "Ton élan d'hier est précieux. Ne le laisse pas retomber.",
    "Tu as montré hier ce dont tu es capable. On recommence ?",
  ],
  afterHard: [
    "Hier était difficile ? Aujourd'hui est une nouvelle chance. Recommence simplement.",
    "Une journée manquée ne définit rien. Ce qui compte, c'est de revenir.",
    "Pas de culpabilité : une tâche importante aujourd'hui, et tu repars.",
    "Les champions ne sont pas ceux qui ne tombent jamais, mais ceux qui se relèvent.",
    "Allège si besoin, mais ne lâche pas. Un petit pas aujourd'hui suffit.",
  ],
  streak: [
    "{n} jours de suite à 100 % : ne casse pas la chaîne.",
    "Ta série de {n} jours est la preuve de ta discipline. Continue.",
    "{n} jours parfaits d'affilée. Aujourd'hui, ajoute un maillon.",
  ],
};

// Hachage simple et stable d'une chaîne (même résultat sur tous les appareils)
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export interface MotivationInput { dateKey: string; yesterdayRate: number | null; streak: number; offset?: number }

export function dailyMotivation({ dateKey, yesterdayRate, streak, offset = 0 }: MotivationInput): { text: string; context: MotivationContext } {
  const dow = new Date(dateKey + 'T12:00:00').getDay();
  // Contexte du jour, par ordre de priorité
  let ctx: MotivationContext = 'general';
  const roll = hash(dateKey + ':ctx') % 100;
  if (streak >= 3 && roll < 45) ctx = 'streak';
  else if (yesterdayRate !== null && yesterdayRate < 50 && roll < 70) ctx = 'afterHard';
  else if (yesterdayRate !== null && yesterdayRate >= 85 && roll < 40) ctx = 'afterGreat';
  else if (dow === 1 && roll < 75) ctx = 'monday';
  else if (dow === 5 && roll < 60) ctx = 'friday';
  else if ((dow === 0 || dow === 6) && roll < 65) ctx = 'weekend';
  // « Un autre » : on parcourt la liste générale à partir du message du jour
  if (offset > 0) ctx = 'general';
  const list = M[ctx];
  const idx = (hash(dateKey) + offset) % list.length;
  return { text: list[idx].replace('{n}', String(streak)), context: ctx };
}
