
import { RecurrenceType } from './types';

// Utiliser l'heure locale pour générer la clé 'YYYY-MM-DD'
// Cela évite les décalages de date dus à la conversion UTC (toISOString)
export const getKeyFromDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const isDateInRange = (date: Date, type: RecurrenceType, specificDate?: string, startDate?: string, endDate?: string) => {
  const dateStr = getKeyFromDate(date);
  const day = date.getDay(); // 0 = Dimanche, 1 = Lundi, ...
  
  switch (type) {
    case 'daily': 
      return true;
      
    case 'weekdays': 
      // Lundi (1) à Vendredi (5)
      return day >= 1 && day <= 5;
      
    case 'weekends': 
      // Dimanche (0) ou Samedi (6)
      return day === 0 || day === 6;
      
    case 'specific': 
      return dateStr === specificDate;
      
    case 'once': 
      return dateStr === specificDate;
      
    case 'week': {
        // Logique "Cette semaine" (Basée sur la semaine actuelle du calendrier réel)
        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0-6
        
        // Calculer le Dimanche (Début de semaine)
        // On clone la date 'now' pour ne pas la muter
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - currentDayOfWeek);
        
        // Calculer le Samedi (Fin de semaine)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startStr = getKeyFromDate(startOfWeek);
        const endStr = getKeyFromDate(endOfWeek);
        
        return dateStr >= startStr && dateStr <= endStr;
    }
    
    case 'month': {
        // Logique "Ce mois" (Basée sur le mois actuel du calendrier réel)
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    
    case 'period': {
        if (!startDate || !endDate) return false;
        return dateStr >= startDate && dateStr <= endDate;
    }
    
    default: return false;
  }
};
