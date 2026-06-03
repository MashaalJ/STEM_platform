/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, User, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { authFetch } from '../app/api';
import type { Student } from '../app/types';
const SettingsModal = ({
  student,
  setStudent,
  onClose,
}: {
  student: Student;
  setStudent: (s: Student | null) => void;
  onClose: () => void;
}) => {
  const isTeacher = student.role === 'teacher' || student.role === 'admin';
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [profileForm, setProfileForm] = useState({
    name: student.name,
    avatar_url: student.avatar_url || '',
    age: student.age ?? '',
    grade: student.grade || '',
    school: student.school || '',
    city: student.city || '',
    email: student.email || '',
    parent_email: student.parent_email || '',
    contact_number: student.contact_number || '',
  });
  useEffect(() => {
    setProfileForm({
      name: student.name,
      avatar_url: student.avatar_url || '',
      age: student.age ?? '',
      grade: student.grade || '',
      school: student.school || '',
      city: student.city || '',
      email: student.email || '',
      parent_email: student.parent_email || '',
      contact_number: student.contact_number || '',
    });
  }, [student.id, student.name, student.avatar_url, student.age, student.grade, student.school, student.city, student.email, student.parent_email, student.contact_number]);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const res = await authFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          avatar_url: profileForm.avatar_url || undefined,
          age: profileForm.age === '' ? undefined : Number(profileForm.age),
          grade: profileForm.grade || undefined,
          school: profileForm.school || undefined,
          city: profileForm.city || undefined,
          email: profileForm.email || undefined,
          parent_email: profileForm.parent_email || undefined,
          contact_number: profileForm.contact_number || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setStudent(data.user);
        setProfileMessage({ type: 'success', text: 'Profile updated.' });
      } else {
        setProfileMessage({ type: 'error', text: data.message || 'Update failed.' });
      }
    } catch {
      setProfileMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setSavingPassword(true);
    try {
      if (supabase) {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
          if (error) {
            setPasswordMessage({ type: 'error', text: error.message || 'Change failed.' });
          } else {
            setPasswordForm({ current: '', new: '', confirm: '' });
            setPasswordMessage({ type: 'success', text: 'Password updated for your account.' });
          }
          setSavingPassword(false);
          return;
        }
      }
      const res = await authFetch('/api/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.new,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordForm({ current: '', new: '', confirm: '' });
        setPasswordMessage({ type: 'success', text: 'Password changed.' });
      } else {
        setPasswordMessage({ type: 'error', text: data.message || 'Change failed.' });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="cosmic-modal-overlay absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="cosmic-modal relative w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="cosmic-inverse flex items-center justify-between p-6 border-b border-[rgba(118,132,159,0.35)] bg-[var(--ca-primary-container)]">
          <h2 className="cosmic-page-heading text-xl mb-0 text-[var(--ca-inverse-on-surface)]">Settings</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-[var(--ca-radius)] text-[var(--ca-on-primary-container)] hover:text-[var(--ca-secondary-container)] hover:bg-[rgba(255,255,255,0.06)] transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex border-b border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)]">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 cosmic-page-sub text-[10px] transition-colors ${activeTab === 'profile' ? 'text-[var(--ca-on-secondary-container)] border-b-2 border-[var(--ca-secondary-container)] bg-[var(--ca-secondary-fixed)]/30' : 'text-[var(--ca-on-surface-variant)] hover:text-[var(--ca-on-surface)]'}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 cosmic-page-sub text-[10px] transition-colors ${activeTab === 'password' ? 'text-[var(--ca-on-secondary-container)] border-b-2 border-[var(--ca-secondary-container)] bg-[var(--ca-secondary-fixed)]/30' : 'text-[var(--ca-on-surface-variant)] hover:text-[var(--ca-on-surface)]'}`}
          >
            Password
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMessage && (
                <p className={`text-sm font-semibold ${profileMessage.type === 'success' ? 'text-[var(--ca-on-tertiary-container)]' : 'text-[var(--ca-error)]'}`}>
                  {profileMessage.text}
                </p>
              )}
              <div>
                <label className="cosmic-label" htmlFor="settings-display-name">Display name</label>
                <input
                  id="settings-display-name"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-avatar-url">Profile photo URL</label>
                <input
                  id="settings-avatar-url"
                  value={profileForm.avatar_url}
                  onChange={e => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="https://..."
                />
              </div>
              {isTeacher && student.school_record_name && (
                <div>
                  <span className="cosmic-label">Linked school</span>
                  <p className="mt-1 text-sm text-[var(--ca-on-surface)]">{student.school_record_name}</p>
                </div>
              )}
              {!isTeacher && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="cosmic-label" htmlFor="settings-age">Age</label>
                  <input
                    id="settings-age"
                    type="number"
                    value={profileForm.age}
                    onChange={e => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="cosmic-input text-sm"
                  />
                </div>
                <div>
                  <label className="cosmic-label" htmlFor="settings-grade">Grade level</label>
                  <input
                    id="settings-grade"
                    value={profileForm.grade}
                    onChange={e => setProfileForm({ ...profileForm, grade: e.target.value })}
                    className="cosmic-input text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-school">School name (free text)</label>
                {student.school_record_name ? (
                  <p className="mt-1 text-sm text-slate-300 font-medium">{student.school_record_name}</p>
                ) : (
                <input
                  id="settings-school"
                  value={profileForm.school}
                  onChange={e => setProfileForm({ ...profileForm, school: e.target.value })}
                  className="cosmic-input text-sm"
                />
                )}
              </div>
              <div>
                <label className="cosmic-label">City</label>
                <input
                  value={profileForm.city}
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-email">Email address</label>
                <input
                  id="settings-email"
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-parent-email">Parent / guardian email</label>
                <input
                  id="settings-parent-email"
                  type="email"
                  value={profileForm.parent_email}
                  onChange={e => setProfileForm({ ...profileForm, parent_email: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-contact">Contact phone</label>
                <input
                  id="settings-contact"
                  value={profileForm.contact_number}
                  onChange={e => setProfileForm({ ...profileForm, contact_number: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              </>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="cosmic-btn-primary disabled:opacity-50"
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          )}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage && (
                <p className={`text-sm font-semibold ${passwordMessage.type === 'success' ? 'text-[var(--ca-on-tertiary-container)]' : 'text-[var(--ca-error)]'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <div>
                <label className="cosmic-label" htmlFor="settings-current-password">Current password</label>
                <input
                  id="settings-current-password"
                  type="password"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-new-password">New password</label>
                <input
                  id="settings-new-password"
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="cosmic-label" htmlFor="settings-confirm-password">Confirm new password</label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="cosmic-btn-primary disabled:opacity-50"
              >
                {savingPassword ? 'Updating…' : 'Change password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
export default SettingsModal;
