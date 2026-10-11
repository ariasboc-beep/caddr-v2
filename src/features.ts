// Fonctionnalités activables / désactivables dans les Réglages.
// Par défaut, tout est activé : seule une valeur « false » désactive.
import { createContext, useContext } from 'react';
import type { AppData } from './types';

export type FeatureId =
  | 'dayRing' | 'motivation' | 'briefing' | 'nowNext' | 'habitsToday' | 'carryOver' | 'weekPlan' | 'evening' | 'journalPrompt' | 'headerBar'
  | 'hardDay' | 'jokers' | 'perfectDay' | 'identities' | 'mastery' | 'buddy'
  | 'cady' | 'journal' | 'share' | 'assign' | 'unplanned';

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
    { id: 'share', label: 'Partage des performances', hint: 'Image à partager sur les réseaux' },
    { id: 'assign', label: "Affecter à quelqu'un", hint: 'Confier une tâche par e-mail' },
    { id: 'unplanned', label: 'Badge « Imprévue »', hint: 'Toujours compté dans les rapports' },
  ] },
];

export const featureOn = (d: AppData | undefined, id: FeatureId): boolean => {
  if (!d) return true;
  if (id === 'motivation' && d.settings?.motivation === false) return false; // ancien réglage
  return d.settings?.features?.[id] !== false;
};

export const FeaturesContext = createContext<Partial<Record<FeatureId, boolean>>>({});
export const useFeature = (id: FeatureId) => useContext(FeaturesContext)[id] !== false;
