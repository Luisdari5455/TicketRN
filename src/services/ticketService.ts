// ticketService.ts

import axios from 'axios';

const API_URL = 'http://localhost:3001/api/services';

export const getServices = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const registerTicket = async (payload: {
  dpi: string | undefined;
  name: string;
  idService: number;
}) => {
  const response = await axios.post('http://localhost:3001/api/ticket-registration', payload);
  return response.data;
};
