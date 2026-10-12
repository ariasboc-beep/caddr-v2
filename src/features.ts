// Fonctionnalités activables / désactivables dans les Réglages.
// Par défaut, tout est activé : seule une valeur « false » désactive.
import { createContext, useContext } from 'react';
import type { AppData } from './types';

export type FeatureId =
  | 'dayRing' | 'motivation' | 'briefing' | 'nowNext' | 'habitsToday' | 'carryOver' | 'weekPlan' | 'evening' | 'journalPrompt' | 'headerBar'
  | 'hardDay' | 'jokers' | 'perfectDay' | 'identities' | 'mastery' | 'buddy'
  | 'cady' | 'journal' | 'projects' | 'share' | 'assign' | 'unplanned';

export interface FeatureDef { id: FeatureId; label: string; hint: string }
export const FEATURE_GROUPS: { title: string; items: FeatureDef[] }[] = [
  { title: "Écran Aujourd'hui", items: [
    { id: 'dayRing', label: 'Anneau du jour', hint: 'Cercle de progression de la journée' },
    { id: 'motivation', label: 'Message de motivation', hint: 'Une phrase chaque matin' },
    { id: 'briefing', label: 'Briefing du matin', hint: 'Priorité, heures prises, vigilance' },
    { id: 'nowNext', label: 'En cours / Ensuite', hint: 'La tâche du moment et la suivante' },
    { id: 'habitsToday', label: 'Habitudes du jour', hint: 'Carte pour cocher tes habitudes' },
    { id: 'carryOver', label: 'Tâches non terminées', hint: 'Rattraper les jours précédents' },
    { id: 'weekPlan', label: 'Rituel « Planifier ma semaine »', hint: 'Rappel du dimanche et du lundi' },
    { id: 'evening', label: 'Bilan du soir', hint: 'Rappel après 18 h' },
    { id: 'journalPrompt', label: 'Rappel du journal', hint: 'Invitation du soir à écrire' },
    { id: 'headerBar', label: "Barre de discipline de l'en-tête", hint: 'Discipline du mois ou niveau XP' },
  ] },
  { title: 'Constance et motivation', items: [
    { id: 'hardDay', label: 'Jour difficile', hint: 'Journée réduite à la version minimale' },
    { id: 'jokers', label: 'Jokers de série', hint: 'Protéger une série après un écart' },
    { id: 'perfectDay', label: 'Journée parfaite et cartes', hint: 'Célébration et cartes surprises' },
    { id: 'identities', label: 'Identités et votes', hint: '« Qui je deviens »' },
    { id: 'mastery', label: 'Paliers de maîtrise', hint: 'Graine, Pousse, Arbre, Forêt' },
    { id: 'buddy', label: 'Binôme de discipline', hint: 'Séries partagées et encouragements' },
  ] },
  { title: 'Outils', items: [
    { id: 'cady', label: 'Cady, ton assistante', hint: 'Bouton central et suggestions de Cady' },
    { id: 'journal', label: 'Journal de gratitude', hint: 'Sous-onglet Journal de Croissance' },
    { id: 'projects', label: 'Projets', hint: 'Étapes et tâches, de A à Z' },
    { id: 'share', label: 'Partage des performances', hint: 'Image à partager sur les réseaux' },
    { id: 'assign', label: "Affecter à quelqu'un", hint: 'Confier une tâche par e-mail' },
    { id: 'unplanned', label: 'Badge « Imprévue »', hint: 'Toujours compté dans les rapports' },
  ] },
];

// ─── Modes : Essentiel (défaut) ou Complet ────────────────────────────────────
export type AppMode = 'essentiel' | 'complet' | 'custom';

/** Désactivé en mode Essentiel : les couches en plus, jamais le contenu déjà créé. */
export const ESSENTIEL_OFF: FeatureId[] = ['briefing', 'nowNext', 'weekPlan', 'evening', 'journalPrompt', 'jokers', 'identities', 'mastery', 'buddy', 'assign', 'projects'];

export const essentielFeatures = (): Record<string, boolean> =>
  Object.fromEntries(ESSENTIEL_OFF.map(id => [id, false]));

export const appMode = (d?: AppData): AppMode => {
  const m = d?.settings?.appMode;
  if (m) return m;
  const off = Object.values(d?.settings?.features || {}).some(v => v === false) || d?.settings?.motivation === false;
  return off ? 'custom' : 'complet';
};

// ─── Découverte progressive : une proposition à la fois, jamais deux ──────────
export interface UnlockStep { at: number; ids: FeatureId[]; title: string; text: string }

export const UNLOCKS: UnlockStep[] = [
  { at: 3, ids: ['briefing', 'evening'], title: 'Ouvrir et fermer tes journées', text: "Trois jours sur Caddr. Veux-tu la priorité du matin et le bilan de 3 minutes le soir ?" },
  { at: 7, ids: ['identities'], title: 'Qui je deviens', text: "Une semaine tenue. Chaque tâche cochée peut devenir un vote pour la personne que tu deviens." },
  { at: 10, ids: ['projects'], title: 'Gérer tes projets', text: "Dix jours tenus. Tes journées sont en place : veux-tu y ajouter ce que tu construis — projets, étapes, tâches, reliés à tes objectifs de vie ?" },
  { at: 14, ids: ['jokers', 'mastery'], title: 'Jokers et paliers de maîtrise', text: "Deux semaines. Protège ta série les jours d'écart et vois tes habitudes passer de Graine à Forêt." },
  { at: 21, ids: ['buddy'], title: 'Un binôme de discipline', text: "Vingt-et-un jours : l'habitude est prise. Veux-tu avancer à deux, avec séries partagées et encouragements ?" },
  { at: 30, ids: ['weekPlan', 'nowNext'], title: 'Prendre de l’avance', text: "Un mois. Le rituel du dimanche et la carte « En cours / Ensuite » t'aident à garder le cap." },
];

/** La prochaine fonctionnalité à proposer, ou rien (hors mode Essentiel : rien). */
export function nextUnlock(d: AppData | undefined, days: number): UnlockStep | null {
  if (!d || appMode(d) !== 'essentiel') return null;
  const seen = d.settings?.unlocksSeen || [];
  return UNLOCKS.find(s => days >= s.at && !seen.includes(s.at) && s.ids.every(id => featureOn(d, id) === false)) || null;
}

export const featureOn = (d: AppData | undefined, id: FeatureId): boolean => {
  if (!d) return true;
  if (id === 'motivation' && d.settings?.motivation === false) return false; // ancien réglage
  return d.settings?.features?.[id] !== false;
};

export const FeaturesContext = createContext<Partial<Record<FeatureId, boolean>>>({});
export const useFeature = (id: FeatureId) => useContext(FeaturesContext)[id] !== false;
