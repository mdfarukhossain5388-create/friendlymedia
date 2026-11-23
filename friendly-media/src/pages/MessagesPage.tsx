import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { ChatMessage, Conversation, UserProfile } from '../types';
import { uploadImageAsset } from '../utils/media';
import { Avatar } from '../components/Avatar';
import { MainLayout } from '../components/MainLayout';
import { formatRelativeTime } from '../components/PostCard';

function getConversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export function MessagesPage() {
  const { user, profile, loading } = useAuth();
  const { settings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const targetUidParam = searchParams.get('to');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerProfile, setPeerProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Conversation, 'id'>),
          }))
          .filter((c) => !(c.deletedFor || []).includes(user.uid));
        setConversations(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'conversations');
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('accountStatus', '==', 'active'), limit(30));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAllUsers(
          snap.docs.map((d) => d.data() as UserProfile).filter((u) => u.uid !== user?.uid)
        );
      },
      () => setAllUsers([])
    );
    return () => unsub();
  }, [user?.uid]);

  const startConversationWith = async (target: UserProfile) => {
    if (!user || !user.emailVerified || !profile) return;
    const convoId = getConversationId(user.uid, target.uid);
    const convoRef = doc(db, 'conversations', convoId);
    const existingSnap = await getDoc(convoRef);
    if (!existingSnap.exists()) {
      await setDoc(convoRef, {
        participantIds: [user.uid, target.uid].sort(),
        participantMap: {
          [user.uid]: {
            name: profile.displayName,
            username: profile.username,
            avatar: profile.avatarUrl || '',
          },
          [target.uid]: {
            name: target.displayName,
            username: target.username,
            avatar: target.avatarUrl || '',
          },
        },
        lastMessage: '',
        lastMessageSenderId: user.uid,
        lastMessageAt: serverTimestamp(),
        typingUsers: { [user.uid]: false, [target.uid]: false },
        unreadCounts: { [user.uid]: 0, [target.uid]: 0 },
        deletedFor: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setActiveConvoId(convoId);
    setShowNewChat(false);
  };

  useEffect(() => {
    if (!targetUidParam || !user || !profile) return;
    const found = allUsers.find((u) => u.uid === targetUidParam);
    if (found) {
      void startConversationWith(found);
    }
  }, [targetUidParam, allUsers, user, profile]);

  const activeConversation = conversations.find((c) => c.id === activeConvoId) || null;
  const peerUid = activeConversation?.participantIds.find((id) => id !== user?.uid) || null;

  useEffect(() => {
    if (!peerUid) {
      setPeerProfile(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', peerUid),
      (snap) => {
        if (snap.exists()) setPeerProfile(snap.data() as UserProfile);
      },
      () => setPeerProfile(null)
    );
    return () => unsub();
  }, [peerUid]);

  useEffect(() => {
    if (!activeConvoId || !user) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', activeConvoId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(list);

        // Mark unread messages as read
        list.forEach((m) => {
          if (m.senderId !== user.uid && !m.readBy.includes(user.uid)) {
            void updateDoc(doc(db, 'conversations', activeConvoId, 'messages', m.id), {
              readBy: arrayUnion(user.uid),
            });
          }
        });
        if ((activeConversation?.unreadCounts?.[user.uid] || 0) > 0) {
          void updateDoc(doc(db, 'conversations', activeConvoId), {
            [`unreadCounts.${user.uid}`]: 0,
            updatedAt: serverTimestamp(),
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `conversations/${activeConvoId}/messages`);
      }
    );
    return () => unsub();
  }, [activeConvoId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!settings.features.messagingEnabled) {
    return (
      <MainLayout hideRightSidebar>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <h1 className="text-lg font-bold">Messaging Paused</h1>
          <p className="text-sm text-slate-500 mt-1">
            Direct messaging is temporarily disabled by the platform administrator.
          </p>
        </div>
      </MainLayout>
    );
  }

  const handleTyping = async (typing: boolean) => {
    if (!activeConvoId || !user) return;
    try {
      await updateDoc(doc(db, 'conversations', activeConvoId), {
        [`typingUsers.${user.uid}`]: typing,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore typing update error
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadImageAsset(file, 'messages', user.uid);
      setImageUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified || !profile || !activeConversation || !peerUid) return;
    const cleanText = text.trim().slice(0, 2000);
    if (!cleanText && !imageUrl) return;

    setText('');
    const attachedImage = imageUrl;
    setImageUrl('');

    try {
      await addDoc(collection(db, 'conversations', activeConversation.id, 'messages'), {
        conversationId: activeConversation.id,
        participantIds: activeConversation.participantIds,
        senderId: user.uid,
        text: cleanText,
        imageUrl: attachedImage,
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        lastMessage: cleanText || 'Sent a photo',
        lastMessageSenderId: user.uid,
        lastMessageAt: serverTimestamp(),
        [`typingUsers.${user.uid}`]: false,
        [`unreadCounts.${peerUid}`]: increment(1),
        deletedFor: [],
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        recipientId: peerUid,
        actorId: user.uid,
        actorName: profile.displayName,
        actorUsername: profile.username,
        actorAvatar: profile.avatarUrl || '',
        type: 'message',
        targetId: activeConversation.id,
        message: `${profile.displayName} sent you a message.`,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${activeConversation.id}/messages`);
    }
  };

  const handleDeleteConversation = async (convoId: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'conversations', convoId), {
      deletedFor: arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    });
    if (activeConvoId === convoId) setActiveConvoId(null);
  };

  const isPeerTyping = Boolean(peerUid && activeConversation?.typingUsers?.[peerUid]);

  return (
    <MainLayout hideRightSidebar>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[72vh] min-h-[520px]">
        {/* Conversation List */}
        <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Messages</h1>
            <button
              type="button"
              onClick={() => setShowNewChat((s) => !s)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              title="New conversation"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          </div>

          {showNewChat ? (
            <div className="p-3 space-y-2 overflow-y-auto flex-1">
              <p className="text-xs font-semibold text-slate-500 px-1">Start a conversation</p>
              {allUsers.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => void startConversationWith(u)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} size="sm" isOnline={u.isOnline} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {u.displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
              {conversations.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  No conversations yet. Click the + button to start chatting.
                </p>
              ) : (
                conversations.map((c) => {
                  const otherId = c.participantIds.find((id) => id !== user?.uid) || '';
                  const other = c.participantMap?.[otherId];
                  const unread = c.unreadCounts?.[user?.uid || ''] || 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveConvoId(c.id)}
                      className={`p-3.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        activeConvoId === c.id
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={other?.avatar} name={other?.name || 'Member'} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {other?.name || 'Member'}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {c.lastMessage || 'Conversation started'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unread > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-700 text-white text-[10px] font-bold tabular-nums">
                            {unread}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteConversation(c.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Active Chat Thread */}
        <div className="md:col-span-8 flex flex-col">
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Select a conversation or start a new chat
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Messages sync in real time with read receipts, typing status, and photo sharing.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={peerProfile?.avatarUrl || activeConversation.participantMap?.[peerUid || '']?.avatar}
                    name={peerProfile?.displayName || activeConversation.participantMap?.[peerUid || '']?.name || 'Member'}
                    size="sm"
                    isOnline={peerProfile?.isOnline}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {peerProfile?.displayName || activeConversation.participantMap?.[peerUid || '']?.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isPeerTyping
                        ? 'Typing...'
                        : peerProfile?.isOnline
                        ? 'Active now'
                        : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                {messages.map((m) => {
                  const mine = m.senderId === user?.uid;
                  const readByPeer = peerUid ? m.readBy.includes(peerUid) : false;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          mine
                            ? 'bg-blue-700 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            alt="Shared attachment"
                            referrerPolicy="no-referrer"
                            className="rounded-xl max-h-56 mb-2 object-cover"
                          />
                        )}
                        {m.text && <p className="break-words">{m.text}</p>}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            mine ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          <span>{formatRelativeTime(m.createdAt)}</span>
                          {mine &&
                            (readByPeer ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                {imageUrl && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <span>Photo ready to send</span>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-red-500 underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadImage}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    aria-label="Attach image"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  </button>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      void handleTyping(Boolean(e.target.value.trim()));
                    }}
                    onBlur={() => void handleTyping(false)}
                    placeholder="Write a message..."
                    maxLength={2000}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() && !imageUrl}
                    className="p-2.5 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
