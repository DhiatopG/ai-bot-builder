import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role?: string; // Optional: if you use admin/user roles
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role?: string;
  }
}
