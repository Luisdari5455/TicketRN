import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import DpiScreen from '../screens/DpiScreen';
import SinDpiScreen from '../screens/SinDpiScreen';
import SectionsScreen from '../screens/SectionsScreen';
import ResultScreen from '../screens/ResultScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  DPI: undefined;
  SinDPI: undefined;
  Sections: {
    dpi?: string;
    name: string;
  };
  Result: {
    ticketInfo: any;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="DPI" component={DpiScreen} />
        <Stack.Screen name="SinDPI" component={SinDpiScreen} />
        <Stack.Screen name="Sections" component={SectionsScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
