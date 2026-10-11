// Binôme de discipline : deux utilisateurs Caddr. voient mutuellement leurs séries et leur
// taux du jour (jamais leurs tâches), et peuvent s'envoyer des encouragements.
// Firestore :
//  - buddyLinks/{id}   : invitation { fromUid, fromName, fromEmail, toEmail, toUid?, toName?, status }
//  - publicStats/{uid} : résumé publié par chaque utilisateur, lisible par ses binômes (viewers = e-mails)
//  - cheers/{id}       : encouragements { fromUid, fromName, toUid, emoji, message, read }
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, setDoc, getDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { normEmail } from './assignService';

export interface BuddyLink { id: string; fromUid: string; fromName: string; fromEmail: string; toEmail: string; toUid?: string; toName?: string; status: 'pending' | 'accepted' | 'declined' }
export interface PublicStats { name: string; streak: number; best: number; todayRate: number | null; todayDone: number; todayTotal: number; weekRate: number | null; perfect30: number; hard: boolean; day: string; viewers: string[] }
export interface Cheer { id: string; fromUid: string; fromName: string; toUid: string; emoji: string; message: string; read: boolean }
export interface Buddy { linkId: string; uid: string; name: string; email: string; stats: PublicStats | null }

export async function inviteBuddy(me: { uid: string; name: string; email: string }, toEmail: string): Promise<string> {
  const ref = await addDoc(collection(db, 'buddyLinks'), { fromUid: me.uid, fromName: me.name, fromEmail: normEmail(me.email), toEmail: normEmail(toEmail), status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

export async function listBuddyLinks(uid: string, email: string): Promise<{ incoming: BuddyLink[]; mine: BuddyLink[] }> {
  const map = (s: Awaited<ReturnType<typeof getDocs>>) => s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BuddyLink, 'id'>) }));
  const [sent, received] = await Promise.all([
    getDocs(query(collection(db, 'buddyLinks'), where('fromUid', '==', uid), limit(20))),
    getDocs(query(collection(db, 'buddyLinks'), where('toEmail', '==', normEmail(email)), limit(20))),
  ]);
  const rec = map(received);
  return { incoming: rec.filter(l => l.status === 'pending'), mine: [...map(sent), ...rec.filter(l => l.status === 'accepted')] };
}

export async function answerInvite(link: BuddyLink, me: { uid: string; name: string }, accept: boolean) {
  await updateDoc(doc(db, 'buddyLinks', link.id), accept ? { status: 'accepted', toUid: me.uid, toName: me.name } : { status: 'declined' });
}
export const removeBuddyLink = (id: string) => deleteDoc(doc(db, 'buddyLinks', id));

export async function publishStats(uid: string, stats: PublicStats) { await setDoc(doc(db, 'publicStats', uid), { ...stats, updatedAt: serverTimestamp() }); }
export async function readStats(uid: string): Promise<PublicStats | null> { const s = await getDoc(doc(db, 'publicStats', uid)); return s.exists() ? (s.data() as PublicStats) : null; }

export async function sendCheer(from: { uid: string; name: string }, toUid: string, emoji: string, message: string) {
  await addDoc(collection(db, 'cheers'), { fromUid: from.uid, fromName: from.name, toUid, emoji, message, read: false, createdAt: serverTimestamp() });
}
export async function unreadCheers(uid: string): Promise<Cheer[]> {
  const s = await getDocs(query(collection(db, 'cheers'), where('toUid', '==', uid), where('read', '==', false), limit(20)));
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Cheer, 'id'>) }));
}
export const markCheerRead = (id: string) => updateDoc(doc(db, 'cheers', id), { read: true });

/** Binômes acceptés (l'autre personne de chaque lien), avec leur résumé publié */
export async function loadBuddies(uid: string, links: BuddyLink[]): Promise<Buddy[]> {
  const accepted = links.filter(l => l.status === 'accepted');
  return Promise.all(accepted.map(async l => {
    const iAmSender = l.fromUid === uid;
    const other = iAmSender ? l.toUid! : l.fromUid;
    let stats: PublicStats | null = null;
    try { stats = await readStats(other); } catch { /* pas encore publié ou pas autorisé */ }
    return { linkId: l.id, uid: other, name: (iAmSender ? l.toName : l.fromName) || (iAmSender ? l.toEmail : l.fromEmail), email: iAmSender ? l.toEmail : l.fromEmail, stats };
  }));
}
