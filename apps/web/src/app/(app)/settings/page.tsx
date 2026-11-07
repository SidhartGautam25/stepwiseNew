'use client';

import React, { useEffect, useState } from 'react';
import {
  useProfile,
  useUpdateProfile,
  usePreferences,
  useUpdatePreferences,
} from '@/hooks/use-profile';
import { changePassword, ApiError } from '@/utils/auth/client';
import { NeoButton } from '@/components/ui/NeoButton';

export default function SettingsPage() {
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  const { data: preferences } = usePreferences();
  const updatePreferencesMutation = useUpdatePreferences();

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Preferences Form State
  const [defaultLevel, setDefaultLevel] = useState('beginner');
  const [defaultLanguage, setDefaultLanguage] = useState('typescript');
  const [theme, setTheme] = useState('dark');
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setDefaultLevel(preferences.defaultLevel || 'beginner');
      setDefaultLanguage(preferences.defaultLanguage || 'typescript');
      setTheme(preferences.theme || 'dark');
    }
  }, [preferences]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    await updateProfileMutation.mutateAsync({ displayName, avatarUrl });
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const handlePrefsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSuccess(false);
    await updatePreferencesMutation.mutateAsync({ defaultLevel, defaultLanguage, theme });
    setPrefsSuccess(true);
    setTimeout(() => setPrefsSuccess(false), 3000);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters.');
      return;
    }

    setPwdSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 4000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setPwdError(err.message || 'Failed to update password.');
      } else {
        setPwdError('Error changing password. Please verify current password.');
      }
    } finally {
      setPwdSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-mono font-black text-2xl sm:text-3xl text-black uppercase tracking-tight">
          Account Settings
        </h1>
        <p className="font-mono text-sm text-zinc-600 mt-1">
          Manage your profile identity, workshop preferences, and account security.
        </p>
      </div>

      {/* 1. Profile Information */}
      <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000]">
        <h2 className="font-mono font-bold text-lg uppercase text-black mb-4 pb-2 border-b-2 border-black">
          Profile Details
        </h2>

        {profileSuccess && (
          <div className="mb-4 p-3 bg-green-50 border-2 border-green-600 text-xs font-mono font-bold text-green-800">
            ✓ Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
              Avatar URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
            />
          </div>

          <NeoButton
            type="submit"
            variant="yellow"
            size="md"
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
          </NeoButton>
        </form>
      </div>

      {/* 2. Preferences */}
      <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000]">
        <h2 className="font-mono font-bold text-lg uppercase text-black mb-4 pb-2 border-b-2 border-black">
          Workshop Preferences
        </h2>

        {prefsSuccess && (
          <div className="mb-4 p-3 bg-green-50 border-2 border-green-600 text-xs font-mono font-bold text-green-800">
            ✓ Preferences saved!
          </div>
        )}

        <form onSubmit={handlePrefsSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
                Default Level
              </label>
              <select
                value={defaultLevel}
                onChange={(e) => setDefaultLevel(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
                Default Language
              </label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
              >
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="rust">Rust</option>
                <option value="go">Go</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
                Editor Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          <NeoButton
            type="submit"
            variant="yellow"
            size="md"
            disabled={updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </NeoButton>
        </form>
      </div>

      {/* 3. Password Security */}
      <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000]">
        <h2 className="font-mono font-bold text-lg uppercase text-black mb-4 pb-2 border-b-2 border-black">
          Change Password
        </h2>

        {pwdSuccess && (
          <div className="mb-4 p-3 bg-green-50 border-2 border-green-600 text-xs font-mono font-bold text-green-800">
            ✓ Password updated successfully!
          </div>
        )}

        {pwdError && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-xs font-mono font-bold text-red-700">
            {pwdError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
              />
            </div>
          </div>

          <NeoButton
            type="submit"
            variant="yellow"
            size="md"
            disabled={pwdSubmitting}
          >
            {pwdSubmitting ? 'Updating...' : 'Update Password'}
          </NeoButton>
        </form>
      </div>
    </div>
  );
}
