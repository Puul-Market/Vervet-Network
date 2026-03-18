export interface ApiResponse<T> {
  status: true;
  data: T;
}

export function apiResponse<T>(data: T): ApiResponse<T> {
  return {
    status: true,
    data,
  };
}
