import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function recordAdminAudit(params: {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action: params.action.slice(0, 120),
      targetType: params.targetType.slice(0, 40),
      targetId: params.targetId.slice(0, 128),
      details: params.details.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
