import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMockProfileKey } from '../supabase';

/**
 * useSubscription Hook
 * Centrally manages subscription tiers, feature gating, and quotas across FarmPro.
 * Automatically synchronizes with localStorage & cross-component updates.
 */
export function useSubscription(userProp = null) {
  const [profile, setProfile] = useState(() => {
    if (userProp) return userProp;
    try {
      const stored = localStorage.getItem(getMockProfileKey()) || localStorage.getItem('farmpro_profile');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  // Keep state updated when userProp changes
  useEffect(() => {
    if (userProp) setProfile(userProp);
  }, [userProp]);

  // Listen to profile updates (cross-tab and within-tab)
  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const stored = localStorage.getItem(getMockProfileKey()) || localStorage.getItem('farmpro_profile');
        if (stored) setProfile(JSON.parse(stored));
      } catch (e) {}
    };

    window.addEventListener('farmpro_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('farmpro_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  const subscriptionInfo = useMemo(() => {
    const role = (profile?.role || 'buyer').toLowerCase();
    const isSeller = role === 'seller';
    const isBuyer = role === 'buyer' || role === 'clerk' || role === 'drc_lab';

    const rawTier = (profile?.subscription_tier || profile?.plan_id || profile?.subscription_plan || 'free').toLowerCase();

    // Check expiration
    const expiryDate = profile?.subscription_expiry_date ? new Date(profile.subscription_expiry_date) : null;
    const isExpired = expiryDate ? expiryDate < new Date() : false;

    // Normalizing tier (fallback to free if expired)
    // For sellers: sellers only have free or pro (Pro Farmer). If a seller has standard or pro, normalize to pro.
    let normalizedTier = 'free';
    if (isSeller) {
      normalizedTier = (rawTier === 'pro' || rawTier === 'standard' || rawTier === 'seller_pro') ? 'pro' : 'free';
    } else {
      normalizedTier = ['pro', 'standard', 'free'].includes(rawTier) ? rawTier : 'free';
    }
    const effectiveTier = isExpired ? 'free' : normalizedTier;

    const rawPlanType = profile?.plan_type || (isSeller ? (effectiveTier === 'pro' ? 'seller_pro' : 'seller_free') : (effectiveTier === 'pro' ? 'buyer_pro' : (effectiveTier === 'standard' ? 'buyer_standard' : 'buyer_free')));

    const isPro = effectiveTier === 'pro';
    const isStandard = effectiveTier === 'standard';
    const isFree = effectiveTier === 'free';

    // Limits & Quotas
    const maxPlots = isSeller ? (isPro ? Infinity : 2) : Infinity;
    const monthlyBillQuota = isBuyer ? (isFree ? 150 : Infinity) : Infinity;
    const storageLimitMb = profile?.storage_limit_mb || (
      isSeller ? (isPro ? 2000 : 100) : (isPro ? 10240 : (isStandard ? 2048 : 200))
    );

    // Feature Access
    const hasPnlFullAccess = isSeller ? isPro : (isStandard || isPro);
    const hasMultiStaffPin = isBuyer && isPro;
    const hasExportAccess = isSeller ? isPro : (isStandard || isPro);
    const hasUnlimitedSlips = isSeller ? isPro : true;

    // Plan Labels
    let planLabel = 'ฟรี (Free)';
    if (isSeller) {
      planLabel = isPro ? 'ชาวสวนมืออาชีพ (Pro Farmer)' : 'ฟรี (Free)';
    } else {
      if (isPro) planLabel = 'ลานมืออาชีพ (Pro Business)';
      else if (isStandard) planLabel = 'ลานมาตรฐาน (Standard)';
      else planLabel = 'เริ่มต้น (Starter Free)';
    }

    return {
      profile,
      role,
      tier: effectiveTier,
      planType: rawPlanType,
      billingCycle: profile?.billing_cycle || (isFree ? 'none' : 'monthly'),
      expiryDate,
      isExpired,
      isSeller,
      isBuyer,
      isPro,
      isStandard,
      isFree,
      maxPlots,
      monthlyBillQuota,
      storageLimitMb,
      hasPnlFullAccess,
      hasMultiStaffPin,
      hasExportAccess,
      hasUnlimitedSlips,
      planLabel
    };
  }, [profile]);

  // Quota validation helpers
  const checkPlotLimit = useCallback((currentPlotCount) => {
    if (subscriptionInfo.isSeller && subscriptionInfo.isFree && currentPlotCount >= 2) {
      return {
        allowed: false,
        max: 2,
        message: 'แพ็กเกจฟรี (Free) สามารถจัดการแปลงสวนได้สูงสุด 2 แปลง กรุณาอัปเกรดเป็นแพ็กเกจ "Pro Farmer" (฿99/เดือน) เพื่อจัดการแปลงสวนได้ไม่จำกัด!'
      };
    }
    return { allowed: true, max: subscriptionInfo.maxPlots, message: '' };
  }, [subscriptionInfo]);

  const checkBillQuota = useCallback((monthlyCount) => {
    if (subscriptionInfo.isBuyer && subscriptionInfo.isFree && monthlyCount >= 150) {
      return {
        allowed: false,
        quota: 150,
        message: 'คุณใช้งานโควตาออกบิลสำหรับแพ็กเกจฟรีครบ 150 บิลในเดือนนี้แล้ว กรุณาอัปเกรดเป็นแพ็กเกจ "Standard" (฿199/เดือน) เพื่อออกบิลได้ไม่จำกัด!'
      };
    }
    return { allowed: true, quota: subscriptionInfo.monthlyBillQuota, message: '' };
  }, [subscriptionInfo]);

  return {
    ...subscriptionInfo,
    checkPlotLimit,
    checkBillQuota
  };
}

export default useSubscription;
