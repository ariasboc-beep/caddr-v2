// Affectation de tâches entre utilisateurs Caddr. (par adresse e-mail)
// Collection Firestore « assignments » : un document par tâche confiée.
// Les règles Firestore (voir firestore.rules) n'autorisent la lecture qu'à l'expéditeur
// et au destinataire (adresse e-mail vérifiée par Firebase Auth).
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';

export type AssignmentStatus = 'pending' | 'accepted' | 'declined' | 'done';

export interface Assignment {
  id: string;
  fromUid: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  title: string;
  description?: string;
  duration?: number;
  priority?: string;
  subTasks?: string[];
  note?: string;
  dueDate?: string;      // jour proposé (AAAA-MM-JJ)
  status: AssignmentStatus;
  responseNote?: string;
}

const COL = 'assignments';
export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export async function sendAssignment(a: Omit<Assignment, 'id' | 'status'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...a, toEmail: normEmail(a.toEmail), fromEmail: normEmail(a.fromEmail), status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

/** Tâches reçues encore en attente de réponse */
export async function listIncoming(email: string): Promise<Assignment[]> {
  const q = query(collection(db, COL), where('toEmail', '==', normEmail(email)), where('status', '==', 'pending'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Assignment, 'id'>) }));
}

/** Statut des tâches envoyées (pour le suivi côté expéditeur) */
export async function listOutgoingStatuses(uid: string): Promise<Record<string, AssignmentStatus>> {
  const q = query(collection(db, COL), where('fromUid', '==', uid), limit(200));
  const snap = await getDocs(q);
  const out: Record<string, AssignmentStatus> = {};
  snap.docs.forEach(d => { out[d.id] = (d.data() as Assignment).status; });
  return out;
}

export async function respondAssignment(id: string, status: AssignmentStatus, responseNote?: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status, ...(responseNote ? { responseNote } : {}), updatedAt: serverTimestamp() });
}
