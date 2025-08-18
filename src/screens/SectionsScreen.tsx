import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { FontAwesome5 } from '@expo/vector-icons';
import { getServices, registerTicket } from '../services/ticketService';
import type { RouteProp } from '@react-navigation/native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Sections'>;
type SectionsRouteProp = RouteProp<RootStackParamList, 'Sections'>;

interface ServiceType {
  idService: number;
  name: string;
}

export default function SectionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SectionsRouteProp>();
  const { dpi, name } = route.params;

  const [sections, setSections] = useState<ServiceType[]>([]);
  console.log(sections,"valida sections")
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await getServices();
        setSections(data); // espera que el backend devuelva [{ id: number, name: string }]
      } catch (err) {
        console.error("Error al obtener servicios", err);
        Alert.alert("Error", "No se pudieron cargar las secciones");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const handleSelect = async (section: ServiceType) => {
    try {
      const ticketInfo = await registerTicket({
        dpi,
        name,
        idService: section.idService,
        locationId: "sucursal-central-01",
      });
      navigation.navigate('Result', { ticketInfo });
    } catch (error) {
      console.error('Error al registrar ticket:', error);
      Alert.alert('Error', 'No se pudo registrar el ticket.');
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e3a8a']} style={styles.container}>
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
      >
        <Text style={styles.title}>Seleccione una sección</Text>
      </MotiView>

      <FlatList
        data={sections}
        keyExtractor={(item) => item?.idService?.toString()}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item, index }) => (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', delay: index * 100 }}
          >
            <TouchableOpacity style={styles.cardButton} onPress={() => handleSelect(item)}>
              <FontAwesome5 name="chevron-right" size={18} color="#fff" style={styles.icon} />
              <Text style={styles.cardText}>{item.name}</Text>
            </TouchableOpacity>
          </MotiView>
        )}
        showsVerticalScrollIndicator={false}
      />
    </LinearGradient>
  );
}


const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
  },
  listContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  cardButton: {
    width: width * 0.9,
    backgroundColor: '#2563EB',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 14,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
  },
  icon: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: [{ translateY: -9 }],
  },
  cardText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
});
