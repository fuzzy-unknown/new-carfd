export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: number;
}

export interface CreateUser {
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}
