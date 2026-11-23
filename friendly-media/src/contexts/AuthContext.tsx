import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
} from '../lib/firebase';
import type { AdminRole, UserPrivateInfo, UserProfile } from '../types';
import { normalizeUsername } from '../utils/validation';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  adminRole: AdminRole | null;
  loading: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    username: string
  ) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function reserveUniqueUsername(base: string, uid: string): Promise<string> {
  let clean = normalizeUsername(base);
  if (clean.length < 3) clean = `member_${uid.slice(0, 6).toLowerCase()}`;

  const candidates = [
    clean,
    `${clean.slice(0, 22)}_${uid.slice(0, 5).toLowerCase()}`,
    `user_${uid.slice(0, 10).toLowerCase()}`,
  ];

  for (const candidate of candidates) {
    const usernameRef = doc(db, 'usernames', candidate);
    const snap = await getDoc(usernameRef);
    if (!snap.exists() || snap.data().uid === uid) {
      await setDoc(usernameRef, {
        uid,
        createdAt: serverTimestamp(),
      });
      return candidate;
    }
  }
  const fallback = `fm_${uid.slice(0, 12).toLowerCase()}`;
  await setDoc(doc(db, 'usernames', fallback), { uid, createdAt: serverTimestamp() });
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const ensureUserProvisioned = async (firebaseUser: User, preferredUsername?: string, preferredName?: string) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const privateRef = doc(db, 'users', firebaseUser.uid, 'private', 'info');

    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const displayName =
          (preferredName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member').slice(0, 60);
        const baseHandle = preferredUsername || firebaseUser.email?.split('@')[0] || displayName;
        const username = await reserveUniqueUsername(baseHandle, firebaseUser.uid);

        const batch = writeBatch(db);
        batch.set(userRef, {
          uid: firebaseUser.uid,
          username,
          displayName,
          bio: '',
          avatarUrl: firebaseUser.photoURL || '',
          coverUrl: '',
          location: '',
          website: '',
          verified: false,
          accountStatus: 'active',
          isPrivate: false,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isOnline: true,
          lastSeenAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(privateRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          emailVerified: firebaseUser.emailVerified,
          showOnlineStatus: true,
          allowMessagesFrom: 'everyone',
          blockedUserIds: [],
          savedPostIds: [],
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
      } else {
        await updateDoc(userRef, {
          isOnline: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const privSnap = await getDoc(privateRef);
        if (!privSnap.exists()) {
          await setDoc(privateRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            emailVerified: firebaseUser.emailVerified,
            showOnlineStatus: true,
            allowMessagesFrom: 'everyone',
            blockedUserIds: [],
            savedPostIds: [],
            updatedAt: serverTimestamp(),
          });
        } else if (privSnap.data().emailVerified !== firebaseUser.emailVerified) {
          await updateDoc(privateRef, {
            emailVerified: firebaseUser.emailVerified,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Bootstrap initial Super Admin for verified configured owner email
      if (firebaseUser.email === SUPER_ADMIN_EMAIL && firebaseUser.emailVerified) {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'super_admin',
            grantedBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
    }
  };

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubPrivate: (() => void) | undefined;
    let unsubAdmin: (() => void) | undefined;
    let unsubNotifs: (() => void) | undefined;
    let unsubConvos: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubProfile?.();
      unsubPrivate?.();
      unsubAdmin?.();
      unsubNotifs?.();
      unsubConvos?.();

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setPrivateInfo(null);
        setAdminRole(null);
        setUnreadNotifications(0);
        setUnreadMessages(0);
        setLoading(false);
        return;
      }

      try {
        await ensureUserProvisioned(firebaseUser);
      } catch (e) {
        console.error(e);
      }

      unsubProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      );

      unsubPrivate = onSnapshot(
        doc(db, 'users', firebaseUser.uid, 'private', 'info'),
        (snap) => {
          if (snap.exists()) {
            setPrivateInfo(snap.data() as UserPrivateInfo);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}/private/info`);
        }
      );

      unsubAdmin = onSnapshot(
        doc(db, 'admins', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setAdminRole(snap.data() as AdminRole);
          } else {
            setAdminRole(null);
          }
        },
        () => {
          setAdminRole(null);
        }
      );

      unsubNotifs = onSnapshot(
        query(
          collection(db, 'notifications'),
          where('recipientId', '==', firebaseUser.uid),
          where('isRead', '==', false)
        ),
        (snap) => {
          setUnreadNotifications(snap.size);
        },
        () => {
          setUnreadNotifications(0);
        }
      );

      unsubConvos = onSnapshot(
        query(
          collection(db, 'conversations'),
          where('participantIds', 'array-contains', firebaseUser.uid)
        ),
        (snap) => {
          let total = 0;
          snap.docs.forEach((d) => {
            const data = d.data();
            const deletedFor = (data.deletedFor as string[]) || [];
            if (!deletedFor.includes(firebaseUser.uid)) {
              total += Number(data.unreadCounts?.[firebaseUser.uid] || 0);
            }
          });
          setUnreadMessages(total);
        },
        () => {
          setUnreadMessages(0);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
      unsubPrivate?.();
      unsubAdmin?.();
      unsubNotifs?.();
      unsubConvos?.();
    };
  }, []);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserProvisioned(cred.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    username: string
  ) => {
    const cleanHandle = normalizeUsername(username);
    if (cleanHandle.length < 3) {
      throw new Error('Username must be at least 3 characters (letters, numbers, underscores, or dots).');
    }
    const existingHandle = await getDoc(doc(db, 'usernames', cleanHandle));
    if (existingHandle.exists()) {
      throw new Error('This username is already taken. Please choose another.');
    }

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 60) });
    await sendEmailVerification(cred.user);
    await ensureUserProvisioned(cred.user, cleanHandle, displayName.trim());
  };

  const sendResetEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuth = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser } as User);
    if (auth.currentUser.emailVerified && privateInfo && !privateInfo.emailVerified) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'private', 'info'), {
        emailVerified: true,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const logout = async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          isOnline: false,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Proceed with signOut even if offline update fails
      }
    }
    await signOut(auth);
  };

  const deleteCurrentAccount = async () => {
    const current = auth.currentUser;
    if (!current) throw new Error('No active session.');
    const uid = current.uid;
    const handle = profile?.username;
    try {
      await deleteDoc(doc(db, 'users', uid, 'private', 'info'));
      await deleteDoc(doc(db, 'users', uid));
      if (handle) {
        await deleteDoc(doc(db, 'usernames', handle));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
    await deleteUser(current);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        adminRole,
        loading,
        unreadNotifications,
        unreadMessages,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendResetEmail,
        resendVerification,
        refreshAuth,
        logout,
        deleteCurrentAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
