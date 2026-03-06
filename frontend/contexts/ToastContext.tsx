/**
 * ToastContext - Global toast notification system
 * Provides screen-level toast functionality for delete operations and other notifications
 */

import React, { createContext, useContext, useRef, useCallback, useState } from 'react';
import { useDelete } from '../hooks/useDelete';
import { notesStore$ } from '../state/notesStore';
import { devotionStore$ } from '../state/devotionStore';
import { planStore$ } from '../state/planStore';
import { deleteSessionComment } from '../services/planService';
import { DelightfulToast, ToastConfig } from '../components/DelightfulToast';

interface ToastContextValue {
  // Delete toast handler - accepts noteId and triggers delete with undo
  showDeleteToast: (noteId: string) => void;
  // Delete comment toast handler - accepts commentId and triggers delete with undo (for devotion)
  showDeleteCommentToast: (commentId: string) => void;
  // Delete session comment toast handler - for Bible plan comments
  showDeleteSessionCommentToast: (commentId: string) => void;
  // Generic toast handler - shows info/success toasts
  showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Track which note is pending deletion (using ref to avoid race condition)
  const pendingDeleteNoteIdRef = useRef<string | null>(null);
  // Track which comment is pending deletion (devotion)
  const pendingDeleteCommentIdRef = useRef<string | null>(null);
  // Track which session comment is pending deletion (plans)
  const pendingDeleteSessionCommentIdRef = useRef<string | null>(null);

  // Generic toast state
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);

  // Note delete toast with undo functionality
  const { deleteItem: deleteNote, ToastComponent: NoteToastComponent } = useDelete({
    onDelete: () => {
      const noteId = pendingDeleteNoteIdRef.current;
      if (noteId) {
        notesStore$.softDeleteNote(noteId);
      }
    },
    onRestore: () => {
      const noteId = pendingDeleteNoteIdRef.current;
      if (noteId) {
        notesStore$.restoreNote(noteId);
      }
    },
    onPermanentDelete: () => {
      const noteId = pendingDeleteNoteIdRef.current;
      if (noteId) {
        notesStore$.permanentlyDeleteNote(noteId);
      }
    },
    message: "Note removed",
  });

  // Comment delete toast with undo functionality (devotion comments)
  const { deleteItem: deleteComment, ToastComponent: CommentToastComponent } = useDelete({
    onDelete: () => {
      const commentId = pendingDeleteCommentIdRef.current;
      if (commentId) {
        devotionStore$.softDeleteComment(commentId);
      }
    },
    onRestore: () => {
      const commentId = pendingDeleteCommentIdRef.current;
      if (commentId) {
        devotionStore$.restoreComment(commentId);
      }
    },
    onPermanentDelete: () => {
      const commentId = pendingDeleteCommentIdRef.current;
      if (commentId) {
        // Sync soft delete to server (sets status to 'inactive')
        devotionStore$.finalizeDeleteComment(commentId);
      }
    },
    message: "Comment removed",
  });

  // Session comment delete toast with undo functionality (plan comments)
  const { deleteItem: deleteSessionCommentItem, ToastComponent: SessionCommentToastComponent } = useDelete({
    onDelete: () => {
      const commentId = pendingDeleteSessionCommentIdRef.current;
      if (commentId) {
        planStore$.softDeleteComment(commentId);
      }
    },
    onRestore: () => {
      const commentId = pendingDeleteSessionCommentIdRef.current;
      if (commentId) {
        planStore$.restoreComment(commentId);
      }
    },
    onPermanentDelete: async () => {
      const commentId = pendingDeleteSessionCommentIdRef.current;
      if (commentId) {
        // Sync soft delete to server
        await deleteSessionComment(commentId);
      }
    },
    message: "Comment removed",
  });

  // Show delete toast for a note
  const showDeleteToast = useCallback((noteId: string) => {
    pendingDeleteNoteIdRef.current = noteId;  // Immediate update via ref
    deleteNote();
  }, [deleteNote]);

  // Show delete toast for a comment (devotion)
  const showDeleteCommentToast = useCallback((commentId: string) => {
    pendingDeleteCommentIdRef.current = commentId;  // Immediate update via ref
    deleteComment();
  }, [deleteComment]);

  // Show delete toast for a session comment (plans)
  const showDeleteSessionCommentToast = useCallback((commentId: string) => {
    pendingDeleteSessionCommentIdRef.current = commentId;  // Immediate update via ref
    deleteSessionCommentItem();
  }, [deleteSessionCommentItem]);

  // Show generic toast
  const showToast = useCallback((config: ToastConfig) => {
    setToastConfig(config);
  }, []);

  const value: ToastContextValue = {
    showDeleteToast,
    showDeleteCommentToast,
    showDeleteSessionCommentToast,
    showToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Render note delete toast at provider level - persists when notes unmount */}
      <NoteToastComponent />
      {/* Render comment delete toast at provider level (devotion) */}
      <CommentToastComponent />
      {/* Render session comment delete toast at provider level (plans) */}
      <SessionCommentToastComponent />
      {/* Render generic toast */}
      <DelightfulToast
        config={toastConfig}
        onHide={() => setToastConfig(null)}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
