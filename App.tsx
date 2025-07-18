import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { CustomToast } from './src/components/CustomToast';

const toastConfig = {
  success: (props: any) => <CustomToast {...props} />,
  error: (props: any) => <CustomToast {...props} />,
};

export default function App() {
  return (
    <>
      <AppNavigator />
      <Toast config={toastConfig} />
    </>
  );
}
