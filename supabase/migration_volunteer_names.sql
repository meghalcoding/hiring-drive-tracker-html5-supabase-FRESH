-- ============================================================================
-- Migration: add volunteer name assignment columns to settings
-- Run this ONCE in the Supabase SQL Editor on your EXISTING project
-- (schema.sql already includes these columns for brand-new installs).
--
-- V1 Reception · V2 HR Screening & LOI Stage · V3 Cabin 1 & 2 · V4 Cabin 3 & 4
-- V5 seated at WA1 · V6 floating / relief duty.
-- Leaving a name blank means the Volunteer screen falls back to "V1".."V6".
-- ============================================================================

alter table public.settings
  add column if not exists v1_name text,
  add column if not exists v2_name text,
  add column if not exists v3_name text,
  add column if not exists v4_name text,
  add column if not exists v5_name text,
  add column if not exists v6_name text;
