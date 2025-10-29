import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type UpsertStudentPayload = {
  email: string;
  fullName: string;
  classIds: string[];
  password?: string;
};

export type UpsertStudentResponse = {
  success: boolean;
  operation: 'created' | 'updated';
  passwordUpdated: boolean;
  message: string;
};

const upsertCallable = httpsCallable(functions, 'upsertStudentAccount');

export const upsertStudentAccount = async (
  payload: UpsertStudentPayload
): Promise<UpsertStudentResponse> => {
  const response = await upsertCallable(payload);
  return response.data as UpsertStudentResponse;
};