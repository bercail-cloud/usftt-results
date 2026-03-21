export interface ApiResponse<T> {
  data: T;
  lastSync: string | null;
}

export interface ApiError {
  error: string;
  message: string;
}
