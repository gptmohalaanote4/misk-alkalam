import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { HadithCollection, SourceKind } from '../data/types';

export type Role = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
}

export class RemoteDisabledError extends Error {
  constructor() {
    super('لم يتم ضبط الاتصال بالخادم. راجع ملف ‎.env‎ في المشروع.');
    this.name = 'RemoteDisabledError';
  }
}

function client() {
  if (!supabase) throw new RemoteDisabledError();
  return supabase;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.session) throw new Error('تعذّر إنشاء الجلسة.');
  return data.session;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export interface NewScholar {
  name: string;
  slug: string;
  full_name?: string | null;
  era?: string | null;
  death_year_hijri?: number | null;
  bio?: string | null;
}

/**
 * إضافة عالم جديد — صلاحية أدمن فقط.
 * الحماية الحقيقية في قواعد RLS على الخادم؛ الواجهة تخفي الزر فقط.
 */
export async function createScholar(input: NewScholar): Promise<void> {
  const { error } = await client().from('scholars').insert({
    name: input.name.trim(),
    slug: input.slug.trim(),
    full_name: input.full_name?.trim() || null,
    era: input.era?.trim() || null,
    death_year_hijri: input.death_year_hijri ?? null,
    bio: input.bio?.trim() || null,
    is_active: true,
  });
  if (error) throw new Error(translateDbError(error.message));
}

export interface NewSource {
  name: string;
  slug: string;
  kind: SourceKind;
  base_url?: string | null;
  note?: string | null;
}

/**
 * إضافة مصدر غير «موقع تراث» — صلاحية أدمن فقط.
 * يفرضها الخادم عبر RLS، ولا يمكن تجاوزها من التطبيق.
 */
export async function createSource(input: NewSource): Promise<void> {
  const { error } = await client().from('sources').insert({
    name: input.name.trim(),
    slug: input.slug.trim(),
    kind: input.kind,
    base_url: input.base_url?.trim() || null,
    note: input.note?.trim() || null,
    is_builtin: false,
    is_default: false,
    is_active: true,
  });
  if (error) throw new Error(translateDbError(error.message));
}

export interface NewQuote {
  scholar_id: string;
  source_id: string;
  text: string;
  book: string;
  volume?: number | null;
  page?: number | null;
  source_url?: string | null;
  tags?: string[];
  publish: boolean;
}

/** إضافة مقولة — صلاحية أدمن فقط. */
export async function createQuote(input: NewQuote): Promise<void> {
  const page = input.page ?? null;
  const { error } = await client().from('quotes').insert({
    scholar_id: input.scholar_id,
    source_id: input.source_id,
    text: input.text.trim(),
    book: input.book.trim(),
    volume: input.volume ?? null,
    page,
    source_url: input.source_url?.trim() || null,
    tags: input.tags ?? [],
    needs_reference_check: page == null,
    status: input.publish ? 'published' : 'draft',
  });
  if (error) throw new Error(translateDbError(error.message));
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'البريد أو كلمة المرور غير صحيحة.';
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد البريد الإلكتروني بعد.';
  if (m.includes('network')) return 'تعذّر الاتصال بالخادم. تحقق من الإنترنت.';
  return message;
}

function translateDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('violates row-level')) {
    return 'هذه العملية مقصورة على الأدمن.';
  }
  if (m.includes('duplicate key')) return 'هذا المعرّف (slug) مستخدم من قبل.';
  return message;
}

/** توليد معرّف لاتيني مختصر من اسم عربي أو إنجليزي. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export interface NewHadith {
  collection: HadithCollection;
  text: string;
  narrator?: string | null;
  chapter?: string | null;
  number?: number | null;
  volume?: number | null;
  page?: number | null;
  source_id: string;
  topic?: string;
  publish: boolean;
}

/**
 * إضافة حديث — صلاحية أدمن فقط، ومقصورٌ على الصحيحين.
 * قيد CHECK في قاعدة البيانات يرفض أي مصدر آخر حتى لو تجاوزت الواجهة.
 */
export async function createHadith(input: NewHadith): Promise<void> {
  if (input.collection !== 'bukhari' && input.collection !== 'muslim') {
    throw new Error('الأحاديث مقصورة على صحيح البخاري وصحيح مسلم.');
  }
  const page = input.page ?? null;
  const { error } = await client().from('hadiths').insert({
    collection: input.collection,
    text: input.text.trim(),
    narrator: input.narrator?.trim() || null,
    chapter: input.chapter?.trim() || null,
    number: input.number ?? null,
    volume: input.volume ?? null,
    page,
    source_id: input.source_id,
    topic: input.topic?.trim() || 'فضائل الأعمال',
    needs_reference_check: page == null,
    status: input.publish ? 'published' : 'draft',
  });
  if (error) throw new Error(translateDbError(error.message));
}
