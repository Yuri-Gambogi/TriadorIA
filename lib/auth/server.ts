import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApiError } from '@/lib/api/error-handler';

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components não podem setar cookies. O middleware cuida do refresh.
          }
        },
      },
    },
  );
}

export async function getServerSession() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getServerSession();
  if (!user) {
    throw new ApiError('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.', 401);
  }
  return user;
}
