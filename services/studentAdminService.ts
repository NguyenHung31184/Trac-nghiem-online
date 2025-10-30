import { callCallableWithFallbacks } from './firebaseFunctionsClient';

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

export const upsertStudentAccount = async (
  payload: UpsertStudentPayload
): Promise<UpsertStudentResponse> => {
  return callCallableWithFallbacks<UpsertStudentPayload, UpsertStudentResponse>(
    'upsertStudentAccount',
    payload
  );
};
