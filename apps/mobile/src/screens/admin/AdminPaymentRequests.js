import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, StatusBar,
  Image, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_ROUTES, formatPeso, formatDate } from '@upahan/shared';
import api, { BASE_URL } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingScreen from '../../components/LoadingScreen';
import { COLORS } from '../../constants/colors';

const TEAL   = COLORS.landlordPrimary;
const GOLD   = COLORS.goldAccent;
const ORANGE = '#E07B39';

const AVATAR_COLORS = ['#277571', '#4A90D9', '#E67E22', '#8E44AD', '#C0392B'];

const REJECTION_REASONS = [
  'Proof of payment is unclear or unreadable',
  'Wrong payment amount',
  'Duplicate submission',
  'Invalid or missing reference number',
  'Payment not reflected in records',
  'Wrong month covered',
  'Other',
];

export default function AdminPaymentRequests({ navigation }) {
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(null);

  const [rejectModal, setRejectModal]   = useState({ visible: false, payment: null });
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [rejectError, setRejectError]   = useState('');
  const [expandedImage, setExpandedImage] = useState(null);

  const intervalRef = useRef(null);

  const fetchPayments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(API_ROUTES.PAYMENT_PENDING);
      setPayments(res.data.data || []);
    } catch {}
    if (!silent) setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchPayments(false);
    intervalRef.current = setInterval(() => fetchPayments(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPayments]));

  const handleApprove = payment => {
    Alert.alert('Verify Payment', `Verify ${formatPeso(payment.amount)} from ${payment.tenant_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Verify',
        onPress: async () => {
          setProcessing(payment.payment_id);
          try {
            await api.put(API_ROUTES.paymentApprove(payment.payment_id));
            fetchPayments();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Approval failed.');
          }
          setProcessing(null);
        },
      },
    ]);
  };

  const handleReject = payment => {
    setRejectReason('');
    setCustomReason('');
    setRejectError('');
    setRejectModal({ visible: true, payment });
  };

  const confirmReject = async () => {
    const finalReason = rejectReason === 'Other' ? customReason.trim() : rejectReason;
    if (!finalReason) {
      setRejectError(rejectReason === 'Other' ? 'Please describe the reason.' : 'Please select a reason.');
      return;
    }
    const { payment } = rejectModal;
    setRejectModal({ visible: false, payment: null });
    setProcessing(payment.payment_id);
    try {
      await api.put(API_ROUTES.paymentReject(payment.payment_id), {
        rejectionReason: finalReason,
      });
      fetchPayments();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Rejection failed.');
    }
    setProcessing(null);
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL} />

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerLabel}>FINANCE</Text>
          <Text style={s.headerTitle}>Payment Requests</Text>
        </View>
        <View style={s.countBadge}>
          <Text style={s.countText}>{payments.length}</Text>
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={i => String(i.payment_id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPayments(true); }}
            tintColor={TEAL}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="checkmark-circle-outline" title="All clear!" message="No pending payment approvals." />
        }
        renderItem={({ item, index }) => {
          const isProcessing  = processing === item.payment_id;
          const initials      = item.tenant_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
          const avatarColor   = AVATAR_COLORS[index % AVATAR_COLORS.length];
          const proofImages   = (item.proof_images?.length > 0
            ? item.proof_images
            : item.proof_of_payment ? [item.proof_of_payment] : []
          ).map(p => `${BASE_URL}${p}`);
          return (
            <View style={s.card}>
              <View style={s.topBar} />
              <View style={s.cardInner}>
                {/* Top row: avatar + name + amount */}
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: avatarColor }]}>
                    <Text style={s.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tenantName}>{item.tenant_name || 'Unknown'}</Text>
                    <Text style={s.unitMeta}>Unit {item.unit_code} · {item.month_covered}</Text>
                    {item.is_late && (
                      <View style={s.lateBadge}>
                        <Text style={s.lateBadgeText}>LATE</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.amount}>{formatPeso(item.amount)}</Text>
                    {item.monthly_price ? (
                      <Text style={s.amountSub}>of {formatPeso(item.monthly_price)} monthly</Text>
                    ) : null}
                  </View>
                </View>

                {/* Details grid */}
                <View style={s.detailsGrid}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>TYPE</Text>
                    <Text style={s.detailValue}>{item.payment_type}</Text>
                  </View>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>METHOD</Text>
                    <Text style={s.detailValue}>{item.payment_method || 'N/A'}</Text>
                  </View>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>SUBMITTED</Text>
                    <Text style={s.detailValue}>{formatDate(item.payment_date, 'medium')}</Text>
                  </View>
                </View>
                {item.reference_number ? (
                  <View style={s.refRow}>
                    <Text style={s.refLabel}>REFERENCE</Text>
                    <Text style={s.refValue}>{item.reference_number}</Text>
                  </View>
                ) : null}
                <View style={s.monthRow}>
                  <Text style={s.refLabel}>MONTH COVERED</Text>
                  <Text style={s.refValue}>{item.month_covered}</Text>
                </View>

                {item.notes ? (
                  <Text style={s.notes} numberOfLines={2}>"{item.notes}"</Text>
                ) : null}

                {/* Proof of payment thumbnails */}
                {proofImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.proofStrip}>
                    {proofImages.map((uri, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={s.proofThumbWrap}
                        onPress={() => setExpandedImage(uri)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri }} style={s.proofThumb} resizeMode="cover" />
                        <View style={s.proofOverlay}>
                          <Ionicons name="expand-outline" size={14} color="#fff" />
                        </View>
                        {proofImages.length > 1 && (
                          <View style={s.proofIndexBadge}>
                            <Text style={s.proofIndexText}>{idx + 1}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={s.noProofRow}>
                    <Ionicons name="image-outline" size={14} color={COLORS.textMuted} />
                    <Text style={s.noProofText}>No proof of payment uploaded</Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.approveBtn, isProcessing && { opacity: 0.5 }]}
                    onPress={() => handleApprove(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={[s.btnLabel, { color: '#fff' }]}>VERIFY</Text>
                        </>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.rejectBtn, isProcessing && { opacity: 0.5 }]}
                    onPress={() => handleReject(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing
                      ? <ActivityIndicator size="small" color={COLORS.dangerPrimary} />
                      : <>
                          <Ionicons name="close" size={16} color={COLORS.dangerPrimary} />
                          <Text style={[s.btnLabel, { color: COLORS.dangerPrimary }]}>NOT VERIFY</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Reject reason modal */}
      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal({ visible: false, payment: null })}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Not Verify Payment</Text>
            {rejectModal.payment && (
              <Text style={s.modalSubtitle}>
                {rejectModal.payment.tenant_name} · {formatPeso(rejectModal.payment.amount)}
              </Text>
            )}
            <Text style={s.modalInputLabel}>Reason</Text>

            {REJECTION_REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                style={[s.reasonOption, rejectReason === reason && s.reasonOptionActive]}
                onPress={() => { setRejectReason(reason); setRejectError(''); }}
              >
                <View style={[s.radioCircle, rejectReason === reason && s.radioCircleActive]} />
                <Text style={[s.reasonOptionText, rejectReason === reason && { color: COLORS.dangerPrimary, fontWeight: '700' }]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            {rejectReason === 'Other' && (
              <TextInput
                style={s.reasonInput}
                placeholder="Describe the reason..."
                placeholderTextColor={COLORS.textMuted}
                value={customReason}
                onChangeText={t => { setCustomReason(t); setRejectError(''); }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}

            {!!rejectError && (
              <Text style={s.rejectErrorText}>{rejectError}</Text>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setRejectModal({ visible: false, payment: null })}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalRejectBtn} onPress={confirmReject}>
                <Text style={s.modalRejectText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen image viewer */}
      <Modal
        visible={!!expandedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <View style={s.imageOverlay}>
          <TouchableOpacity style={s.imageCloseBtn} onPress={() => setExpandedImage(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {expandedImage && (
            <Image
              source={{ uri: expandedImage }}
              style={s.imageFull}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TEAL, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#fff' },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  topBar:     { height: 4, backgroundColor: ORANGE },
  cardInner:  { padding: 16 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  tenantName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  unitMeta:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  amountSub:  { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 2 },
  amount:     { fontSize: 18, fontFamily: 'Inter_800ExtraBold', color: COLORS.textPrimary },
  detailsGrid:{ flexDirection: 'row', gap: 12, marginBottom: 10 },
  detailItem: { flex: 1 },
  detailLabel:{ fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 1, marginBottom: 2 },
  detailValue:{ fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textTransform: 'capitalize' },
  notes:      { fontSize: 13, color: COLORS.textPrimary, fontStyle: 'italic', marginBottom: 12, lineHeight: 18 },
  refRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  monthRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refLabel:   { fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 1 },
  refValue:   { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },

  proofStrip:     { flexDirection: 'row', marginBottom: 12 },
  proofThumbWrap: { position: 'relative', marginRight: 8, borderRadius: 10, overflow: 'hidden', height: 100, width: 100 },
  proofThumb:     { width: '100%', height: '100%' },
  proofOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 4,
  },
  proofIndexBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  proofIndexText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  noProofRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: COLORS.inputBg,
  },
  noProofText: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  lateBadge: {
    backgroundColor: '#FEF3EC', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 3,
  },
  lateBadgeText: { fontSize: 10, fontWeight: '700', color: '#E07B39', letterSpacing: 0.6 },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.dangerPrimary,
  },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 999, backgroundColor: TEAL,
  },
  btnLabel: { fontSize: 13, fontWeight: '700' },

  /* Reject modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20,
    padding: 24, maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle:      { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  modalSubtitle:   { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  modalInputLabel: { fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1, marginBottom: 8 },
  reasonOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.borderLight, marginBottom: 6,
    backgroundColor: '#fff',
  },
  reasonOptionActive: { borderColor: COLORS.dangerPrimary, backgroundColor: '#FFF5F5' },
  radioCircle: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.borderLight, backgroundColor: '#fff',
  },
  radioCircleActive: { borderColor: COLORS.dangerPrimary, backgroundColor: COLORS.dangerPrimary },
  reasonOptionText: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  reasonInput: {
    borderWidth: 1.5, borderColor: COLORS.inputBorder, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.inputBg, minHeight: 72, marginTop: 4, marginBottom: 8,
  },
  rejectErrorText: { fontSize: 12, color: COLORS.dangerPrimary, marginBottom: 10 },
  modalActions:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center',
  },
  modalCancelText:  { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  modalRejectBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: COLORS.dangerPrimary, alignItems: 'center',
  },
  modalRejectText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  /* Image viewer */
  imageOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageCloseBtn: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  imageFull: { width: '100%', height: '80%' },
});
