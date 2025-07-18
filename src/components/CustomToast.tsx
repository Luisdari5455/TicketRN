// src/components/CustomToast.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  text1: string;
  text2?: string;
};

export const CustomToast = ({ text1, text2 }: Props) => (
  <View style={styles.container}>
    <Text style={styles.title}>{text1}</Text>
    {text2 && <Text style={styles.message}>{text2}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ef4444', 
    padding: 16,
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: '#b91c1c',
    marginHorizontal: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  message: {
    fontSize: 16,
    color: '#fef2f2',
    marginTop: 6,
  },
});
