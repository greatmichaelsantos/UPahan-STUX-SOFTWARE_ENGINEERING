import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_ROUTES } from '@upahan/shared';
import api from '../../api/client';
import { COLORS } from '../../constants/colors';

const TEAL = COLORS.landlordPrimary;
const GOLD = COLORS.goldAccent;

export default function AdminRegisterUnit({ navigation }) {
  const [form, setForm] = useState({
    unitCode: '', monthlyPrice: '', floorPlan: '', location: '', bedrooms: '', description: '', dueDay: '5',
  });
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(false);

  const set = key => val => setForm(f => ({ ...f, [key]: val }));

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhotos(prev => [...prev, ...result.assets]);
  };

  const handleSubmit = async () => {
    if (!form.unitCode.trim() || !form.monthlyPrice) {
      return Alert.alert('Required', 'Unit code and monthly price are required.');
    }
    if (isNaN(parseFloat(form.monthlyPrice))) {
      return Alert.alert('Invalid', 'Monthly price must be a number.');
    }
    const parsedDueDay = parseInt(form.dueDay);
    if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      return Alert.alert('Invalid', 'Due day must be between 1 and 31.');
    }
    setLoading(true);
    try {
      const res = await api.post(API_ROUTES.UNITS, {
        unitCode:     form.unitCode.trim().toUpperCase(),
        monthlyPrice: parseFloat(form.monthlyPrice),
        floorPlan:    form.floorPlan.trim()   || null,
        location:     form.location.trim()    || null,
        bedrooms:     form.bedrooms.trim()    || null,
        description:  form.description.trim() || null,
        dueDay:       parsedDueDay,
      });
      const newUnitId = res.data.data?.unit_id;
      if (newUnitId && photos.length > 0) {
        const fd = new FormData();
        photos.forEach(p => fd.append('photos', { uri: p.uri, type: 'image/jpeg', name: 'unit.jpg' }));
        await api.post(API_ROUTES.unitPhotos(newUnitId), fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      Alert.alert('Success', 'Unit registered successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to register unit.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Register Unit</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="Unit Code *"     value={form.unitCode}     onChange={set('unitCode')}     placeholder="e.g. A-101" caps />
        <Field label="Monthly Price *" value={form.monthlyPrice} onChange={set('monthlyPrice')} placeholder="e.g. 5000"  keyboard="decimal-pad" />
        <Field label="Floor Plan"      value={form.floorPlan}    onChange={set('floorPlan')}    placeholder="e.g. Studio, 2 Bedroom" />
        <Field label="Location"        value={form.location}     onChange={set('location')}     placeholder="e.g. Olongapo City" />
        <Field label="Bedrooms"        value={form.bedrooms}     onChange={set('bedrooms')}     placeholder="e.g. 1 Bedroom" keyboard="number-pad" />
        <Field label="Payment Due Day" value={form.dueDay}       onChange={set('dueDay')}       placeholder="e.g. 5" keyboard="number-pad" />
        <Field label="Description"     value={form.description}  onChange={set('description')}  placeholder="Additional details…" multiline />

        <Text style={s.fieldLabel}>PHOTOS</Text>
        <TouchableOpacity style={s.uploadZone} onPress={pickPhoto}>
          <View style={s.uploadIconWrap}>
            <Ionicons name="camera-outline" size={28} color={TEAL} />
          </View>
          <Text style={s.uploadLabel}>Tap to add photos</Text>
          <Text style={s.uploadSub}>{photos.length > 0 ? `${photos.length} selected` : 'JPG, PNG supported'}</Text>
        </TouchableOpacity>

        {photos.length > 0 && (
          <View style={s.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={s.photoThumb}>
                <Image source={{ uri: p.uri }} style={s.thumbImg} />
                <TouchableOpacity
                  style={s.removePhoto}
                  onPress={() => setPhotos(ps => ps.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close-circle" size={22} color={COLORS.dangerPrimary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.65 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>REGISTER UNIT</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboard = 'default', multiline, caps }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboard}
        autoCapitalize={caps ? 'characters' : 'sentences'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, backgroundColor: TEAL,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: GOLD, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#fff' },
  scroll:     { padding: 20, paddingBottom: 56 },
  field:      { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: GOLD,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: 12, height: 52,
    paddingHorizontal: 14, fontSize: 14, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.inputBorder,
  },
  inputMulti: { height: 90, textAlignVertical: 'top', paddingTop: 14 },
  uploadZone: {
    borderWidth: 1.5, borderColor: TEAL, borderStyle: 'dashed',
    borderRadius: 16, backgroundColor: COLORS.landlordLight,
    padding: 24, alignItems: 'center', gap: 8, marginBottom: 16,
  },
  uploadIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  uploadLabel: { fontSize: 14, fontWeight: '700', color: TEAL },
  uploadSub:   { fontSize: 12, color: COLORS.textSecondary },
  photoRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  photoThumb:  { position: 'relative' },
  thumbImg:    { width: 80, height: 80, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: -8, right: -8 },
  btn: {
    backgroundColor: TEAL, height: 52, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1.5 },
});
