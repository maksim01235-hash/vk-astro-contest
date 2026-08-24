/**
 * src/app/admin/stats/page.tsx — страница статистики.
 *
 * Добавлено: кнопка "Отправить лог" (AdminLogButton) в шапке.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { sheetsApi } from '@/lib/sheets/api.client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { AdminLogButton } from '@/components/admin/AdminLogButton';
import { RefreshRepostsButton } from '@/components/admin/RefreshRepostsButton';
import { STORAGE_ADMIN_AUTH } from '@/constants';
import { getRaw } from '@/utils/storage';
import type { CardStat } from '@/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function StatsPage() {
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<CardStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [subscribedGroupCount, setSubscribedGroupCount] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const isAuthed = getRaw<boolean>(STORAGE_ADMIN_AUTH);
    setAuthed(!!isAuthed);
  }, []);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const data = await sheetsApi.getStats();
        setStats(data);
        if (data.length > 0) {
          setSubscribedCount(data[0].subscribed_count);
          setSubscribedGroupCount(data[0].subscribed_group_count);
        }
      } catch (e) {
        toast.error('Не удалось загрузить статистику');
      } finally {
        setLoading(false);
      }
    })();
  }, [authed, toast]);

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="card-surface max-w-md text-center">
          <p className="text-slate-600 mb-4">Доступно только из админ-панели.</p>
          <Link href="/admin" className="btn-primary">Войти в админку</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Статистика</h1>
          <div className="flex items-center gap-2">
            <AdminLogButton page="admin/stats" />
            <RefreshRepostsButton />
          </div>
        </div>
        <div className="card-surface text-center text-slate-500">
          Пока нет данных. Ответы появятся после участия пользователей.
        </div>
      </div>
    );
  }

  const pctData = stats.map((s) => ({
    name: s.title.slice(0, 20),
    'Процент (%)': s.pct_answered,
  }));

  const answersData = stats.map((s) => ({
    name: s.title.slice(0, 20),
    Ответы: s.total_answers,
  }));

  const deltaData = stats.map((s) => ({
    name: s.title.slice(0, 20),
    'Среднее (с)': s.avg_delta,
  }));

  const repostData = stats.map((s) => ({
    name: s.title.slice(0, 20),
    value: s.reposted_count,
  }));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Статистика</h1>
        <div className="flex items-center gap-2">
          <AdminLogButton page="admin/stats" />
          <RefreshRepostsButton />
          <Link href="/admin" className="btn-secondary text-sm">← К конструктору</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="card-surface">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Подписавшиеся на уведомления
          </h3>
          <p className="text-3xl font-bold text-accent">{subscribedCount}</p>
        </div>
        <div className="card-surface">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Подписавшиеся на группу VK
          </h3>
          <p className="text-3xl font-bold text-accent">{subscribedGroupCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            Среди участников конкурса (через groups.isMember)
          </p>
        </div>
      </div>

      <div className="card-surface mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Процент ответивших (от числа пользователей, %)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={pctData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Процент (%)" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-surface mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Количество ответов по карточкам</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={answersData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Ответы" fill="#3B82F6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-surface mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Среднее время решения (секунды)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={deltaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Среднее (с)" fill="#10B981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-surface">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Репосты по карточкам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={repostData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {repostData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}