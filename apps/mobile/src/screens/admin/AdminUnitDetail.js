import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, StatusBar, Modal, FlatList,
  Image, Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_ROUTES, formatPeso, formatDate } from '@upahan/shared';
import api, { BASE_URL } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import { COLORS } from '../../constants/colors';

const TEAL = COLORS.landlordPrimary;
const GOLD = COLORS.goldAccent;

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function AdminUnitDetail({ route, navigation }) {
  const { unitId } = route.params;
  const [unit, setUnit]         = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModal, setAssignModal]   = useState(false);
  const [unassigned, setUnassigned]     = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assigning, setAssigning]       = useState(false);
  const [documents, setDocuments]       = useState([]);
  const [rejectModal, setRejectModal]   = useState({ visible: false, docId: null });
  const [rejectReason, setRejectReason] = useState('');

  const intervalRef = useRef(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [unitRes, payRes, docsRes] = await Promise.all([
        api.get(API_ROUTES.unitById(unitId)),
        api.get(API_ROUTES.paymentsForUnit(unitId)),
        api.get(API_ROUTES.documentsForUnit(unitId)).catch(() => ({ data: { data: [] } })),
      ]);
      setUnit(unitRes.data.data);
      setPayments((payRes.data.data || []).slice(0, 5));
      setDocuments(docsRes.data.data || []);
    } catch {}
    if (!silent) setLoading(false);
    setRefreshing(false);
  }, [unitId]);

  useFocusEffect(useCallback(() => {
    fetchAll(false);
    intervalRef.current = setInterval(() => fetchAll(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]));

  const handleRemoveTenant = () => {
    Alert.alert('Remove Tenant', 'Are you sure you want to remove the current tenant?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.put(API_ROUTES.unitRemoveTenant(unitId));
            fetchAll();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to remove tenant.');
          }
        },
      },
    ]);
  };

  const openAssignModal = async () => {
    try {
      const res = await api.get(API_ROUTES.UNASSIGNED_TENANTS);
      setUnassigned(res.data.data || []);
    } catch {
      setUnassigned([]);
    }
    setSelectedUser(null);
    setAssignModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedUser) return;
    setAssigning(true);
    try {
      await api.post(API_ROUTES.TENANTS, { userId: selectedUser.user_id, unitId });
      setAssignModal(false);
      await fetchAll();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to assign tenant.');
    }
    setAssigning(false);
  };

  const handleVerifyId = (docId) => {
    Alert.alert('Verify ID', 'Mark this ID as verified?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Verify', onPress: async () => {
          try {
            await api.put(API_ROUTES.documentVerify(docId));
            fetchAll(true);
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to verify.');
          }
        },
      },
    ]);
  };

  const handleRejectId = (docId) => {
    setRejectReason('');
    setRejectModal({ visible: true, docId });
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a rejection reason.');
      return;
    }
    try {
      await api.put(API_ROUTES.documentReject(rejectModal.docId), { rejection_reason: rejectReason.trim() });
      setRejectModal({ visible: false, docId: null });
      fetchAll(true);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={TEAL} />
        <ActivityIndicator color={TEAL} style={{ marginTop: 60 }} size="large" />
      </SafeAreaView>
    );
  }
  if (!unit) return null;

  const tenant = unit.tenant_user_id ? {
    first_name:   unit.first_name,
    last_name:    unit.last_name,
    email:        unit.tenant_email,
    phone_number: unit.tenant_phone,
  } : null;
  const idDoc   = documents.find(d => d.document_type === 'valid_id');
  const contract = documents.find(d => d.document_type === 'contract');

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerLabel}>UNIT DETAILS</Text>
          <Text style={s.headerTitle}>{unit.unit_code}</Text>
        </View>
        <StatusBadge status={unit.vacancy_status} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(true); }}
            tintColor={TEAL}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Price card — overlaps header */}
        <View style={s.priceCard}>
          <View style={s.priceRow}>
            <View>
              <Text style={s.priceLabel}>MONTHLY RENT</Text>
              <Text style={s.price}>{formatPeso(unit.monthly_price)}</Text>
            </View>
            <TouchableOpacity
              style={s.editUnitLink}
              onPress={() => navigation.navigate('AdminEditUnit', { unit })}
            >
              <Ionicons name="pencil-outline" size={14} color={TEAL} />
              <Text style={s.editUnitText}>EDIT UNIT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Unit info card */}
        <Text style={s.secLabel}>UNIT INFO</Text>
        <View style={s.card}>
          {unit.floor_plan  && <Row label="Floor Plan"  value={unit.floor_plan} />}
          {unit.location    && <Row label="Location"    value={unit.location} />}
          {unit.bedrooms    && <Row label="Bedrooms"    value={unit.bedrooms} />}
          <Row label="Due Day" value={`${ordinal(unit.due_day || 5)} of every month`} />
          {unit.description && <Row label="Description" value={unit.description} />}
        </View>

        {/* Current Tenant */}
        <Text style={s.secLabel}>CURRENT TENANT</Text>
        <View style={s.card}>
          {tenant ? (
            <>
              <View style={s.tenantRow}>
                <View style={s.tenantAvatar}>
                  <Text style={s.tenantAvatarText}>
                    {`${tenant.first_name?.[0] || ''}${tenant.last_name?.[0] || ''}`.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.tenantName}>{tenant.first_name} {tenant.last_name}</Text>
                  <Text style={s.tenantEmail}>{tenant.email}</Text>
                </View>
              </View>
              {unit.lease_start_date && <Row label="Lease Start" value={formatDate(unit.lease_start_date, 'medium')} />}
              {unit.lease_end_date   && <Row label="Lease End"   value={formatDate(unit.lease_end_date,   'medium')} />}
              <TouchableOpacity style={s.removeBtn} onPress={handleRemoveTenant}>
                <Ionicons name="person-remove-outline" size={16} color={COLORS.dangerPrimary} />
                <Text style={s.removeBtnText}>REMOVE TENANT</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.assignBtn} onPress={openAssignModal}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={s.assignBtnText}>ASSIGN TENANT</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tenant Documents */}
        {tenant && (
          <>
            <Text style={s.secLabel}>TENANT DOCUMENTS</Text>
            <View style={s.card}>

              {/* Valid ID */}
              <View style={s.docCardHeader}>
                <View style={[s.docIcon, { backgroundColor: COLORS.landlordLight }]}>
                  <Ionicons name="id-card-outline" size={18} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>Valid ID</Text>
                  {idDoc?.id_type && <Text style={s.docSubtext}>{idDoc.id_type}</Text>}
                </View>
                {idDoc
                  ? <StatusBadge status={idDoc.status} />
                  : <Text style={s.docEmpty}>Not submitted</Text>
                }
              </View>

              {idDoc ? (
                <>
                  {(idDoc.front_image || idDoc.back_image) && (
                    <View style={s.idImagesRow}>
                      {idDoc.front_image && (
                        <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}/uploads/documents/${idDoc.front_image}`)}>
                          <Image source={{ uri: `${BASE_URL}/uploads/documents/${idDoc.front_image}` }} style={s.idImage} />
                          <Text style={s.idImageLabel}>Front</Text>
                        </TouchableOpacity>
                      )}
                      {idDoc.back_image && (
                        <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}/uploads/documents/${idDoc.back_image}`)}>
                          <Image source={{ uri: `${BASE_URL}/uploads/documents/${idDoc.back_image}` }} style={s.idImage} />
                          <Text style={s.idImageLabel}>Back</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {idDoc.status === 'under_review' && (
                    <View style={s.docActions}>
                      <TouchableOpacity style={s.verifyBtn} onPress={() => handleVerifyId(idDoc.document_id)}>
                        <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                        <Text style={s.verifyBtnText}>VERIFY</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => handleRejectId(idDoc.document_id)}>
                        <Ionicons name="close-circle-outline" size={15} color={COLORS.dangerPrimary} />
                        <Text style={s.rejectBtnText}>REJECT</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {idDoc.status === 'rejected' && idDoc.rejection_reason && (
                    <View style={s.rejectionBox}>
                      <Ionicons name="alert-circle-outline" size={14} color={COLORS.dangerPrimary} />
                      <Text style={s.rejectionText}>Reason: {idDoc.rejection_reason}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={s.docNotSubmitted}>No ID submitted yet.</Text>
              )}

              <View style={s.docDivider} />

              {/* Lease Contract */}
              <View style={[s.docCardHeader, { marginTop: 8 }]}>
                <View style={[s.docIcon, { backgroundColor: COLORS.landlordLight }]}>
                  <Ionicons name="document-text-outline" size={18} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>Lease Contract</Text>
                  {contract?.contract_start_date && (
                    <Text style={s.docSubtext}>
                      {formatDate(contract.contract_start_date, 'medium')}
                      {' – '}
                      {contract.contract_end_date ? formatDate(contract.contract_end_date, 'medium') : 'Ongoing'}
                    </Text>
                  )}
                </View>
                {contract
                  ? <StatusBadge status="verified" />
                  : <Text style={s.docEmpty}>Not uploaded</Text>
                }
              </View>

              {contract?.contract_file && (
                <TouchableOpacity
                  style={s.viewContractBtn}
                  onPress={() => Linking.openURL(`${BASE_URL}/uploads/documents/${contract.contract_file}`)}
                >
                  <Ionicons name="open-outline" size={15} color={TEAL} />
                  <Text style={s.viewContractText}>VIEW / DOWNLOAD CONTRACT</Text>
                </TouchableOpacity>
              )}

            </View>
          </>
        )}

        {/* Recent Payments */}
        {payments.length > 0 && (
          <>
            <Text style={s.secLabel}>RECENT PAYMENTS</Text>
            <View style={s.card}>
              {payments.map((p, i) => (
                <View key={p.payment_id} style={[s.payRow, i < payments.length - 1 && s.payRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.payMonth}>{p.month_covered}</Text>
                    <Text style={s.payDate}>{formatDate(p.payment_date, 'medium')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.payAmount}>{formatPeso(p.amount)}</Text>
                    <StatusBadge status={p.payment_status} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={assignModal} animationType="slide" transparent onRequestClose={() => setAssignModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Tenant</Text>
              <TouchableOpacity onPress={() => setAssignModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {unassigned.length === 0 ? (
              <Text style={s.modalEmpty}>No unassigned tenants found.</Text>
            ) : (
              <FlatList
                data={unassigned}
                keyExtractor={u => String(u.user_id)}
                style={s.modalList}
                renderItem={({ item }) => {
                  const selected = selectedUser?.user_id === item.user_id;
                  return (
                    <TouchableOpacity
                      style={[s.tenantItem, selected && s.tenantItemSelected]}
                      onPress={() => setSelectedUser(item)}
                    >
                      <View style={[s.tenantItemAvatar, selected && { backgroundColor: TEAL }]}>
                        <Text style={[s.tenantItemInitials, selected && { color: '#fff' }]}>
                          {`${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tenantItemName}>{item.first_name} {item.last_name}</Text>
                        <Text style={s.tenantItemEmail}>{item.email}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={20} color={TEAL} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={[s.modalConfirmBtn, (!selectedUser || assigning) && { opacity: 0.5 }]}
              onPress={handleConfirmAssign}
              disabled={!selectedUser || assigning}
            >
              {assigning
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.modalConfirmText}>CONFIRM ASSIGNMENT</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Reject ID Modal */}
      <Modal
        visible={rejectModal.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setRejectModal({ visible: false, docId: null })}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: 320 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Reject ID</Text>
              <TouchableOpacity onPress={() => setRejectModal({ visible: false, docId: null })}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={s.rejectModalSub}>Enter a reason for rejecting this ID:</Text>
            <TextInput
              style={s.rejectInput}
              placeholder="e.g. Image is blurry or unclear"
              placeholderTextColor={COLORS.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[s.modalConfirmBtn, { backgroundColor: COLORS.dangerPrimary, marginTop: 12 }]}
              onPress={confirmReject}
            >
              <Text style={s.modalConfirmText}>CONFIRM REJECTION</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, backgroundColor: TEAL,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#fff' },
  scroll:    { paddingBottom: 40 },

  priceCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginHorizontal: 20, marginTop: -16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  priceRow:   { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceLabel: { fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1.5, marginBottom: 4 },
  price:      { fontSize: 32, fontWeight: '700', fontFamily: 'Inter_700Bold', color: COLORS.textPrimary },
  editUnitLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  editUnitText: { fontSize: 12, fontWeight: '700', color: TEAL, letterSpacing: 0.5 },

  secLabel: {
    fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1.5,
    marginLeft: 20, marginBottom: 8, marginTop: 16,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginHorizontal: 20, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary },
  rowValue: { fontSize: 13, color: COLORS.textPrimary, maxWidth: '60%', textAlign: 'right' },

  tenantRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  tenantAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.landlordLight, alignItems: 'center', justifyContent: 'center' },
  tenantAvatarText:{ fontSize: 14, fontWeight: '700', color: TEAL },
  tenantName:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  tenantEmail:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  noTenant:        { fontSize: 14, color: COLORS.textSecondary },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16,
    marginTop: 12, alignSelf: 'flex-start',
  },
  removeBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.dangerPrimary },

  docDivider:{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 8 },
  docIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  docTitle:      { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  docSubtext:    { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  docEmpty:      { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' },
  docNotSubmitted: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8, fontStyle: 'italic' },
  idImagesRow:   { flexDirection: 'row', gap: 12, marginBottom: 12 },
  idImage:       { width: 120, height: 80, borderRadius: 8, backgroundColor: COLORS.pageBg },
  idImageLabel:  { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 3 },
  docActions:    { flexDirection: 'row', gap: 10, marginBottom: 8 },
  verifyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: TEAL, borderRadius: 999, height: 40,
  },
  verifyBtnText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.dangerLight, borderRadius: 999, height: 40,
    borderWidth: 1, borderColor: COLORS.dangerPrimary,
  },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.dangerPrimary, letterSpacing: 0.5 },
  rejectionBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.dangerLight, borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.dangerPrimary,
  },
  rejectionText: { flex: 1, fontSize: 12, color: COLORS.dangerPrimary },
  viewContractBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.landlordLight, borderRadius: 999, height: 40,
    borderWidth: 1.5, borderColor: TEAL, justifyContent: 'center', marginTop: 4,
  },
  viewContractText: { fontSize: 12, fontWeight: '700', color: TEAL, letterSpacing: 0.5 },
  rejectModalSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
  rejectInput: {
    borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: 10,
    padding: 12, fontSize: 13, color: COLORS.textPrimary, minHeight: 80,
    textAlignVertical: 'top',
  },

  payRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  payMonth:     { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  payDate:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  payAmount:    { fontSize: 14, fontWeight: '700', color: TEAL },

  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TEAL, borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  assignBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalEmpty:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginVertical: 24 },
  modalList:    { maxHeight: 320 },
  tenantItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tenantItemSelected:  { backgroundColor: COLORS.landlordLight, borderRadius: 12, paddingHorizontal: 8 },
  tenantItemAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.landlordLight, alignItems: 'center', justifyContent: 'center',
  },
  tenantItemInitials: { fontSize: 13, fontWeight: '700', color: TEAL },
  tenantItemName:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  tenantItemEmail:    { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  modalConfirmBtn: {
    backgroundColor: TEAL, height: 52, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
});
