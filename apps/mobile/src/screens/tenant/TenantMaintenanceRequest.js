import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_ROUTES, MAINTENANCE_CATEGORIES } from '@upahan/shared';
import api from '../../api/client';
import { COLORS } from '../../constants/colors';

const BLUE = COLORS.tenantPrimary;
const GOLD = COLORS.goldAccent;

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: COLORS.textMuted },
  { value: 'medium', label: 'Medium', color: '#E07B39' },
  { value: 'high',   label: 'High',   color: COLORS.dangerPrimary },
];

const MAX_PHOTOS = 5;
const MIN_PHOTOS = 3;

export default function TenantMaintenanceRequest({ navigation }) {
  const [category, setCategory]   = useState('');
  const [subject, setSubject]     = useState('');
  const [description, setDesc]    = useState('');
  const [priority, setPriority]   = useState('');
  const [photos, setPhotos]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Required', 'Please allow access to your photo library.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets].slice(0, MAX_PHOTOS));
      setFieldErrors(prev => ({ ...prev, photos: undefined }));
    }
  };

  const removePhoto = (index) => setPhotos(ps => ps.filter((_, j) => j !== index));

  const handleSubmit = async () => {
    const errors = {};
    if (!category) errors.category = 'Please select an issue category.';
    if (!subject.trim()) errors.subject = 'Please enter a subject.';
    if (!description.trim()) errors.description = 'Please describe the issue.';
    if (!priority) errors.priority = 'Please select a priority level.';
    if (photos.length < MIN_PHOTOS) errors.photos = 'Please attach at least 3 photos.';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('issueCategory', category);
      fd.append('subject', subject.trim());
      fd.append('description', description.trim());
      fd.append('priorityLevel', priority);
      photos.forEach((p, i) => {
        const uriParts = p.uri.split('.');
        const ext = uriParts[uriParts.length - 1] || 'jpg';
        fd.append('maintenance_images', {
          uri:  p.uri,
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          name: p.fileName || `photo_${i}.${ext}`,
        });
      });
      await api.post(API_ROUTES.MAINTENANCE, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Submitted!', 'Your maintenance request has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Submission failed.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={18} color={BLUE} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>New Request</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.fieldLabel}>ISSUE CATEGORY *</Text>
        <View style={s.chipGrid}>
          {MAINTENANCE_CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[s.chip, category === c.value && s.chipActive]}
              onPress={() => { setCategory(c.value); setFieldErrors(prev => ({ ...prev, category: undefined })); }}
            >
              <Text style={[s.chipText, category === c.value && s.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!fieldErrors.category && <Text style={s.fieldError}>{fieldErrors.category}</Text>}

        <Text style={s.fieldLabel}>PRIORITY *</Text>
        <View style={s.priorityRow}>
          {PRIORITIES.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[
                s.priorityChip,
                priority === p.value && { backgroundColor: p.color, borderColor: p.color },
              ]}
              onPress={() => { setPriority(p.value); setFieldErrors(prev => ({ ...prev, priority: undefined })); }}
            >
              <Text style={[s.priorityText, priority === p.value && { color: '#fff' }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!fieldErrors.priority && <Text style={s.fieldError}>{fieldErrors.priority}</Text>}

        <Text style={s.fieldLabel}>SUBJECT *</Text>
        <View style={[s.inputWrap, !!fieldErrors.subject && s.inputWrapError]}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.inputField}
            value={subject}
            onChangeText={v => { setSubject(v); setFieldErrors(prev => ({ ...prev, subject: undefined })); }}
            placeholder="Brief description of the issue"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        {!!fieldErrors.subject && <Text style={s.fieldError}>{fieldErrors.subject}</Text>}

        <Text style={s.fieldLabel}>DETAILS *</Text>
        <TextInput
          style={[s.inputMulti, !!fieldErrors.description && s.inputMultiError]}
          value={description}
          onChangeText={v => { setDesc(v); setFieldErrors(prev => ({ ...prev, description: undefined })); }}
          placeholder="Explain the issue in more detail…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        {!!fieldErrors.description && <Text style={s.fieldError}>{fieldErrors.description}</Text>}

        <View style={s.photoHeaderRow}>
          <Text style={[s.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>PHOTOS * (3–5 required)</Text>
          {photos.length > 0 && (
            <Text style={[s.photoCounter, photos.length >= MIN_PHOTOS ? { color: BLUE } : { color: COLORS.dangerPrimary }]}>
              {photos.length}/{MAX_PHOTOS}
            </Text>
          )}
        </View>

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbRow}>
            {photos.map((p, i) => (
              <View key={i} style={s.thumbWrap}>
                <Image source={{ uri: p.uri }} style={s.thumbImg} />
                <TouchableOpacity style={s.removeBtn} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={22} color={COLORS.dangerPrimary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[s.uploadZone, fieldErrors.photos ? s.uploadZoneError : null]}
            onPress={pickPhoto}
          >
            <View style={s.uploadIconWrap}>
              <Ionicons name="camera-outline" size={28} color={fieldErrors.photos ? COLORS.dangerPrimary : BLUE} />
            </View>
            <Text style={[s.uploadLabel, fieldErrors.photos ? { color: COLORS.dangerPrimary } : null]}>
              Tap to add photos
            </Text>
            <Text style={s.uploadSub}>Minimum 3 photos required</Text>
          </TouchableOpacity>
        )}
        {!!fieldErrors.photos && <Text style={s.fieldError}>{fieldErrors.photos}</Text>}

        <TouchableOpacity
          style={[s.submitBtn, loading && { opacity: 0.65 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitText}>SUBMIT REQUEST</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backText:  { fontSize: 13, color: BLUE, fontWeight: '500' },
  pageTitle: { fontSize: 26, fontWeight: '700', fontFamily: 'Inter_700Bold', color: COLORS.textPrimary },
  scroll:    { padding: 20, paddingBottom: 48 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: GOLD,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
  },
  optional:  { fontWeight: '400', color: COLORS.textMuted, textTransform: 'none' },
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.borderLight },
  chipActive:     { backgroundColor: BLUE, borderColor: BLUE },
  chipText:       { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  priorityRow:    { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderLight, backgroundColor: '#fff',
  },
  priorityText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: 12, height: 52, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.inputBorder,
  },
  inputField: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  inputMulti: {
    backgroundColor: COLORS.inputBg, borderRadius: 12, height: 100,
    paddingHorizontal: 14, paddingTop: 14, fontSize: 14, color: COLORS.textPrimary,
    textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.inputBorder,
  },
  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 16 },
  photoCounter:   { fontSize: 13, fontWeight: '700' },
  thumbRow:       { flexDirection: 'row', marginBottom: 12 },
  thumbWrap:      { position: 'relative', marginRight: 10 },
  removeBtn:      { position: 'absolute', top: -8, right: -8 },
  uploadZone: {
    borderWidth: 1.5, borderColor: BLUE, borderStyle: 'dashed',
    borderRadius: 16, backgroundColor: COLORS.tenantLight,
    padding: 24, alignItems: 'center', gap: 8, marginBottom: 4,
  },
  uploadZoneError: { borderColor: COLORS.dangerPrimary, backgroundColor: '#FFF5F5' },
  uploadIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  uploadLabel:    { fontSize: 14, fontWeight: '700', color: BLUE },
  uploadSub:      { fontSize: 12, color: COLORS.textMuted },
  fieldError:     { fontSize: 12, color: COLORS.dangerPrimary, marginTop: 4, marginBottom: 4 },
  inputWrapError: { borderColor: COLORS.dangerPrimary },
  inputMultiError:{ borderColor: COLORS.dangerPrimary },
  thumbImg:       { width: 76, height: 76, borderRadius: 10 },
  submitBtn: {
    backgroundColor: BLUE, height: 52, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
});
